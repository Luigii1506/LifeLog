"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { newId } from "@/lib/ids";
import {
  closeSession,
  deleteSet,
  discardSession,
  logSet,
  OpenSessionError,
  startSession,
  updateSet,
} from "@/lib/gym/session";

export type GymResult = { ok: true } | { ok: false; error: string };

function fail(error: unknown): GymResult {
  if (error instanceof OpenSessionError) return { ok: false, error: error.message };
  console.error("gym action falló", error);
  return { ok: false, error: "No se pudo completar la operación" };
}

/**
 * Registra una serie, abriendo la sesión si aún no existe.
 *
 * La sesión nace AQUÍ, con la primera serie. Antes nacía al tocar el grupo
 * muscular, y eso convertía «mirar qué ejercicios hay de pecho» en un
 * entrenamiento empezado: el cronómetro corría, la sesión bloqueaba abrir otra,
 * y quedaban sesiones guardadas sin una sola serie.
 *
 * Elegir grupo es mirar. Entrenar es levantar algo.
 */
export async function addSet(input: {
  exerciseId: string;
  weightKg: number | null;
  reps: number | null;
  rir: number | null;
  setType?: string;
  timeZone: string;
}): Promise<GymResult> {
  try {
    const abierta = await db.workoutSession.findFirst({
      where: { status: "open" },
      select: { id: true },
    });
    const sessionId =
      abierta?.id ?? (await startSession({ timeZone: input.timeZone })).id;

    await logSet({
      sessionId,
      exerciseId: input.exerciseId,
      weightKg: input.weightKg,
      reps: input.reps,
      rir: input.rir,
      setType: input.setType,
    });
  } catch (error) {
    return fail(error);
  }
  revalidatePath("/gym");
  revalidatePath("/");
  return { ok: true };
}

export async function editSet(
  setId: string,
  cambios: { weightKg: number | null; reps: number | null; rir: number | null },
): Promise<GymResult> {
  try {
    await updateSet(setId, cambios);
  } catch (error) {
    return fail(error);
  }
  revalidatePath("/gym");
  return { ok: true };
}

export async function removeSet(setId: string): Promise<GymResult> {
  try {
    await deleteSet(setId);
  } catch (error) {
    return fail(error);
  }
  revalidatePath("/gym");
  return { ok: true };
}

export async function finishWorkout(
  sessionId: string,
  rpe: number | null,
): Promise<GymResult & { prs?: string[] }> {
  try {
    const resultado = await closeSession(sessionId, { rpe });
    revalidatePath("/gym");
    revalidatePath("/");
    return { ok: true, prs: resultado.prs };
  } catch (error) {
    return fail(error);
  }
}

export async function cancelWorkout(sessionId: string): Promise<GymResult> {
  try {
    await discardSession(sessionId);
  } catch (error) {
    return fail(error);
  }
  revalidatePath("/gym");
  return { ok: true };
}

/** Crear un ejercicio sin salir del flujo: la fricción mata el registro. */
export async function createExercise(
  name: string,
  muscleGroup: string | null,
): Promise<GymResult & { id?: string }> {
  const limpio = name.trim();
  if (!limpio) return { ok: false, error: "El nombre no puede estar vacío" };

  try {
    const existente = await db.exercise.findUnique({ where: { name: limpio } });
    if (existente) return { ok: true, id: existente.id };

    const creado = await db.exercise.create({
      data: { id: newId(), name: limpio, muscleGroup: muscleGroup || null },
    });
    revalidatePath("/gym");
    return { ok: true, id: creado.id };
  } catch (error) {
    return fail(error);
  }
}
