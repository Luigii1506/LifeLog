import { db } from "@/lib/db";
import { newId } from "@/lib/ids";
import { emit, currentTimezone } from "@/lib/events/emit";
import { bestOneRepMax, estimatedOneRepMax } from "./queries";

/**
 * Ciclo de vida de una sesión de entrenamiento.
 *
 * Una sesión es MUTABLE mientras está abierta e INMUTABLE al cerrarla
 * (DATA_OWNERSHIP §3). Al cerrar emite su evento resumen a la columna
 * vertebral — sin eso la sesión es invisible para la línea de tiempo y para
 * las proyecciones, y eso es una violación de I-11.
 */

export class OpenSessionError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "OpenSessionError";
  }
}

export async function startSession(options: {
  routineId?: string | null;
  placeEntityId?: string | null;
  energyBefore?: number | null;
  source?: string;
} = {}) {
  const abierta = await db.workoutSession.findFirst({ where: { status: "open" } });
  if (abierta) {
    throw new OpenSessionError(
      "Ya hay una sesión abierta. Ciérrala antes de empezar otra.",
    );
  }

  const startedAt = new Date();
  return db.workoutSession.create({
    data: {
      id: newId(startedAt.getTime()),
      routineId: options.routineId ?? null,
      startedAt,
      timezone: currentTimezone(),
      placeEntityId: options.placeEntityId ?? null,
      energyBefore: options.energyBefore ?? null,
      status: "open",
      source: options.source ?? "app:gym",
    },
  });
}

export async function logSet(input: {
  sessionId: string;
  exerciseId: string;
  reps?: number | null;
  weightKg?: number | null;
  rir?: number | null;
  setType?: string;
  notes?: string | null;
}) {
  const session = await db.workoutSession.findUnique({
    where: { id: input.sessionId },
    select: { status: true },
  });
  if (!session) throw new Error(`No existe la sesión ${input.sessionId}`);
  if (session.status !== "open") {
    throw new OpenSessionError(
      "La sesión está cerrada. Una sesión cerrada es inmutable.",
    );
  }

  // El índice se calcula por ejercicio, no por sesión: cada ejercicio
  // numera sus series desde 1.
  const previas = await db.exerciseSet.count({
    where: { sessionId: input.sessionId, exerciseId: input.exerciseId },
  });

  return db.exerciseSet.create({
    data: {
      id: newId(),
      sessionId: input.sessionId,
      exerciseId: input.exerciseId,
      setIndex: previas + 1,
      setType: input.setType ?? "work",
      reps: input.reps ?? null,
      weightKg: input.weightKg ?? null,
      rir: input.rir ?? null,
      notes: input.notes ?? null,
    },
  });
}

export async function deleteSet(setId: string) {
  const set = await db.exerciseSet.findUnique({
    where: { id: setId },
    include: { session: { select: { status: true } } },
  });
  if (!set) return;
  if (set.session.status !== "open") {
    throw new OpenSessionError("No se puede borrar una serie de una sesión cerrada.");
  }
  await db.exerciseSet.delete({ where: { id: setId } });
}

export type CloseResult = {
  sessionId: string;
  eventId: string;
  volumeKg: number;
  setCount: number;
  durationMin: number;
  prs: string[];
};

/**
 * Cierra la sesión: calcula agregados, detecta récords y emite el evento
 * resumen. Los récords se calculan ANTES de marcar la sesión como cerrada,
 * para que el histórico contra el que se comparan no se incluya a sí mismo.
 */
export async function closeSession(
  sessionId: string,
  options: { rpe?: number | null; notes?: string | null } = {},
): Promise<CloseResult> {
  const session = await db.workoutSession.findUnique({
    where: { id: sessionId },
    include: { routine: true, sets: { include: { exercise: true } } },
  });
  if (!session) throw new Error(`No existe la sesión ${sessionId}`);
  if (session.status !== "open") {
    throw new OpenSessionError("La sesión ya está cerrada.");
  }

  const trabajo = session.sets.filter((s) => s.setType !== "warmup");

  const volumeKg = trabajo.reduce(
    (sum, s) => sum + (s.reps ?? 0) * (s.weightKg ?? 0),
    0,
  );

  const endedAt = new Date();
  const durationMin = Math.max(
    0,
    Math.round((endedAt.getTime() - session.startedAt.getTime()) / 60000),
  );

  // Récords: se comparan contra el histórico EXCLUYENDO esta sesión.
  const prs: string[] = [];
  const porEjercicio = new Map<string, typeof trabajo>();
  for (const set of trabajo) {
    const lista = porEjercicio.get(set.exerciseId) ?? [];
    lista.push(set);
    porEjercicio.set(set.exerciseId, lista);
  }

  for (const [exerciseId, sets] of porEjercicio) {
    const previo = await bestOneRepMax(exerciseId, { excludeSessionId: sessionId });
    let mejor = { valor: 0, set: sets[0] };
    for (const set of sets) {
      if (set.reps === null || set.weightKg === null) continue;
      const valor = estimatedOneRepMax(set.weightKg, set.reps);
      if (valor > mejor.valor) mejor = { valor, set };
    }
    if (mejor.valor > previo && mejor.valor > 0) {
      prs.push(`${mejor.set.exercise.name} ${mejor.set.weightKg}×${mejor.set.reps}`);
    }
  }

  const evento = await emit({
    kind: "workout.session",
    payload: {
      sessionId,
      routine: session.routine?.name,
      durationMin,
      volumeKg,
      setCount: trabajo.length,
      prs,
      rpe: options.rpe ?? undefined,
    },
    startedAt: session.startedAt,
    endedAt,
    timezone: session.timezone,
    source: "app:gym",
  });

  await db.workoutSession.update({
    where: { id: sessionId },
    data: {
      endedAt,
      status: "closed",
      volumeKg,
      setCount: trabajo.length,
      durationMin,
      rpe: options.rpe ?? session.rpe,
      notes: options.notes ?? session.notes,
      eventId: evento.id,
    },
  });

  return { sessionId, eventId: evento.id, volumeKg, setCount: trabajo.length, durationMin, prs };
}

/** Descarta una sesión abierta sin emitir evento. Solo si no tiene series. */
export async function discardSession(sessionId: string) {
  const session = await db.workoutSession.findUnique({
    where: { id: sessionId },
    include: { _count: { select: { sets: true } } },
  });
  if (!session) return;
  if (session.status !== "open") {
    throw new OpenSessionError("Solo se descartan sesiones abiertas.");
  }
  if (session._count.sets > 0) {
    throw new OpenSessionError(
      "La sesión tiene series registradas. Ciérrala en vez de descartarla.",
    );
  }
  await db.workoutSession.delete({ where: { id: sessionId } });
}
