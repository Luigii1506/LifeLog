"use client";

import { useState, useTransition } from "react";
import { startWorkout } from "@/app/gym/actions";

type Routine = {
  id: string;
  name: string;
  objective: string | null;
  exercises: string[];
};

export function StartWorkout({
  routines,
  exerciseCount,
}: {
  routines: Routine[];
  exerciseCount: number;
}) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function comenzar(routineId: string | null) {
    startTransition(async () => {
      const result = await startWorkout(routineId);
      if (!result.ok) setError(result.error);
    });
  }

  return (
    <div className="space-y-6">
      {routines.length > 0 && (
        <section className="space-y-2">
          <h2 className="text-xs font-medium tracking-[0.12em] text-muted uppercase">
            Rutinas
          </h2>
          {routines.map((rutina) => (
            <button
              key={rutina.id}
              disabled={pending}
              onClick={() => comenzar(rutina.id)}
              className="w-full rounded-xl border border-line bg-surface p-4 text-left transition active:scale-[0.99] disabled:opacity-50"
            >
              <div className="font-medium">{rutina.name}</div>
              {rutina.objective && (
                <div className="mt-0.5 text-sm text-muted">{rutina.objective}</div>
              )}
              {rutina.exercises.length > 0 && (
                <div className="mt-2 text-sm text-muted">
                  {rutina.exercises.slice(0, 4).join(" · ")}
                  {rutina.exercises.length > 4 && ` · +${rutina.exercises.length - 4}`}
                </div>
              )}
            </button>
          ))}
        </section>
      )}

      <button
        disabled={pending}
        onClick={() => comenzar(null)}
        className="w-full rounded-xl bg-accent px-4 py-4 text-base font-medium text-white transition active:scale-[0.98] disabled:opacity-50"
      >
        {pending ? "Empezando…" : "Entrenamiento libre"}
      </button>

      {error && (
        <p className="text-sm text-accent" role="status">
          {error}
        </p>
      )}

      {routines.length === 0 && (
        <p className="text-sm text-muted">
          Aún no hay rutinas. Empieza un entrenamiento libre y añade los
          ejercicios sobre la marcha
          {exerciseCount > 0 && ` — hay ${exerciseCount} en el catálogo`}.
        </p>
      )}
    </div>
  );
}
