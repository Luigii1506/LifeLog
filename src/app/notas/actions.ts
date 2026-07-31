"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { emit, revoke } from "@/lib/events/emit";
import { SUFIJO_RETIRADO } from "@/lib/events/query";
import { ETIQUETAS, ETIQUETA_POR_DEFECTO } from "@/lib/notes/tags";

export type NoteResult = { ok: true } | { ok: false; error: string };

/** Límite de una nota. Más largo que esto no es una captura: es un documento. */
const MAXIMO = 2000;

/**
 * Guarda una nota, o CORRIGE la que se pase en `replacesId`.
 *
 * Corregir no apila otra: emite un evento que anula al anterior (I-02) y las
 * consultas filtran los anulados, así que para quien escribe es una edición.
 */
export async function saveNote(
  text: string,
  tag: string,
  timeZone: string,
  replacesId?: string | null,
): Promise<NoteResult> {
  const limpio = text.trim();
  if (!limpio) return { ok: false, error: "La nota está vacía" };
  if (limpio.length > MAXIMO) {
    return { ok: false, error: "Demasiado largo para una nota rápida" };
  }

  // La etiqueta se valida contra el catálogo: si llegara una inventada, el
  // filtro dejaría de encontrarla y la nota quedaría invisible.
  const valida = ETIQUETAS.some((t) => t.id === tag) ? tag : ETIQUETA_POR_DEFECTO;

  try {
    await emit({
      kind: "note.quick",
      payload: { text: limpio, tag: valida },
      timezone: timeZone,
      revokesId: replacesId ?? null,
      source: replacesId ? "app:notas:correccion" : "app:notas",
    });
  } catch (error) {
    console.error("guardar nota falló", error);
    return { ok: false, error: "No se pudo guardar" };
  }
  revalidatePath("/notas");
  revalidatePath("/");
  return { ok: true };
}

export async function deleteNote(eventId: string): Promise<NoteResult> {
  try {
    const objetivo = await db.event.findUnique({
      where: { id: eventId },
      select: { kind: true, timezone: true, payloadJson: true },
    });
    if (!objetivo || objetivo.kind !== "note.quick") {
      return { ok: false, error: "Esa nota no existe" };
    }
    await revoke(eventId, {
      kind: "note.quick",
      payload: JSON.parse(objetivo.payloadJson),
      timezone: objetivo.timezone,
      source: `app:notas${SUFIJO_RETIRADO}`,
    });
  } catch (error) {
    console.error("borrar nota falló", error);
    return { ok: false, error: "No se pudo borrar" };
  }
  revalidatePath("/notas");
  revalidatePath("/");
  return { ok: true };
}
