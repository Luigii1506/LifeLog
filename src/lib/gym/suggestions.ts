import { db } from "@/lib/db";

/**
 * Sugerencias del gimnasio.
 *
 * El detalle de usabilidad que manda aquí: al terminar un ejercicio de pecho,
 * lo siguiente casi seguro es otro de pecho. El grupo muscular se queda
 * pegado y solo se cambia si tú lo cambias.
 */

export const GRUPOS = [
  "pecho", "espalda", "pierna", "hombro", "bíceps", "tríceps", "core", "cardio",
] as const;

export type ExerciseSuggestion = {
  id: string;
  name: string;
  muscleGroup: string | null;
  equipment: string | null;
  /** Veces registrado. 0 = viene del catálogo, no de tu historial. */
  timesLogged: number;
  /** Última serie hecha, para mostrarla sin abrir el ejercicio. */
  lastSets: string | null;
};

export type GroupSummary = {
  group: string;
  exerciseCount: number;
  /** Veces que has entrenado este grupo. Ordena las tarjetas. */
  timesTrained: number;
  /** Máquinas de este grupo que ya tienen foto. */
  photoCount: number;
};

/** Grupos con cuántos ejercicios tienen y cuánto los entrenas. */
export async function musclegroupSummary(): Promise<GroupSummary[]> {
  const ejercicios = await db.exercise.findMany({
    where: { status: "active" },
    select: { id: true, muscleGroup: true },
  });

  const series = await db.exerciseSet.findMany({
    where: { session: { status: "closed" } },
    select: { exerciseId: true },
    take: 2000,
    orderBy: { completedAt: "desc" },
  });

  const grupoDe = new Map(ejercicios.map((e) => [e.id, e.muscleGroup]));
  const usos = new Map<string, number>();
  for (const { exerciseId } of series) {
    const grupo = grupoDe.get(exerciseId);
    if (grupo) usos.set(grupo, (usos.get(grupo) ?? 0) + 1);
  }

  const cuenta = new Map<string, number>();
  for (const { muscleGroup } of ejercicios) {
    if (muscleGroup) cuenta.set(muscleGroup, (cuenta.get(muscleGroup) ?? 0) + 1);
  }

  // Cuántas máquinas de cada grupo ya tienen foto. Es el avance de un catálogo
  // que se construye yendo al gimnasio: sin esto no hay forma de saber qué
  // grupo te falta por fotografiar sin entrar en cada uno.
  const conFoto = await db.assetLink.findMany({
    where: { exerciseId: { not: null }, predicate: "photo_of", asset: { status: "active" } },
    select: { exerciseId: true },
  });
  const fotos = new Map<string, number>();
  for (const { exerciseId } of conFoto) {
    const grupo = exerciseId ? grupoDe.get(exerciseId) : null;
    if (grupo) fotos.set(grupo, (fotos.get(grupo) ?? 0) + 1);
  }

  return [...new Set([...GRUPOS, ...cuenta.keys()])]
    .map((group) => ({
      group,
      exerciseCount: cuenta.get(group) ?? 0,
      timesTrained: usos.get(group) ?? 0,
      photoCount: fotos.get(group) ?? 0,
    }))
    .filter((g) => g.exerciseCount > 0)
    .sort((a, b) => b.timesTrained - a.timesTrained || a.group.localeCompare(b.group));
}

/**
 * Ejercicios de un grupo, los tuyos primero.
 *
 * Cada uno trae su última serie, así que eliges viendo por dónde ibas sin
 * tener que entrar a mirarlo.
 */
export async function exercisesInGroup(
  group: string,
  options: { excludeSessionId?: string } = {},
): Promise<ExerciseSuggestion[]> {
  const ejercicios = await db.exercise.findMany({
    where: { status: "active", muscleGroup: group },
    orderBy: { createdAt: "asc" },
  });
  if (ejercicios.length === 0) return [];

  const ids = ejercicios.map((e) => e.id);
  const series = await db.exerciseSet.findMany({
    where: {
      exerciseId: { in: ids },
      session: { status: "closed" },
      setType: { not: "warmup" },
      ...(options.excludeSessionId
        ? { sessionId: { not: options.excludeSessionId } }
        : {}),
    },
    orderBy: { completedAt: "desc" },
    take: 800,
    select: {
      exerciseId: true, sessionId: true, reps: true, weightKg: true, completedAt: true,
    },
  });

  const porEjercicio = new Map<string, typeof series>();
  for (const s of series) {
    const lista = porEjercicio.get(s.exerciseId) ?? [];
    lista.push(s);
    porEjercicio.set(s.exerciseId, lista);
  }

  return ejercicios
    .map((ejercicio) => {
      const suyas = porEjercicio.get(ejercicio.id) ?? [];
      const ultimaSesion = suyas[0]?.sessionId;
      const deEsaSesion = suyas
        .filter((s) => s.sessionId === ultimaSesion)
        .sort((a, b) => a.completedAt.getTime() - b.completedAt.getTime());

      return {
        id: ejercicio.id,
        name: ejercicio.name,
        muscleGroup: ejercicio.muscleGroup,
        equipment: ejercicio.equipment,
        timesLogged: suyas.length,
        lastSets: deEsaSesion.length
          ? deEsaSesion.map((s) => `${s.weightKg ?? "?"}×${s.reps ?? "?"}`).join(", ")
          : null,
      };
    })
    .sort((a, b) => b.timesLogged - a.timesLogged);
}

/** El grupo del último ejercicio de la sesión: el que se queda pegado. */
export async function stickyGroup(sessionId: string): Promise<string | null> {
  const ultima = await db.exerciseSet.findFirst({
    where: { sessionId },
    orderBy: { completedAt: "desc" },
    select: { exercise: { select: { muscleGroup: true } } },
  });
  return ultima?.exercise.muscleGroup ?? null;
}
