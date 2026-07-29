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

export async function startWorkout(
  routineId: string | null,
  timeZone: string,
): Promise<GymResult> {
  try {
    await startSession({ routineId, timeZone });
  } catch (error) {
    return fail(error);
  }
  revalidatePath("/gym");
  return { ok: true };
}

export async function addSet(input: {
  sessionId: string;
  exerciseId: string;
  weightKg: number | null;
  reps: number | null;
  rir: number | null;
  setType?: string;
}): Promise<GymResult> {
  try {
    await logSet(input);
  } catch (error) {
    return fail(error);
  }
  revalidatePath("/gym");
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

/**
 * Abre la sesión de entrenamiento.
 *
 * No hay un paso previo de «empezar entrenamiento»: llegas al gimnasio, el
 * coach dice pecho, tocas pecho. Elegir qué vas a trabajar ES empezar, y
 * separarlo en dos pantallas era un toque de más por pura ceremonia.
 *
 * Si ya hay una sesión abierta no crea otra: entrar dos veces desde el home
 * no debe duplicar el entrenamiento.
 */
export async function openWorkout(
  routineId: string | null,
  timeZone: string,
): Promise<GymResult> {
  try {
    const abierta = await db.workoutSession.findFirst({ where: { status: "open" } });
    if (!abierta) await startSession({ routineId: routineId ?? null, timeZone });
  } catch (error) {
    return fail(error);
  }
  revalidatePath("/gym");
  return { ok: true };
}
