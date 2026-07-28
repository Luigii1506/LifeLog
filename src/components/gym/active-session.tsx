"use client";

import { useState, useTransition } from "react";
import {
  addSet,
  cancelWorkout,
  createExercise,
  finishWorkout,
  removeSet,
} from "@/app/gym/actions";

type SetRow = {
  id: string;
  setIndex: number;
  reps: number | null;
  weightKg: number | null;
  rir: number | null;
  setType: string;
};

type PreviousSet = {
  setIndex: number;
  reps: number | null;
  weightKg: number | null;
  rir: number | null;
  setType: string;
};

type ExerciseCard = {
  id: string;
  name: string;
  muscleGroup: string | null;
  previous: { sessionId: string; date: Date | string; sets: PreviousSet[] } | null;
  sets: SetRow[];
};

export function ActiveSession({
  sessionId,
  routineName,
  startedAt,
  exercises,
  allExercises,
}: {
  sessionId: string;
  routineName: string | null;
  startedAt: string;
  exercises: ExerciseCard[];
  allExercises: { id: string; name: string; muscleGroup: string | null }[];
}) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [prs, setPrs] = useState<string[] | null>(null);
  const [añadiendo, setAñadiendo] = useState(false);

  const volumen = exercises
    .flatMap((e) => e.sets)
    .filter((s) => s.setType !== "warmup")
    .reduce((sum, s) => sum + (s.reps ?? 0) * (s.weightKg ?? 0), 0);
  const series = exercises.flatMap((e) => e.sets).filter((s) => s.setType !== "warmup").length;

  function run(fn: () => Promise<{ ok: boolean; error?: string }>) {
    startTransition(async () => {
      setError(null);
      const r = await fn();
      if (!r.ok) setError(r.error ?? "Error");
    });
  }

  if (prs) {
    return (
      <div className="space-y-4 rounded-xl border border-line bg-surface p-6">
        <h2 className="text-lg font-medium">Entrenamiento cerrado</h2>
        {prs.length > 0 ? (
          <div>
            <p className="text-sm text-muted">Récords nuevos:</p>
            <ul className="mt-1 space-y-1">
              {prs.map((pr) => (
                <li key={pr} className="font-medium text-accent">
                  {pr}
                </li>
              ))}
            </ul>
          </div>
        ) : (
          <p className="text-sm text-muted">Sin récords esta vez.</p>
        )}
        <a href="/gym" className="block text-sm text-muted hover:text-foreground">
          Empezar otro →
        </a>
      </div>
    );
  }

  const noEnSesion = allExercises.filter((e) => !exercises.some((x) => x.id === e.id));

  return (
    <div className="space-y-4">
      <header className="rounded-xl border border-line bg-surface p-4">
        <div className="flex items-baseline justify-between">
          <div className="font-medium">{routineName ?? "Entrenamiento libre"}</div>
          <time className="font-mono text-sm tabular-nums text-muted">
            {new Date(startedAt).toLocaleTimeString("es-MX", {
              hour: "2-digit",
              minute: "2-digit",
              hour12: false,
            })}
          </time>
        </div>
        <div className="mt-1 text-sm text-muted">
          {series} {series === 1 ? "serie" : "series"} ·{" "}
          {Math.round(volumen).toLocaleString("es-MX")} kg de volumen
        </div>
      </header>

      {exercises.map((ejercicio) => (
        <ExerciseBlock
          key={ejercicio.id}
          sessionId={sessionId}
          exercise={ejercicio}
          pending={pending}
          onAdd={(data) => run(() => addSet(data))}
          onRemove={(setId) => run(() => removeSet(setId))}
        />
      ))}

      {añadiendo ? (
        <AddExercise
          candidates={noEnSesion}
          pending={pending}
          onPick={(exerciseId) => {
            setAñadiendo(false);
            run(() =>
              addSet({ sessionId, exerciseId, weightKg: null, reps: null, rir: null }),
            );
          }}
          onCreate={(name, muscleGroup) => {
            setAñadiendo(false);
            startTransition(async () => {
              const creado = await createExercise(name, muscleGroup);
              if (!creado.ok || !creado.id) {
                setError(creado.ok ? "No se pudo crear" : creado.error);
                return;
              }
              const r = await addSet({
                sessionId,
                exerciseId: creado.id,
                weightKg: null,
                reps: null,
                rir: null,
              });
              if (!r.ok) setError(r.error);
            });
          }}
          onCancel={() => setAñadiendo(false)}
        />
      ) : (
        <button
          disabled={pending}
          onClick={() => setAñadiendo(true)}
          className="w-full rounded-xl border border-dashed border-line py-4 text-muted transition active:scale-[0.99] disabled:opacity-50"
        >
          + Añadir ejercicio
        </button>
      )}

      {error && (
        <p className="text-sm text-accent" role="status">
          {error}
        </p>
      )}

      <div className="flex gap-2 pt-2">
        <button
          disabled={pending}
          onClick={() =>
            startTransition(async () => {
              const r = await finishWorkout(sessionId, null);
              if (r.ok) setPrs(r.prs ?? []);
              else setError(r.error);
            })
          }
          className="flex-1 rounded-xl bg-accent px-4 py-4 font-medium text-white transition active:scale-[0.98] disabled:opacity-50"
        >
          Terminar entrenamiento
        </button>
        {series === 0 && (
          <button
            disabled={pending}
            onClick={() => run(() => cancelWorkout(sessionId))}
            className="rounded-xl border border-line px-4 py-4 text-muted transition active:scale-[0.98] disabled:opacity-50"
          >
            Descartar
          </button>
        )}
      </div>
    </div>
  );
}

