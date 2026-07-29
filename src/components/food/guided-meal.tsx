"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { logGuidedMeal } from "@/app/food/actions";
import {
  GuidedFlow,
  type FlowAnswer,
  type FlowStep,
} from "@/components/guided/guided-flow";

export type Suggestion = {
  id: string;
  name: string;
  unit: string;
  icon: string | null;
  usualAmount: number | null;
  timesLogged: number;
};

type Chosen = {
  foodId: string | null;
  name: string;
  unit: string;
  amount: number | null;
};

/** El español no se conjuga concatenando: "desayuno" + "ste" da "desayunoste". */
const PREGUNTA: Record<string, string> = {
  desayuno: "¿Qué desayunaste?",
  comida: "¿Qué comiste?",
  cena: "¿Qué cenaste?",
  snack: "¿Qué picaste?",
};

/** Alimento elegido, esperando cantidad. Forma única para no ramificar tipos. */
type Pending = {
  foodId: string | null;
  name: string;
  unit: string;
  suggested: number | null;
};

/**
 * Flujo guiado de comida: alimento → cantidad → ¿algo más? → cerrar.
 *
 * Todo el árbol de sugerencias llega precalculado del servidor. El flujo se
 * resuelve entero en el cliente y solo la escritura final va a la red.
 */
export function GuidedMeal({
  mealType,
  initial,
  pairings,
  presets,
}: {
  mealType: string;
  initial: Suggestion[];
  /** Con qué se acompaña cada alimento. Clave: id del alimento. */
  pairings: Record<string, Suggestion[]>;
  /** Cantidades a ofrecer por alimento. */
  presets: Record<string, number[]>;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [hecho, setHecho] = useState<{ kcal: number | null } | null>(null);

  const [elegidos, setElegidos] = useState<Chosen[]>([]);
  /** Alimento en curso, esperando cantidad. */
  const [pendiente, setPendiente] = useState<Pending | null>(null);

  const yaElegidos = elegidos.map((e) => e.foodId).filter((id): id is string => id !== null);

  function sugerenciasAhora(): Suggestion[] {
    if (elegidos.length === 0) return initial;
    const ultimo = elegidos.at(-1);
    const base = (ultimo?.foodId && pairings[ultimo.foodId]) || initial;
    return base.filter((s) => !yaElegidos.includes(s.id));
  }

  function paso(): FlowStep {
    if (pendiente) {
      const porDefecto = pendiente.unit === "unit" ? [1, 2, 3, 4] : [50, 100, 150, 200];
      return {
        type: "quantity",
        id: "cantidad",
        question: `¿Cuánto${pendiente.unit === "unit" ? "s" : ""} ${pendiente.name.toLowerCase()}?`,
        hint: pendiente.unit === "unit" ? "Piezas" : `En ${pendiente.unit}`,
        presets: (pendiente.foodId && presets[pendiente.foodId]) || porDefecto,
        unit: pendiente.unit,
        suggested: pendiente.suggested,
      };
    }

    const opciones = sugerenciasAhora();
    return {
      type: "choice",
      id: elegidos.length === 0 ? "primero" : "siguiente",
      question: elegidos.length === 0 ? PREGUNTA[mealType] ?? "¿Qué comiste?" : "¿Algo más?",
      hint: elegidos.length === 0 ? undefined : "Toca lo que añadiste",
      options: opciones.map((s) => ({
        value: s.id,
        label: s.name,
        icon: s.icon,
        meta:
          s.timesLogged > 0
            ? `${s.timesLogged} ${s.timesLogged === 1 ? "vez" : "veces"}`
            : null,
      })),
      customLabel: "Otra cosa",
      skipLabel: elegidos.length > 0 ? "Nada más, terminar" : undefined,
    };
  }

  function responder(respuesta: FlowAnswer) {
    setError(null);

    if (respuesta.kind === "quantity") {
      if (!pendiente) return;
      setElegidos((prev) => [
        ...prev,
        {
          foodId: pendiente.foodId,
          name: pendiente.name,
          unit: pendiente.unit,
          amount: respuesta.value,
        },
      ]);
      setPendiente(null);
      return;
    }

    if (respuesta.kind === "choice") {
      const sugerencia = sugerenciasAhora().find((s) => s.id === respuesta.value);
      if (sugerencia) {
        setPendiente({
          foodId: sugerencia.id,
          name: sugerencia.name,
          unit: sugerencia.unit,
          suggested: sugerencia.usualAmount,
        });
      }
      return;
    }

    if (respuesta.kind === "custom") {
      // Algo que no está en el catálogo: entra sin macros y sin obligar a
      // crear la entidad. Registrar gana a catalogar.
      setPendiente({ foodId: null, name: respuesta.value, unit: "g", suggested: null });
      return;
    }

    if (respuesta.kind === "skip") guardar();
  }

  function guardar() {
    if (elegidos.length === 0) {
      setError("Elige al menos una cosa");
      return;
    }
    startTransition(async () => {
      const r = await logGuidedMeal(mealType, elegidos);
      if (!r.ok) setError(r.error);
      else {
        setHecho({ kcal: r.kcal ?? null });
        router.refresh();
      }
    });
  }

  function atras() {
    setError(null);
    if (pendiente) return setPendiente(null);
    setElegidos((prev) => prev.slice(0, -1));
  }

  if (hecho) {
    return (
      <div className="space-y-4 rounded-xl border border-line bg-surface p-6 text-center">
        <div className="text-4xl">✓</div>
        <h2 className="text-lg font-medium capitalize">{mealType} registrado</h2>
        <p className="text-sm text-muted">
          {elegidos.length} {elegidos.length === 1 ? "cosa" : "cosas"}
          {hecho.kcal ? ` · ≈ ${Math.round(hecho.kcal)} kcal` : ""}
        </p>
        <a href="/" className="block pt-2 text-sm text-muted hover:text-foreground">
          ← Volver a Hoy
        </a>
      </div>
    );
  }

  const paso_ = paso();
  const numeroPaso = elegidos.length * 2 + (pendiente ? 2 : 1);

  return (
    <div>
      <GuidedFlow
        step={paso_}
        stepNumber={numeroPaso}
        estimatedSteps={Math.max(4, numeroPaso + 1)}
        trail={elegidos.map(
          (e) => `${e.name}${e.amount !== null ? ` ${e.amount}${e.unit === "unit" ? "" : e.unit}` : ""}`,
        )}
        busy={pending}
        onAnswer={responder}
        onBack={elegidos.length > 0 || pendiente ? atras : undefined}
        onFinish={elegidos.length > 0 && !pendiente ? guardar : undefined}
        finishLabel={`Guardar ${mealType}`}
      />
      {error && (
        <p className="mt-3 rounded-lg bg-accent px-4 py-3 text-center font-medium text-white" role="status">
          {error}
        </p>
      )}
    </div>
  );
}
