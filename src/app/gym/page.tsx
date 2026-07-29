import Link from "next/link";
import { GuidedWorkout } from "@/components/gym/guided-workout";
import { StartWorkout } from "@/components/gym/start-workout";
import { getOpenSession, getRoutines } from "@/lib/gym/queries";
import { exercisesInGroup, musclegroupSummary, stickyGroup } from "@/lib/gym/suggestions";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";

export default async function GymPage({
  searchParams,
}: {
  searchParams: Promise<{ grupo?: string; ejercicio?: string }>;
}) {
  const { grupo, ejercicio } = await searchParams;
  const sesion = await getOpenSession();

  if (!sesion) {
    const rutinas = await getRoutines();
    return (
      <Shell>
        <StartWorkout
          routines={rutinas.map((r) => ({
            id: r.id,
            name: r.name,
            objective: r.objective,
            exercises: r.exercises.map((e) => e.exercise.name),
          }))}
          exerciseCount={await db.exercise.count({ where: { status: "active" } })}
        />
      </Shell>
    );
  }

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
      : (enCurso?.muscleGroup ?? (await stickyGroup(sesion.id)));

  const [grupos, ejerciciosDelGrupo] = await Promise.all([
    musclegroupSummary(),
    grupoActivo
      ? exercisesInGroup(grupoActivo, { excludeSessionId: sesion.id })
      : Promise.resolve([]),
  ]);

  const seriesDeEsteEjercicio = enCurso
    ? sesion.sets
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

  const trabajo = sesion.sets.filter((s) => s.setType !== "warmup");
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
        lastSets:
          ejerciciosDelGrupo.find((e) => e.id === enCurso.id)?.lastSets ?? null,
      }
    : null;

  return (
    <Shell>
      <GuidedWorkout
        sessionId={sesion.id}
        groups={grupos}
        initialGroup={grupoActivo}
        exercises={ejerciciosDelGrupo.map((e) => ({
          id: e.id,
          name: e.name,
          equipment: e.equipment,
          timesLogged: e.timesLogged,
          lastSets: e.lastSets,
        }))}
        currentExercise={tarjetaEnCurso}
        sets={seriesDeEsteEjercicio}
        totals={totals}
      />
    </Shell>
  );
}

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <main className="mx-auto min-h-screen w-full max-w-2xl px-5 py-8">
      <header className="mb-5 flex items-baseline justify-between">
        <h1 className="text-sm font-medium tracking-[0.12em] text-muted uppercase">
          🏋️ Gimnasio
        </h1>
        <Link href="/" className="text-sm text-muted hover:text-foreground">
          Hoy
        </Link>
      </header>
      {children}
    </main>
  );
}
