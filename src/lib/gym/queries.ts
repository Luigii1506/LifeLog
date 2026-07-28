import { db } from "@/lib/db";

/**
 * Consultas del dominio gimnasio.
 *
 * `lastSetsFor` es la consulta que justifica que este dominio tenga tablas
 * relacionales en vez de vivir en el log de eventos (ADR-109). Sobre
 * `payloadJson` sería un escaneo completo con `json_extract`; aquí usa el
 * índice `[exerciseId, completedAt]` de `exercise_sets`.
 */

export type PreviousSet = {
  setIndex: number;
  reps: number | null;
  weightKg: number | null;
  rir: number | null;
  setType: string;
};

export async function getRoutines() {
  return db.workoutRoutine.findMany({
    where: { status: "active" },
    orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
    include: {
      exercises: {
        orderBy: { sortOrder: "asc" },
        include: { exercise: true },
      },
    },
  });
}

export async function getExercises() {
  return db.exercise.findMany({
    where: { status: "active" },
    orderBy: [{ muscleGroup: "asc" }, { name: "asc" }],
  });
}

/** La sesión abierta, si la hay. Solo puede haber una a la vez. */
export async function getOpenSession() {
  return db.workoutSession.findFirst({
    where: { status: "open" },
    orderBy: { startedAt: "desc" },
    include: {
      routine: true,
      sets: {
        orderBy: [{ exerciseId: "asc" }, { setIndex: "asc" }],
        include: { exercise: true },
      },
    },
  });
}

export async function getSession(sessionId: string) {
  return db.workoutSession.findUnique({
    where: { id: sessionId },
    include: {
      routine: true,
      sets: {
        orderBy: [{ exerciseId: "asc" }, { setIndex: "asc" }],
        include: { exercise: true },
      },
    },
  });
}

/**
 * Las series de la última sesión en la que se hizo este ejercicio.
 *
 * Es lo que la interfaz muestra mientras registras: «Press militar —
 * anterior: 40 × 10, 9, 8». Sin esto la app de gimnasio no sirve, y es la
 * razón entera de que `ExerciseSet` sea una tabla.
 */
export async function lastSetsFor(
  exerciseId: string,
  options: { excludeSessionId?: string } = {},
): Promise<{ sessionId: string; date: Date; sets: PreviousSet[] } | null> {
  const ultima = await db.exerciseSet.findFirst({
    where: {
      exerciseId,
      sessionId: options.excludeSessionId
        ? { not: options.excludeSessionId }
        : undefined,
      session: { status: "closed" },
    },
    orderBy: { completedAt: "desc" },
    select: { sessionId: true, completedAt: true },
  });

  if (!ultima) return null;

  const sets = await db.exerciseSet.findMany({
    where: { sessionId: ultima.sessionId, exerciseId, setType: { not: "warmup" } },
    orderBy: { setIndex: "asc" },
    select: {
      setIndex: true,
      reps: true,
      weightKg: true,
      rir: true,
      setType: true,
    },
  });

  return { sessionId: ultima.sessionId, date: ultima.completedAt, sets };
}

/**
 * 1RM estimado por Epley. Se usa para decidir si una serie es récord.
 * No pretende ser fisiológicamente exacto: pretende ser comparable consigo
 * mismo a lo largo del tiempo, que es lo único que importa aquí.
 */
export function estimatedOneRepMax(weightKg: number, reps: number): number {
  if (reps <= 0 || weightKg <= 0) return 0;
  if (reps === 1) return weightKg;
  return weightKg * (1 + reps / 30);
}

/** Mejor 1RM estimado histórico de un ejercicio, excluyendo una sesión. */
export async function bestOneRepMax(
  exerciseId: string,
  options: { excludeSessionId?: string } = {},
): Promise<number> {
  const sets = await db.exerciseSet.findMany({
    where: {
      exerciseId,
      setType: { not: "warmup" },
      sessionId: options.excludeSessionId
        ? { not: options.excludeSessionId }
        : undefined,
      session: { status: "closed" },
    },
    select: { reps: true, weightKg: true },
  });

  return sets.reduce((max, s) => {
    if (s.reps === null || s.weightKg === null) return max;
    return Math.max(max, estimatedOneRepMax(s.weightKg, s.reps));
  }, 0);
}
