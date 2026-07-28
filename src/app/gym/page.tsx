import Link from "next/link";
import { ActiveSession } from "@/components/gym/active-session";
import { StartWorkout } from "@/components/gym/start-workout";
import { getExercises, getOpenSession, getRoutines, lastSetsFor } from "@/lib/gym/queries";

export const dynamic = "force-dynamic";

export default async function GymPage() {
  const sesion = await getOpenSession();

  if (!sesion) {
    const [rutinas, ejercicios] = await Promise.all([getRoutines(), getExercises()]);
    return (
      <Shell>
        <StartWorkout
          routines={rutinas.map((r) => ({
            id: r.id,
            name: r.name,
            objective: r.objective,
            exercises: r.exercises.map((e) => e.exercise.name),
          }))}
          exerciseCount={ejercicios.length}
        />
      </Shell>
    );
  }

  // Los ejercicios de la sesión: los ya registrados más los que trae la rutina.
  const enSesion = new Map<string, { id: string; name: string; muscleGroup: string | null }>();
  for (const set of sesion.sets) {
    enSesion.set(set.exerciseId, {
      id: set.exercise.id,
      name: set.exercise.name,
      muscleGroup: set.exercise.muscleGroup,
    });
  }
  if (sesion.routineId) {
    const rutinas = await getRoutines();
    const rutina = rutinas.find((r) => r.id === sesion.routineId);
    for (const item of rutina?.exercises ?? []) {
      if (!enSesion.has(item.exerciseId)) {
        enSesion.set(item.exerciseId, {
          id: item.exercise.id,
          name: item.exercise.name,
          muscleGroup: item.exercise.muscleGroup,
        });
      }
    }
  }

  // LA consulta de ADR-109, una por ejercicio de la sesión.
  const ejercicios = await Promise.all(
    [...enSesion.values()].map(async (ejercicio) => ({
      ...ejercicio,
      previous: await lastSetsFor(ejercicio.id, { excludeSessionId: sesion.id }),
      sets: sesion.sets
        .filter((s) => s.exerciseId === ejercicio.id)
        .map((s) => ({
          id: s.id,
          setIndex: s.setIndex,
          reps: s.reps,
          weightKg: s.weightKg,
          rir: s.rir,
          setType: s.setType,
        })),
    })),
  );

  const todos = await getExercises();

  return (
    <Shell>
      <ActiveSession
        sessionId={sesion.id}
        routineName={sesion.routine?.name ?? null}
        startedAt={sesion.startedAt.toISOString()}
        exercises={ejercicios}
        allExercises={todos.map((e) => ({
          id: e.id,
          name: e.name,
          muscleGroup: e.muscleGroup,
        }))}
      />
    </Shell>
  );
}

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <main className="mx-auto min-h-screen w-full max-w-2xl px-5 py-8 sm:py-12">
      <header className="mb-8 flex items-baseline justify-between">
        <h1 className="text-2xl font-semibold tracking-tight">Gimnasio</h1>
        <Link href="/" className="text-sm text-muted hover:text-foreground">
          ← Hoy
        </Link>
      </header>
      {children}
    </main>
  );
}