function ExerciseBlock({
  sessionId,
  exercise,
  pending,
  onAdd,
  onRemove,
}: {
  sessionId: string;
  exercise: ExerciseCard;
  pending: boolean;
  onAdd: (data: {
    sessionId: string;
    exerciseId: string;
    weightKg: number | null;
    reps: number | null;
    rir: number | null;
  }) => void;
  onRemove: (setId: string) => void;
}) {
  const registradas = exercise.sets.filter((s) => s.reps !== null || s.weightKg !== null);
  const anterior = exercise.previous;

  // El peso por defecto: el de la última serie de hoy, si no el de la sesión
  // anterior. Copiar es el caso normal; escribir de cero es la excepción.
  const ultimaHoy = registradas.at(-1);
  const sugerido =
    ultimaHoy?.weightKg ?? anterior?.sets.at(registradas.length)?.weightKg ??
    anterior?.sets.at(-1)?.weightKg ?? null;
  const repsSugeridas = anterior?.sets.at(registradas.length)?.reps ?? null;

  return (
    <section className="rounded-xl border border-line bg-surface p-4">
      <div className="flex items-baseline justify-between">
        <h3 className="font-medium">{exercise.name}</h3>
        {exercise.muscleGroup && (
          <span className="text-xs text-muted">{exercise.muscleGroup}</span>
        )}
      </div>

      {anterior && anterior.sets.length > 0 ? (
        <p className="mt-1 font-mono text-sm text-muted">
          Anterior:{" "}
          {anterior.sets
            .map((s) => `${s.weightKg ?? "?"} × ${s.reps ?? "?"}`)
            .join(", ")}
        </p>
      ) : (
        <p className="mt-1 text-sm text-muted">Primera vez</p>
      )}

      {registradas.length > 0 && (
        <ol className="mt-3 space-y-1">
          {registradas.map((set) => (
            <li key={set.id} className="flex items-center gap-3 font-mono text-sm">
              <span className="w-4 text-muted">{set.setIndex}</span>
              <span className="tabular-nums">
                {set.weightKg ?? "—"} kg × {set.reps ?? "—"}
              </span>
              {set.rir !== null && <span className="text-muted">RIR {set.rir}</span>}
              {set.setType === "warmup" && (
                <span className="text-xs text-muted">calent.</span>
              )}
              <button
                onClick={() => onRemove(set.id)}
                disabled={pending}
                className="ml-auto text-muted hover:text-accent disabled:opacity-50"
                aria-label={`Borrar serie ${set.setIndex}`}
              >
                ×
              </button>
            </li>
          ))}
        </ol>
      )}

      <form
        className="mt-3 flex gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          const data = new FormData(e.currentTarget);
          const num = (k: string) => {
            const v = data.get(k);
            return v === null || v === "" ? null : Number(v);
          };
          onAdd({
            sessionId,
            exerciseId: exercise.id,
            weightKg: num("weightKg"),
            reps: num("reps"),
            rir: num("rir"),
          });
          e.currentTarget.reset();
        }}
      >
        <NumField name="weightKg" label="kg" defaultValue={sugerido} step="0.5" />
        <NumField name="reps" label="reps" defaultValue={repsSugeridas} />
        <NumField name="rir" label="RIR" defaultValue={null} />
        <button
          type="submit"
          disabled={pending}
          className="shrink-0 rounded-lg bg-foreground px-4 font-medium text-background disabled:opacity-50"
        >
          +
        </button>
      </form>
    </section>
  );
}

