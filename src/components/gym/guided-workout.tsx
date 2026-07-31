"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  addSet,
  createExercise,
  editSet,
  finishWorkout,
  removeSet,
} from "@/app/gym/actions";
import { useVoiceTarget } from "@/components/voice/registry";
import { ExerciseTile } from "./exercise-card";
import { SessionBar } from "./session-bar";
import { ExercisePhotoButton } from "./exercise-photo";
import { parseSpokenSet } from "@/lib/gym/parse-spoken-set";
import { matchOption } from "@/lib/match-option";

export type ExerciseCard = {
  id: string;
  name: string;
  /** Foto de la máquina, si la hay. Se reconoce antes de leer el nombre. */
  photoUrl?: string | null;
  equipment: string | null;
  timesLogged: number;
  lastSets: string | null;
};

export type GroupCard = {
  group: string;
  exerciseCount: number;
  timesTrained: number;
  photoCount: number;
};

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
  startedAt,
  initialMinutes,
  workedExercises,
}: {
  /** Nulo hasta la primera serie: la sesión no existe antes. */
  sessionId: string | null;
  groups: GroupCard[];
  initialGroup: string | null;
  /** Ejercicios del grupo seleccionado, ya calculados en el servidor. */
  exercises: ExerciseCard[];
  currentExercise: ExerciseCard | null;
  sets: SetRow[];
  totals: { setCount: number; volumeKg: number };
  /** ISO. La barra sigue contando en el cliente. Nulo sin sesión. */
  startedAt: string | null;
  /** Minutos ya transcurridos, calculados en el servidor. Evita el parpadeo. */
  initialMinutes: number;
  /** Ejercicios trabajados, para el resumen antes de cerrar. */
  workedExercises: string[];
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

  // Cerrar la sesión es lo mismo desde cualquier pantalla, así que vive aquí y
  // no repetido en cada rama.
  const terminar = () => {
    if (!sessionId) return;
    startTransition(async () => {
      const r = await finishWorkout(sessionId, null);
      if (r.ok) setPrs(r.prs ?? []);
      else setError(r.error);
    });
  };

  const marco = {
    totals,
    startedAt,
    initialMinutes,
    workedExercises,
    error,
    pending,
    onFinish: terminar,
  };

  // ── Paso 3: registrando series de un ejercicio ────────────────────
  if (currentExercise) {
    return (
      <Marco {...marco}>
        <SetLogger
          exercise={currentExercise}
          sets={sets}
          pending={pending}
          onAdd={(d) =>
            run(() =>
              // La sesión se abre aquí si no existía: la primera serie ES el
              // comienzo del entrenamiento.
              addSet({
                exerciseId: currentExercise.id,
                ...d,
                timeZone:
                  Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC",
              }),
            )
          }
          onEdit={(id, d) => run(() => editSet(id, d))}
          onRemove={(id) => run(() => removeSet(id))}
          onNext={() =>
            router.push(`/gym?grupo=${encodeURIComponent(initialGroup ?? "")}`)
          }
        />
      </Marco>
    );
  }

  // ── Paso 2: elegir ejercicio dentro del grupo ─────────────────────
  if (initialGroup) {
    return (
      <Marco {...marco}>
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
    <Marco {...marco}>
      <h2 className="mb-3 text-2xl font-semibold tracking-tight">
        ¿Qué vas a trabajar?
      </h2>
      <div className="grid grid-cols-2 gap-2.5">
        {groups.map((g) => (
          <button
            key={g.group}
            disabled={pending}
            onClick={() =>
              router.push(`/gym?grupo=${encodeURIComponent(g.group)}`)
            }
            className="relative overflow-hidden rounded-2xl border border-line bg-surface p-4 text-left transition active:scale-[0.97] disabled:opacity-50"
          >
            <span className="block text-lg font-medium capitalize">
              {g.group}
            </span>
            <span className="mt-0.5 block text-xs text-muted">
              {g.exerciseCount} ejercicios
              {g.timesTrained > 0 && ` · ${g.timesTrained} series`}
            </span>

            {/* Avance del catálogo de fotos. Es lo que estás construyendo
                ahora mismo, y sin esto habría que entrar en cada grupo para
                saber cuál te falta. Desaparece al completarlo. */}
            {g.photoCount < g.exerciseCount && (
              <span className="mt-2 flex items-center gap-1.5">
                <span
                  className="h-1 flex-1 overflow-hidden rounded-full bg-line"
                  aria-hidden
                >
                  <span
                    className="block h-full rounded-full bg-accent transition-all"
                    style={{
                      width: `${Math.round((g.photoCount / g.exerciseCount) * 100)}%`,
                    }}
                  />
                </span>
                <span className="text-[10px] tabular-nums text-muted">
                  {g.photoCount}/{g.exerciseCount} 📷
                </span>
              </span>
            )}
          </button>
        ))}
      </div>
    </Marco>
  );
}

/**
 * Envoltorio de todas las pantallas con sesión abierta.
 *
 * La cabecera con el recuento desapareció: la barra flotante ya dice tiempo,
 * series y volumen, y tenerlo dos veces en la misma pantalla era ruido. La
 * barra además está en TODAS las pantallas, no solo donde cabía el botón.
 */
function Marco({
  children,
  totals,
  startedAt,
  initialMinutes,
  workedExercises,
  error,
  onFinish,
  pending,
}: {
  children: React.ReactNode;
  totals: { setCount: number; volumeKg: number };
  startedAt: string | null;
  initialMinutes: number;
  workedExercises: string[];
  error: string | null;
  onFinish: () => void;
  pending: boolean;
}) {
  return (
    <div className="space-y-4">
      {children}

      {error && (
        <p
          role="status"
          className="rounded-lg bg-accent px-4 py-3 text-center font-medium text-white"
        >
          {error}
        </p>
      )}

      {/* Sin sesión no hay nada que terminar ni cronómetro que enseñar. */}
      {startedAt && (
        <SessionBar
          startedAt={startedAt}
          initialMinutes={initialMinutes}
          setCount={totals.setCount}
          volumeKg={totals.volumeKg}
          exercises={workedExercises}
          pending={pending}
          onFinish={onFinish}
        />
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

  // Sin coincidencia clara, lo dicho pasa al buscador en vez de registrar un
  // ejercicio que no era: ves lo que entendió y eliges a mano. Registrar la
  // serie equivocada cuesta más de deshacer que de teclear.
  useVoiceTarget("Di el ejercicio", (texto) => {
    const encontrado = matchOption(
      texto,
      exercises.map((e) => ({ value: e.id, label: e.name })),
    );
    if (encontrado) {
      onPick(encontrado.value);
      return true;
    }
    setFiltro(texto);
    return false;
  });

  const normaliza = (s: string) =>
    s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");

  const visibles = exercises.filter((e) =>
    normaliza(e.name).includes(normaliza(filtro.trim())),
  );
  const exacto = exercises.some(
    (e) => normaliza(e.name) === normaliza(filtro.trim()),
  );

  return (
    <div className="space-y-3">
      <div className="flex items-baseline justify-between">
        <h2 className="text-2xl font-semibold tracking-tight capitalize">
          {group}
        </h2>
        <button
          onClick={onBack}
          className="rounded-full border border-line px-3 py-1 text-xs text-muted transition active:scale-95"
        >
          Cambiar grupo
        </button>
      </div>

      {/* El buscador solo aparece cuando hay bastantes: con seis tarjetas a la
          vista, un campo de texto es una fila desperdiciada y una invitación a
          teclear que no hace falta. */}
      {exercises.length > 8 && (
        <input
          value={filtro}
          onChange={(e) => setFiltro(e.target.value)}
          placeholder="Buscar"
          className="w-full rounded-xl border border-line bg-surface px-4 py-2.5 text-sm outline-none transition focus:border-accent"
        />
      )}

      {/* Rejilla de dos: con foto, la vista reconoce la máquina antes de que
          leas el nombre, y en dos columnas caben seis de golpe. */}
      <div className="grid grid-cols-2 gap-2.5">
        {visibles.map((ejercicio) => (
          <ExerciseTile
            key={ejercicio.id}
            exercise={ejercicio}
            disabled={pending}
            onPick={() => onPick(ejercicio.id)}
          />
        ))}
      </div>

      {visibles.length === 0 && !filtro.trim() && (
        <p className="py-10 text-center text-sm text-muted">
          No hay ejercicios de {group} todavía.
        </p>
      )}

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
  onEdit,
  onRemove,
  onNext,
}: {
  exercise: ExerciseCard;
  sets: SetRow[];
  pending: boolean;
  onAdd: (d: {
    weightKg: number | null;
    reps: number | null;
    rir: number | null;
  }) => void;
  onEdit: (
    id: string,
    d: { weightKg: number | null; reps: number | null; rir: number | null },
  ) => void;
  onRemove: (id: string) => void;
  onNext: () => void;
}) {
  const [peso, setPeso] = useState<string>("");
  const [reps, setReps] = useState<string>("");
  const [rir, setRir] = useState<string>("");
  /** Serie que se está corrigiendo. Null = se está añadiendo una nueva. */
  const [editando, setEditando] = useState<SetRow | null>(null);
  const pesoRef = useRef<HTMLInputElement>(null);

  const num = (v: string) => {
    const n = Number(v.replace(",", "."));
    return v.trim() === "" || !Number.isFinite(n) ? null : n;
  };

  const valores = { weightKg: num(peso), reps: num(reps), rir: num(rir) };
  const completa = valores.reps !== null && valores.weightKg !== null;
  const vacia = valores.reps === null && valores.weightKg === null;

  function limpiar() {
    // El peso NO se borra: entre series casi nunca cambia, y volver a
    // teclearlo cada vez es la fricción que más se nota en el gimnasio.
    // Reps y RIR sí, porque repetirlos por descuido registra una serie falsa.
    setReps("");
    setRir("");
    setEditando(null);
    pesoRef.current?.blur();
  }

  function registrar() {
    if (vacia) return;
    if (editando) onEdit(editando.id, valores);
    else onAdd(valores);
    limpiar();
  }

  function corregir(s: SetRow) {
    setEditando(s);
    setPeso(s.weightKg !== null ? String(s.weightKg) : "");
    setReps(s.reps !== null ? String(s.reps) : "");
    setRir(s.rir !== null ? String(s.rir) : "");
  }

  function cancelar() {
    setEditando(null);
    setReps("");
    setRir("");
  }

  /**
   * Voz: dictar la serie y confirmarla sin tocar la pantalla.
   *
   * Dictar RELLENA pero no registra —entre series se habla con prisa y una
   * serie mal entendida ensucia el volumen del día—, así que hace falta una
   * palabra explícita para confirmar. Con las manos ocupadas, decir «setenta
   * por diez» y luego «aceptar» es todo el ciclo.
   *
   * «Aceptar» con los campos incompletos no registra a medias: avisa. Una
   * serie sin repeticiones no es una serie.
   */
  useVoiceTarget(
    editando
      ? `Corrigiendo serie ${editando.setIndex}`
      : "Di la serie · «setenta por diez»",
    (texto) => {
      // Primero la serie, después los comandos. Al revés, «ok setenta por
      // diez» casaba con «aceptar» —por el «ok»— y registraba los valores
      // anteriores en vez de los dictados. Una orden nunca lleva números y una
      // serie siempre, así que el número desempata sin ambigüedad.
      const serie = parseSpokenSet(texto);
      if (
        serie &&
        (serie.weightKg !== null || serie.reps !== null || serie.rir !== null)
      ) {
        if (serie.weightKg !== null) setPeso(String(serie.weightKg));
        if (serie.reps !== null) setReps(String(serie.reps));
        if (serie.rir !== null) setRir(String(serie.rir));
        return true;
      }

      const orden = matchOption(texto, [
        {
          value: "aceptar",
          label:
            "aceptar acepta confirmar confirma listo guardar guarda agregar agrega anadir ok vale correcto",
        },
        {
          value: "borrar",
          label: "eliminar elimina borrar borra quitar quita deshacer error",
        },
        { value: "cancelar", label: "cancelar cancela dejalo olvidalo" },
      ]);

      if (orden?.value === "aceptar") {
        // Con los campos vacíos no hay nada que aceptar; devolver false deja
        // que el botón lo diga («No entendí») en vez de registrar una serie
        // en blanco.
        if (vacia) return false;
        registrar();
        return true;
      }

      if (orden?.value === "borrar") {
        // La que se está corrigiendo, o la última registrada: es lo que uno
        // quiere decir al soltar «eliminar» justo después de meterla.
        const objetivo = editando ?? sets.at(-1);
        if (!objetivo) return false;
        onRemove(objetivo.id);
        limpiar();
        return true;
      }

      if (orden?.value === "cancelar" && editando) {
        cancelar();
        return true;
      }

      return false;
    },
  );

  // El peso de la última serie: entre series casi nunca cambia.
  const ultima = sets.at(-1);
  useEffect(() => {
    if (peso === "" && !editando && ultima?.weightKg != null) {
      setPeso(String(ultima.weightKg));
    }
  }, [ultima?.weightKg, peso, editando]);

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        {exercise.photoUrl && (
          // Confirma de un vistazo que estás en la máquina que creías. Pequeña
          // a propósito: aquí ya elegiste, y el sitio lo necesitan los campos.
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={exercise.photoUrl}
            alt=""
            className="size-14 shrink-0 rounded-xl border border-line object-cover"
          />
        )}
        <div className="min-w-0 flex-1">
          <h2 className="text-xl leading-tight font-semibold tracking-tight">
            {exercise.name}
          </h2>
          {exercise.lastSets ? (
            <p className="mt-0.5 font-mono text-sm text-muted">
              {exercise.lastSets}
            </p>
          ) : (
            <p className="mt-0.5 text-sm text-muted">Primera vez</p>
          )}
        </div>
      </div>

      {!exercise.photoUrl && (
        // Solo cuando falta: una vez tomada, el botón sería ruido permanente
        // en la pantalla donde más prisa tienes.
        <ExercisePhotoButton exerciseId={exercise.id} hasPhoto={false} />
      )}

      {sets.length > 0 && (
        <ol className="space-y-1 rounded-xl border border-line bg-surface p-2">
          {sets.map((s) => {
            const activa = editando?.id === s.id;
            return (
              <li
                key={s.id}
                className={`flex items-center gap-2 rounded-lg px-2 py-1.5 font-mono text-sm ${
                  activa ? "bg-accent/10 ring-1 ring-accent" : ""
                }`}
              >
                {/* Tocar la serie la abre para corregir. Es el gesto que uno
                    prueba primero, y antes no hacía nada. */}
                <button
                  onClick={() => corregir(s)}
                  disabled={pending}
                  className="flex flex-1 items-center gap-3 text-left disabled:opacity-50"
                  aria-label={`Corregir serie ${s.setIndex}`}
                >
                  <span className="w-4 text-muted">{s.setIndex}</span>
                  <span className="tabular-nums">
                    {s.weightKg ?? "—"} kg × {s.reps ?? "—"}
                  </span>
                  {s.rir !== null && (
                    <span className="text-muted">RIR {s.rir}</span>
                  )}
                </button>
                <button
                  onClick={() => {
                    if (editando?.id === s.id) setEditando(null);
                    onRemove(s.id);
                  }}
                  disabled={pending}
                  className="px-2 text-muted transition hover:text-accent disabled:opacity-50"
                  aria-label={`Borrar serie ${s.setIndex}`}
                >
                  ×
                </button>
              </li>
            );
          })}
        </ol>
      )}

      {editando && (
        <div className="flex items-center justify-between rounded-xl border border-accent bg-accent/10 px-4 py-2 text-sm">
          <span className="font-medium">
            Corrigiendo la serie {editando.setIndex}
          </span>
          <button onClick={cancelar} className="text-muted underline">
            Cancelar
          </button>
        </div>
      )}

      <div className="grid grid-cols-[1fr_1fr_1fr_auto] gap-2">
        <Campo ref={pesoRef} label="kg" value={peso} onChange={setPeso} />
        <Campo label="reps" value={reps} onChange={setReps} />
        <Campo label="RIR" value={rir} onChange={setRir} />
        <button
          onClick={registrar}
          disabled={pending || vacia}
          aria-label={editando ? "Guardar corrección" : "Añadir serie"}
          className="self-end rounded-xl bg-accent px-5 py-3 text-lg font-medium text-white transition active:scale-[0.95] disabled:opacity-40"
        >
          {editando ? "✓" : "+"}
        </button>
      </div>

      {!completa && !vacia && (
        <p className="text-center text-xs text-muted">
          Falta {valores.reps === null ? "las repeticiones" : "el peso"}
        </p>
      )}

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
        {totals.setCount} series ·{" "}
        {Math.round(totals.volumeKg).toLocaleString("es-MX")} kg
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
