"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { addSet, createExercise, finishWorkout, removeSet } from "@/app/gym/actions";
import { VoiceButton } from "@/components/guided/voice-button";
import { parseSpokenSet } from "@/lib/gym/parse-spoken-set";
import { matchOption } from "@/lib/match-option";

export type ExerciseCard = {
  id: string;
  name: string;
  equipment: string | null;
  timesLogged: number;
  lastSets: string | null;
};

export type GroupCard = { group: string; exerciseCount: number; timesTrained: number };

type SetRow = {
  id: string;
  setIndex: number;
  reps: number | null;
  weightKg: number | null;
  rir: number | null;
};

/**
 * Registro de entrenamiento paso a paso.
 *
 * grupo → ejercicio → series → «otro ejercicio» VUELVE AL MISMO GRUPO.
 *
 * Ese retorno es el detalle que decide si la app estorba: si acabas de hacer
 * press de banca, lo siguiente casi seguro es otro ejercicio de pecho, no
 * elegir grupo otra vez desde cero.
 */
export function GuidedWorkout({
  sessionId,
  groups,
  initialGroup,
  exercises,
  currentExercise,
  sets,
  totals,
}: {
  sessionId: string;
  groups: GroupCard[];
  initialGroup: string | null;
  /** Ejercicios del grupo seleccionado, ya calculados en el servidor. */
  exercises: ExerciseCard[];
  currentExercise: ExerciseCard | null;
  sets: SetRow[];
  totals: { setCount: number; volumeKg: number };
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [prs, setPrs] = useState<string[] | null>(null);

  function run(fn: () => Promise<{ ok: boolean; error?: string }>) {
    setError(null);
    startTransition(async () => {
      const r = await fn();
      if (!r.ok) setError(r.error ?? "Error");
    });
  }

  if (prs) return <Resumen prs={prs} totals={totals} />;

  // ── Paso 3: registrando series de un ejercicio ────────────────────
  if (currentExercise) {
    return (
      <Marco
        totals={totals}
        error={error}
        onFinish={() =>
          startTransition(async () => {
            const r = await finishWorkout(sessionId, null);
            if (r.ok) setPrs(r.prs ?? []);
            else setError(r.error);
          })
        }
        pending={pending}
      >
        <SetLogger
          sessionId={sessionId}
          exercise={currentExercise}
          sets={sets}
          pending={pending}
          onAdd={(d) => run(() => addSet({ sessionId, exerciseId: currentExercise.id, ...d }))}
          onRemove={(id) => run(() => removeSet(id))}
          onNext={() => router.push(`/gym?grupo=${encodeURIComponent(initialGroup ?? "")}`)}
        />
      </Marco>
    );
  }

  // ── Paso 2: elegir ejercicio dentro del grupo ─────────────────────
  if (initialGroup) {
    return (
      <Marco totals={totals} error={error} pending={pending}>
        <ExercisePicker
          group={initialGroup}
          exercises={exercises}
          pending={pending}
          onPick={(id) => router.push(`/gym?ejercicio=${id}`)}
          onCreate={(nombre) =>
            startTransition(async () => {
              const creado = await createExercise(nombre, initialGroup);
              if (!creado.ok || !creado.id) {
                setError(creado.ok ? "No se pudo crear" : creado.error);
                return;
              }
              router.push(`/gym?ejercicio=${creado.id}`);
            })
          }
          onBack={() => router.push("/gym?grupo=")}
        />
      </Marco>
    );
  }

  // ── Paso 1: elegir grupo muscular ─────────────────────────────────
  return (
    <Marco totals={totals} error={error} pending={pending}>
      <h2 className="mb-3 text-xl font-semibold tracking-tight">
        ¿Qué vas a trabajar?
      </h2>
      <div className="mb-3">
        <VoiceButton
          idleLabel="Dilo · «espalda»"
          onTranscript={(texto) => {
            const elegido = matchOption(
              texto,
              groups.map((g) => ({ value: g.group, label: g.group })),
            );
            if (!elegido) return false;
            router.push(`/gym?grupo=${encodeURIComponent(elegido.value)}`);
            return true;
          }}
        />
      </div>
      <div className="grid grid-cols-2 gap-2">
        {groups.map((g) => (
          <button
            key={g.group}
            disabled={pending}
            onClick={() => router.push(`/gym?grupo=${encodeURIComponent(g.group)}`)}
            className="rounded-xl border border-line bg-surface p-5 text-left transition active:scale-[0.97] disabled:opacity-50"
          >
            <span className="block text-lg font-medium capitalize">{g.group}</span>
            <span className="mt-0.5 block text-xs text-muted">
              {g.exerciseCount} ejercicios
              {g.timesTrained > 0 && ` · ${g.timesTrained} series`}
            </span>
          </button>
        ))}
      </div>
    </Marco>
  );
}

function Marco({
  children,
  totals,
  error,
  onFinish,
  pending,
}: {
  children: React.ReactNode;
  totals: { setCount: number; volumeKg: number };
  error: string | null;
  onFinish?: () => void;
  pending: boolean;
}) {
  return (
    <div className="space-y-4">
      <header className="flex items-baseline justify-between rounded-xl border border-line bg-surface px-4 py-3">
        <span className="text-sm text-muted">
          {totals.setCount} {totals.setCount === 1 ? "serie" : "series"}
        </span>
        <span className="font-mono text-sm tabular-nums text-muted">
          {Math.round(totals.volumeKg).toLocaleString("es-MX")} kg
        </span>
      </header>

      {children}

      {error && (
        <p role="status" className="rounded-lg bg-accent px-4 py-3 text-center font-medium text-white">
          {error}
        </p>
      )}

      {onFinish && (
        <button
          onClick={onFinish}
          disabled={pending}
          className="w-full rounded-xl border border-line py-4 text-muted transition active:scale-[0.98] disabled:opacity-50"
        >
          Terminar entrenamiento
        </button>
      )}
    </div>
  );
}

function ExercisePicker({
  group,
  exercises,
  pending,
  onPick,
  onCreate,
  onBack,
}: {
  group: string;
  exercises: ExerciseCard[];
  pending: boolean;
  onPick: (id: string) => void;
  onCreate: (nombre: string) => void;
  onBack: () => void;
}) {
  const [filtro, setFiltro] = useState("");
  const normaliza = (s: string) =>
    s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");

  const visibles = exercises.filter((e) =>
    normaliza(e.name).includes(normaliza(filtro.trim())),
  );
  const exacto = exercises.some((e) => normaliza(e.name) === normaliza(filtro.trim()));

  return (
    <div className="space-y-3">
      <div className="flex items-baseline justify-between">
        <h2 className="text-xl font-semibold tracking-tight capitalize">{group}</h2>
        <button onClick={onBack} className="text-sm text-muted">
          Cambiar grupo
        </button>
      </div>

      <VoiceButton
        lang="es-MX"
        idleLabel="Di el ejercicio"
        onTranscript={(texto) => {
          const encontrado = matchOption(
            texto,
            exercises.map((e) => ({ value: e.id, label: e.name })),
          );
          if (encontrado) {
            onPick(encontrado.value);
            return true;
          }
          // Sin coincidencia clara, lo dicho pasa al buscador: se ve lo que
          // entendió y se elige a mano en vez de registrar otro ejercicio.
          setFiltro(texto);
          return false;
        }}
      />

      <input
        value={filtro}
        onChange={(e) => setFiltro(e.target.value)}
        placeholder="Buscar"
        className="w-full rounded-xl border border-line bg-background px-4 py-3 outline-none focus:border-accent"
      />

      <div className="space-y-2">
        {visibles.map((ejercicio) => (
          <button
            key={ejercicio.id}
            disabled={pending}
            onClick={() => onPick(ejercicio.id)}
            className="w-full rounded-xl border border-line bg-surface p-4 text-left transition active:scale-[0.98] disabled:opacity-50"
          >
            <div className="flex items-baseline justify-between gap-3">
              <span className="font-medium">{ejercicio.name}</span>
              {ejercicio.equipment && (
                <span className="shrink-0 text-xs text-muted">{ejercicio.equipment}</span>
              )}
            </div>
            {ejercicio.lastSets && (
              <div className="mt-1 font-mono text-sm text-muted">
                Anterior: {ejercicio.lastSets}
              </div>
            )}
          </button>
        ))}
      </div>

      {filtro.trim() && !exacto && (
        <button
          disabled={pending}
          onClick={() => onCreate(filtro.trim())}
          className="w-full rounded-xl border border-dashed border-line py-4 text-muted disabled:opacity-50"
        >
          Crear «{filtro.trim()}» en {group}
        </button>
      )}
    </div>
  );
}

function SetLogger({
  exercise,
  sets,
  pending,
  onAdd,
  onRemove,
  onNext,
}: {
  sessionId: string;
  exercise: ExerciseCard;
  sets: SetRow[];
  pending: boolean;
  onAdd: (d: { weightKg: number | null; reps: number | null; rir: number | null }) => void;
  onRemove: (id: string) => void;
  onNext: () => void;
}) {
  const [peso, setPeso] = useState<string>("");
  const [reps, setReps] = useState<string>("");
  const [rir, setRir] = useState<string>("");
  const pesoRef = useRef<HTMLInputElement>(null);

  // El peso de la última serie: entre series casi nunca cambia.
  const ultima = sets.at(-1);
  useEffect(() => {
    if (peso === "" && ultima?.weightKg != null) setPeso(String(ultima.weightKg));
  }, [ultima?.weightKg, peso]);

  const num = (v: string) => {
    const n = Number(v.replace(",", "."));
    return v.trim() === "" || !Number.isFinite(n) ? null : n;
  };

  function registrar() {
    if (num(reps) === null && num(peso) === null) return;
    onAdd({ weightKg: num(peso), reps: num(reps), rir: num(rir) });
    setReps("");
    setRir("");
    pesoRef.current?.blur();
  }

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-xl font-semibold tracking-tight">{exercise.name}</h2>
        {exercise.lastSets ? (
          <p className="mt-1 font-mono text-sm text-muted">
            Anterior: {exercise.lastSets}
          </p>
        ) : (
          <p className="mt-1 text-sm text-muted">Primera vez</p>
        )}
      </div>

      {sets.length > 0 && (
        <ol className="space-y-1 rounded-xl border border-line bg-surface p-4">
          {sets.map((s) => (
            <li key={s.id} className="flex items-center gap-3 font-mono text-sm">
              <span className="w-4 text-muted">{s.setIndex}</span>
              <span className="tabular-nums">
                {s.weightKg ?? "—"} kg × {s.reps ?? "—"}
              </span>
              {s.rir !== null && <span className="text-muted">RIR {s.rir}</span>}
              <button
                onClick={() => onRemove(s.id)}
                disabled={pending}
                className="ml-auto text-muted hover:text-accent disabled:opacity-50"
                aria-label={`Borrar serie ${s.setIndex}`}
              >
                ×
              </button>
            </li>
          ))}
        </ol>
      )}

      <VoiceButton
        lang="es-MX"
        idleLabel="Di la serie · «setenta por diez»"
        onTranscript={(texto) => {
          const serie = parseSpokenSet(texto);
          if (!serie) return false;
          if (serie.weightKg !== null) setPeso(String(serie.weightKg));
          if (serie.reps !== null) setReps(String(serie.reps));
          if (serie.rir !== null) setRir(String(serie.rir));
          return true;
        }}
      />

      <div className="grid grid-cols-[1fr_1fr_1fr_auto] gap-2">
        <Campo ref={pesoRef} label="kg" value={peso} onChange={setPeso} />
        <Campo label="reps" value={reps} onChange={setReps} />
        <Campo label="RIR" value={rir} onChange={setRir} />
        <button
          onClick={registrar}
          disabled={pending}
          className="self-end rounded-xl bg-accent px-5 py-3 text-lg font-medium text-white transition active:scale-[0.95] disabled:opacity-50"
        >
          +
        </button>
      </div>

      <button
        onClick={onNext}
        disabled={pending}
        className="w-full rounded-xl border border-line bg-surface py-4 font-medium transition active:scale-[0.98] disabled:opacity-50"
      >
        Otro ejercicio
      </button>
    </div>
  );
}

function Campo({
  ref,
  label,
  value,
  onChange,
}: {
  ref?: React.Ref<HTMLInputElement>;
  label: string;
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs tracking-wide text-muted uppercase">
        {label}
      </span>
      <input
        ref={ref}
        type="number"
        step="any"
        inputMode="decimal"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full rounded-xl border border-line bg-background px-2 py-3 text-center text-lg tabular-nums outline-none focus:border-accent"
      />
    </label>
  );
}

function Resumen({
  prs,
  totals,
}: {
  prs: string[];
  totals: { setCount: number; volumeKg: number };
}) {
  return (
    <div className="space-y-4 rounded-xl border border-line bg-surface p-8 text-center">
      <div className="text-5xl">🏋️</div>
      <h2 className="text-lg font-medium">Entrenamiento cerrado</h2>
      <p className="text-sm text-muted">
        {totals.setCount} series · {Math.round(totals.volumeKg).toLocaleString("es-MX")} kg
      </p>
      {prs.length > 0 && (
        <div>
          <p className="text-sm text-muted">Récords nuevos</p>
          <ul className="mt-1 space-y-1">
            {prs.map((pr) => (
              <li key={pr} className="font-medium text-accent">
                {pr}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