function NumField({
  name,
  label,
  defaultValue,
  step,
}: {
  name: string;
  label: string;
  defaultValue: number | null;
  step?: string;
}) {
  return (
    <label className="min-w-0 flex-1">
      <span className="mb-1 block text-xs tracking-wide text-muted uppercase">
        {label}
      </span>
      <input
        key={String(defaultValue)}
        name={name}
        type="number"
        step={step}
        inputMode="decimal"
        defaultValue={defaultValue ?? ""}
        className="w-full rounded-lg border border-line bg-background px-2 py-3 text-center tabular-nums outline-none focus:border-accent"
      />
    </label>
  );
}

function AddExercise({
  candidates,
  pending,
  onPick,
  onCreate,
  onCancel,
}: {
  candidates: { id: string; name: string; muscleGroup: string | null }[];
  pending: boolean;
  onPick: (id: string) => void;
  onCreate: (name: string, muscleGroup: string | null) => void;
  onCancel: () => void;
}) {
  const [filtro, setFiltro] = useState("");
  const visibles = candidates.filter((c) =>
    c.name.toLowerCase().includes(filtro.trim().toLowerCase()),
  );
  const exacto = candidates.some(
    (c) => c.name.toLowerCase() === filtro.trim().toLowerCase(),
  );

  return (
    <div className="space-y-2 rounded-xl border border-line bg-surface p-4">
      <input
        autoFocus
        value={filtro}
        onChange={(e) => setFiltro(e.target.value)}
        placeholder="Buscar o crear ejercicio"
        className="w-full rounded-lg border border-line bg-background px-3 py-3 outline-none focus:border-accent"
      />

      <div className="max-h-64 space-y-1 overflow-y-auto">
        {visibles.map((c) => (
          <button
            key={c.id}
            disabled={pending}
            onClick={() => onPick(c.id)}
            className="flex w-full items-baseline justify-between rounded-lg px-3 py-2 text-left hover:bg-background disabled:opacity-50"
          >
            <span>{c.name}</span>
            {c.muscleGroup && <span className="text-xs text-muted">{c.muscleGroup}</span>}
          </button>
        ))}
      </div>

      {filtro.trim() && !exacto && (
        <button
          disabled={pending}
          onClick={() => onCreate(filtro.trim(), null)}
          className="w-full rounded-lg border border-dashed border-line py-3 text-sm text-muted disabled:opacity-50"
        >
          Crear «{filtro.trim()}»
        </button>
      )}

      <button onClick={onCancel} className="w-full py-2 text-sm text-muted">
        Cancelar
      </button>
    </div>
  );
}
