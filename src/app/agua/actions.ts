"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { emit, revoke } from "@/lib/events/emit";

export type WaterResult = { ok: true } | { ok: false; error: string };

/**
 * Registra un trago. Es la acción más repetida del sistema: se llama ocho o
 * diez veces al día, así que no pregunta nada más.
 */
export async function logWater(
  ml: number,
  vessel: string | null,
  timeZone: string,
): Promise<WaterResult> {
  try {
    await emit({
      kind: "water.logged",
      payload: { ml, ...(vessel ? { vessel } : {}) },
      timezone: timeZone,
      source: "app:agua",
    });
  } catch (error) {
    console.error("registro de agua falló", error);
    return { ok: false, error: "No se pudo registrar" };
  }
  revalidatePath("/agua");
  revalidatePath("/");
  return { ok: true };
}

/**
 * Deshace el último trago.
 *
 * I-02: no se borra, se emite un evento que lo anula. Con un registro que se
 * toca diez veces al día, el toque de más es cuestión de tiempo — y sin poder
 * deshacerlo el total deja de ser fiable y se abandona la cuenta.
 *
 * El anulador lleva `ml: 0` —«no bebí nada»— así que al sumarlo el total no
 * cambia. Con cualquier otro valor, deshacer añadiría agua que no bebiste.
 */
export async function undoWater(eventId: string): Promise<WaterResult> {
  try {
    const objetivo = await db.event.findUnique({
      where: { id: eventId },
      select: { kind: true, timezone: true },
    });
    if (!objetivo || objetivo.kind !== "water.logged") {
      return { ok: false, error: "Ese registro no existe" };
    }
    await revoke(eventId, {
      kind: "water.logged",
      payload: { ml: 0 },
      timezone: objetivo.timezone,
      source: "app:agua:deshacer",
    });
  } catch (error) {
    console.error("deshacer agua falló", error);
    return { ok: false, error: "No se pudo deshacer" };
  }
  revalidatePath("/agua");
  revalidatePath("/");
  return { ok: true };
}
