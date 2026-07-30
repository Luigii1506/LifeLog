"use server";

import { revalidatePath } from "next/cache";
import { AssetError, removeExercisePhoto } from "@/lib/assets/asset";

export type PhotoResult = { ok: true } | { ok: false; error: string };

/**
 * Quitar la foto sí es una acción: no lleva binario, solo un id.
 *
 * Subir, en cambio, va por `/api/gym/photo` — una acción serializa el cuerpo y
 * eso encarece mandar bytes.
 */
export async function deleteExercisePhoto(exerciseId: string): Promise<PhotoResult> {
  try {
    await removeExercisePhoto(exerciseId);
  } catch (error) {
    if (error instanceof AssetError) return { ok: false, error: error.message };
    console.error("borrado de foto falló", error);
    return { ok: false, error: "No se pudo quitar la foto" };
  }
  revalidatePath("/gym");
  return { ok: true };
}
