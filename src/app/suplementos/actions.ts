"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { emit, revoke } from "@/lib/events/emit";
import { SUFIJO_RETIRADO } from "@/lib/events/query";
import { suplementoPorId } from "@/lib/supplements/catalog";

export type SupplementResult = { ok: true } | { ok: false; error: string };

/**
 * Registra una toma.
 *
 * La dosis se valida contra el catálogo, no se acepta tal cual: el cliente
 * manda un número y el catálogo decide si ese suplemento lleva cantidad, en qué
 * pasos y hasta cuánto. Sin eso, un fallo de la interfaz escribe 40 scoops.
 */
export async function logSupplement(
  supplementId: string,
  dose: number | null,
  timeZone: string,
): Promise<SupplementResult> {
  const s = suplementoPorId(supplementId);
  if (!s) return { ok: false, error: "Ese suplemento no existe" };

  let payload: Record<string, unknown> = { name: s.name };

  if (s.dosing.kind === "steps") {
    if (dose === null || !Number.isFinite(dose) || dose <= 0) {
      return { ok: false, error: "Falta la cantidad" };
    }
    if (dose > s.dosing.max) {
      return { ok: false, error: `Demasiado: el tope son ${s.dosing.max} ${s.dosing.unit}` };
    }
    // Se ajusta al paso declarado: medio scoop sí, un tercio no.
    const ajustada = Math.round(dose / s.dosing.step) * s.dosing.step;
    payload = { ...payload, dose: Number(ajustada.toFixed(2)), unit: s.dosing.unit };
  }

  try {
    await emit({
      kind: "medication.taken",
      payload,
      timezone: timeZone,
      source: "app:suplementos",
    });
  } catch (error) {
    console.error("registro de suplemento falló", error);
    return { ok: false, error: "No se pudo registrar" };
  }
  revalidatePath("/suplementos");
  revalidatePath("/");
  return { ok: true };
}

/** Deshace una toma. No borra: emite una retirada (I-02). */
export async function undoSupplement(eventId: string): Promise<SupplementResult> {
  try {
    const objetivo = await db.event.findUnique({
      where: { id: eventId },
      select: { kind: true, timezone: true, payloadJson: true },
    });
    if (!objetivo || objetivo.kind !== "medication.taken") {
      return { ok: false, error: "Ese registro no existe" };
    }
    await revoke(eventId, {
      kind: "medication.taken",
      payload: JSON.parse(objetivo.payloadJson),
      timezone: objetivo.timezone,
      source: `app:suplementos${SUFIJO_RETIRADO}`,
    });
  } catch (error) {
    console.error("deshacer suplemento falló", error);
    return { ok: false, error: "No se pudo deshacer" };
  }
  revalidatePath("/suplementos");
  revalidatePath("/");
  return { ok: true };
}
