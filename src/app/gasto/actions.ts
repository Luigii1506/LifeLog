"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { emit, revoke } from "@/lib/events/emit";
import { SUFIJO_RETIRADO } from "@/lib/events/query";
import { CATEGORIAS } from "@/lib/expenses/categories";

export type ExpenseResult = { ok: true } | { ok: false; error: string };

/** Tope de cordura. Por encima, es un dedo de más en el teclado. */
const MAXIMO = 1_000_000;

export async function logExpense(
  amount: number,
  category: string,
  merchant: string | null,
  timeZone: string,
): Promise<ExpenseResult> {
  if (!Number.isFinite(amount) || amount <= 0) {
    return { ok: false, error: "Falta el importe" };
  }
  if (amount > MAXIMO) return { ok: false, error: "Ese importe no parece real" };

  // La categoría se valida contra el catálogo: una inventada dejaría el gasto
  // fuera de cualquier suma por categoría, que es para lo único que sirve
  // clasificar.
  if (!CATEGORIAS.some((c) => c.id === category)) {
    return { ok: false, error: "Elige una categoría" };
  }

  try {
    await emit({
      kind: "expense.logged",
      // Dos decimales: el peso no tiene más, y guardar 12,3456 daría una
      // precisión que ningún ticket respalda.
      payload: {
        amount: Math.round(amount * 100) / 100,
        currency: "MXN",
        category,
        ...(merchant?.trim() ? { merchant: merchant.trim() } : {}),
      },
      timezone: timeZone,
      source: "app:gasto",
    });
  } catch (error) {
    console.error("registro de gasto falló", error);
    return { ok: false, error: "No se pudo registrar" };
  }
  revalidatePath("/gasto");
  revalidatePath("/");
  return { ok: true };
}

/** Deshace un gasto. No borra: emite una retirada (I-02). */
export async function undoExpense(eventId: string): Promise<ExpenseResult> {
  try {
    const objetivo = await db.event.findUnique({
      where: { id: eventId },
      select: { kind: true, timezone: true, payloadJson: true },
    });
    if (!objetivo || objetivo.kind !== "expense.logged") {
      return { ok: false, error: "Ese gasto no existe" };
    }
    await revoke(eventId, {
      kind: "expense.logged",
      payload: JSON.parse(objetivo.payloadJson),
      timezone: objetivo.timezone,
      source: `app:gasto${SUFIJO_RETIRADO}`,
    });
  } catch (error) {
    console.error("deshacer gasto falló", error);
    return { ok: false, error: "No se pudo deshacer" };
  }
  revalidatePath("/gasto");
  revalidatePath("/");
  return { ok: true };
}
