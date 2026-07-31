import { GuidedWorkout } from "@/components/gym/guided-workout";
import { StartWorkout } from "@/components/gym/start-workout";
import { getOpenSession, getRoutines } from "@/lib/gym/queries";
import { exercisesInGroup, musclegroupSummary, stickyGroup } from "@/lib/gym/suggestions";
import { exercisePhotos } from "@/lib/assets/asset";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";

/**
 * Gimnasio.
 *
 * La sesión NO existe hasta la primera serie. Elegir grupo y mirar ejercicios
 * no abre nada: antes sí, y eso convertía «a ver qué hay de pecho» en un
 * entrenamiento empezado —cronómetro corriendo, sesión bloqueando otra, y
 * sesiones guardadas sin una sola serie.
 *
 * Por eso la pantalla se decide por los PARÁMETROS de la URL antes que por la
 * sesión: `?grupo=pecho` enseña los ejercicios de pecho haya sesión o no.
 */
export default async function GymPage({
  searchParams,
}: {
  searchParams: Promise<{ grupo?: string; ejercicio?: string }>;
}) {
  const { grupo, ejercicio } = await searchParams;
  const sesion = await getOpenSession();

  const enCurso = ejercicio
    ? await db.exercise.findUnique({ where: { id: ejercicio } })
    : null;

  // El grupo se queda pegado: sin parámetro en la URL se toma el del último
  // ejercicio de la sesión. Acabar pecho y volver a elegir grupo desde cero
  // sería pedirle al usuario que repita algo que el sistema ya sabe.
  //
  // `?grupo=` vacío es distinto de ausente: es la forma de PEDIR el selector.
  // Sin esa distinción, «Cambiar grupo» rebotaría al mismo grupo para siempre.
  const grupoActivo =
    grupo !== undefined
      ? grupo || null
      : (enCurso?.muscleGroup ?? (sesion ? await stickyGroup(sesion.id) : null));

  // Sin grupo ni ejercicio elegidos no hay nada que enseñar salvo por dónde
  // empezar. Da igual que haya sesión: si la hay, la píldora de arriba lo dice.
  if (!grupoActivo && !enCurso) {
    const [rutinas, grupos] = await Promise.all([getRoutines(), musclegroupSummary()]);
    return (
      <Shell>
        <StartWorkout
          groups={grupos}
          routines={rutinas.map((r) => ({
            id: r.id,
            name: r.name,
            objective: r.objective,
            exercises: r.exercises.map((e) => e.exercise.name),
            firstGroup: r.exercises[0]?.exercise.muscleGroup ?? null,
          }))}
        />
      </Shell>
    );
  }

  const [grupos, ejerciciosDelGrupo] = await Promise.all([
    musclegroupSummary(),
    grupoActivo
      ? exercisesInGroup(grupoActivo, { excludeSessionId: sesion?.id })
      : Promise.resolve([]),
  ]);

  // Las fotos se resuelven en UNA consulta para todos los ejercicios visibles,
  // no una por tarjeta. Con el arranque en frío de Neon, diez viajes de ida y
  // vuelta se notan más que la propia descarga de las imágenes.
  const fotos = await exercisePhotos([
    ...ejerciciosDelGrupo.map((e) => e.id),
    ...(enCurso ? [enCurso.id] : []),
  ]);

  const series = sesion?.sets ?? [];

  const seriesDeEsteEjercicio = enCurso
    ? series
        .filter((s) => s.exerciseId === enCurso.id)
        .sort((a, b) => a.setIndex - b.setIndex)
        .map((s) => ({
          id: s.id,
          setIndex: s.setIndex,
          reps: s.reps,
          weightKg: s.weightKg,
          rir: s.rir,
        }))
    : [];

  // Los ejercicios trabajados, en orden y sin repetir, para el resumen previo
  // a cerrar. La pregunta al terminar no es «¿seguro?» sino «¿me falta algo?».
  const nombres = new Map(
    (
      await db.exercise.findMany({
        where: { id: { in: [...new Set(series.map((s) => s.exerciseId))] } },
        select: { id: true, name: true },
      })
    ).map((e) => [e.id, e.name]),
  );
  const trabajados: string[] = [];
  for (const s of series) {
    const nombre = nombres.get(s.exerciseId);
    if (nombre && !trabajados.includes(nombre)) trabajados.push(nombre);
  }

  const trabajo = series.filter((s) => s.setType !== "warmup");
  const totals = {
    setCount: trabajo.length,
    volumeKg: trabajo.reduce((sum, s) => sum + (s.reps ?? 0) * (s.weightKg ?? 0), 0),
  };

  const tarjetaEnCurso = enCurso
    ? {
        id: enCurso.id,
        name: enCurso.name,
        equipment: enCurso.equipment,
        timesLogged: 0,
        photoUrl: fotos[enCurso.id] ?? null,
        lastSets:
          ejerciciosDelGrupo.find((e) => e.id === enCurso.id)?.lastSets ?? null,
      }
    : null;

  return (
    <Shell>
      <GuidedWorkout
        groups={grupos}
        initialGroup={grupoActivo}
        exercises={ejerciciosDelGrupo.map((e) => ({
          id: e.id,
          name: e.name,
          equipment: e.equipment,
          timesLogged: e.timesLogged,
          lastSets: e.lastSets,
          photoUrl: fotos[e.id] ?? null,
        }))}
        currentExercise={tarjetaEnCurso}
        sets={seriesDeEsteEjercicio}
        totals={totals}
        // Nulos mientras no haya sesión: la píldora de «en curso» y el botón de
        // terminar solo tienen sentido cuando hay algo que terminar.
        sessionId={sesion?.id ?? null}
        startedAt={sesion?.startedAt.toISOString() ?? null}
        initialMinutes={
          sesion
            ? Math.max(0, Math.floor((Date.now() - sesion.startedAt.getTime()) / 60000))
            : 0
        }
        workedExercises={trabajados}
      />
    </Shell>
  );
}

function Shell({ children }: { children: React.ReactNode }) {
  return <main className="py-4">{children}</main>;
}
