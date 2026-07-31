"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { emit, revoke } from "@/lib/events/emit";
import { SUFIJO_RETIRADO } from "@/lib/events/query";
import { ETIQUETAS, ETIQUETA_POR_DEFECTO } from "@/lib/notes/tags";

export type NoteResult = { ok: true } | { ok: false; error: string };

/** Límite de una nota. Más largo que esto no es una captura: es un documento. */
const MAXIMO = 2000;

export async function saveNote(
  text: string,
  tag: string,
  timeZone: string,
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
      source: "app:notas",
    });
  } catch (error) {
    console.error("guardar nota falló", error);
    return { ok: false, error: "No se pudo guardar" };
  }
  revalidatePath("/notas");
  revalidatePath("/");
  return { ok: true };
}

/** Cambia la etiqueta sin apilar otra nota: corrige la que hay (I-02). */
export async function retagNote(eventId: string, tag: string): Promise<NoteResult> {
  const valida = ETIQUETAS.some((t) => t.id === tag) ? tag : ETIQUETA_POR_DEFECTO;
  try {
    const objetivo = await db.event.findUnique({
      where: { id: eventId },
      select: { kind: true, timezone: true, payloadJson: true },
    });
    if (!objetivo || objetivo.kind !== "note.quick") {
      return { ok: false, error: "Esa nota no existe" };
    }
    const payload = JSON.parse(objetivo.payloadJson) as Record<string, unknown>;
    await revoke(eventId, {
      kind: "note.quick",
      payload: { ...payload, tag: valida },
      timezone: objetivo.timezone,
      source: "app:notas:correccion",
    });
  } catch (error) {
    console.error("reetiquetar nota falló", error);
    return { ok: false, error: "No se pudo cambiar" };
  }
  revalidatePath("/notas");
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
