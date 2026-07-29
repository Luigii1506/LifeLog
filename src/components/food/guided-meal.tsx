"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  addMealItem,
  cancelMeal,
  finishMeal,
  removeMealItem,
} from "@/app/food/actions";
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

export type LoggedItem = {
  id: string;
  /** Nulo si es algo suelto que no está en el catálogo. */
  foodId: string | null;
  name: string;
  amount: number | null;
  unit: string;
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
 * Dos decisiones que parecen contradecirse y no lo hacen:
 *
 *   El árbol de sugerencias llega precalculado. Entre pregunta y pregunta no
 *   hay una sola petición de red, porque la latencia es lo que mata este
 *   patrón: si cada toque espera al servidor, registrar una comida se siente
 *   más lento que no registrarla.
 *
 *   Aun así cada alimento se escribe en la base al confirmarlo, igual que las
 *   series del gimnasio. La escritura va en segundo plano y la interfaz no la
 *   espera. Antes todo vivía en memoria del cliente hasta el final, así que
 *   cerrar la pestaña a media comida lo borraba todo.
 */
export function GuidedMeal({
  mealId,
  mealType,
  logged,
  suggestions,
  pairings,
  presets,
}: {
  mealId: string;
  mealType: string;
  /** Lo ya registrado en esta comida. Viene de la base, sobrevive recargas. */
  logged: LoggedItem[];
  /** Qué ofrecer ahora. El servidor ya tuvo en cuenta el último alimento. */
  suggestions: Suggestion[];
  /** Con qué se acompaña cada alimento. Clave: id del alimento. */
  pairings: Record<string, Suggestion[]>;
  /** Cantidades a ofrecer por alimento. */
  presets: Record<string, number[]>;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [hecho, setHecho] = useState<{ kcal: number | null; total: number } | null>(null);

  /** Alimento en curso, esperando cantidad. */
  const [pendiente, setPendiente] = useState<Pending | null>(null);
  /**
   * Lo añadido en esta pantalla, antes de que `router.refresh()` traiga la
   * lista de la base. Sin esto el alimento recién elegido desaparece durante
   * el parpadeo de la revalidación.
   */
  const [optimistas, setOptimistas] = useState<LoggedItem[]>([]);

  const items = [
    ...logged,
    ...optimistas.filter(
      (o) => !logged.some((l) => l.name.toLowerCase() === o.name.toLowerCase()),
    ),
  ];
  const yaElegidos = items.map((i) => i.name.toLowerCase());

  function opcionesAhora(): Suggestion[] {
    const ultimoId = optimistas.at(-1)?.foodId ?? logged.at(-1)?.foodId;
    // El servidor ya calculó el acompañamiento de lo persistido; `pairings`
    // cubre además lo que se añadió sin recargar.
    const base = (ultimoId && pairings[ultimoId]) || suggestions;
    return base.filter((s) => !yaElegidos.includes(s.name.toLowerCase()));
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

    const vacia = items.length === 0;
    return {
      type: "choice",
      id: vacia ? "primero" : "siguiente",
      question: vacia ? PREGUNTA[mealType] ?? "¿Qué comiste?" : "¿Algo más?",
      hint: vacia ? undefined : "Toca lo que añadiste",
      options: opcionesAhora().map((s) => ({
        value: s.id,
        label: s.name,
        icon: s.icon,
        meta:
          s.timesLogged > 0
            ? `${s.timesLogged} ${s.timesLogged === 1 ? "vez" : "veces"}`
            : null,
      })),
      customLabel: "Otra cosa",
      skipLabel: items.length > 0 ? "Nada más, terminar" : undefined,
    };
  }

  /**
   * Guarda el alimento sin bloquear la siguiente pregunta.
   *
   * La interfaz avanza al instante y la escritura viaja detrás. Si falla, el
   * item se retira de la lista optimista y se avisa: perder el dato en
   * silencio sería peor que la fricción de reintentarlo.
   */
  function persistir(item: Pending, amount: number | null) {
    const provisional: LoggedItem & { foodId: string | null } = {
      id: `pendiente:${item.name}:${amount}`,
      foodId: item.foodId,
      name: item.name,
      amount,
      unit: item.unit,
    };
    setOptimistas((prev) => [...prev, provisional]);

    startTransition(async () => {
      const r = await addMealItem({
        mealId,
        foodId: item.foodId,
        name: item.name,
        amount,
        unit: item.unit,
      });
      if (!r.ok) {
        setOptimistas((prev) => prev.filter((p) => p.id !== provisional.id));
        setError(r.error);
      } else {
        router.refresh();
      }
    });
  }

  function responder(respuesta: FlowAnswer) {
    setError(null);

    if (respuesta.kind === "quantity") {
      if (!pendiente) return;
      persistir(pendiente, respuesta.value);
      setPendiente(null);
      return;
    }

    if (respuesta.kind === "choice") {
      const sugerencia = opcionesAhora().find((s) => s.id === respuesta.value);
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
    if (items.length === 0) {
      setError("Elige al menos una cosa");
      return;
    }
    startTransition(async () => {
      const r = await finishMeal(mealId);
      if (!r.ok) setError(r.error);
      else {
        setHecho({ kcal: r.kcal ?? null, total: r.itemCount ?? items.length });
        router.refresh();
      }
    });
  }

  /**
   * Atrás deshace un paso real, no solo visual.
   *
   * Con algo registrado, borra el último alimento de la base — antes el
   * historial vivía en memoria y «atrás» bastaba con recortar un array. Sin
   * nada registrado, sale del flujo y descarta la comida vacía para no
   * dejarla colgando y bloquear la siguiente.
   */
  function atras() {
    setError(null);
    if (pendiente) return setPendiente(null);

    const ultimo = items.at(-1);
    if (!ultimo) {
      startTransition(async () => {
        await cancelMeal(mealId);
        router.refresh();
      });
      return;
    }

    setOptimistas((prev) => prev.filter((p) => p.id !== ultimo.id));
    if (ultimo.id.startsWith("pendiente:")) return; // aún no llegó a la base
    startTransition(async () => {
      const r = await removeMealItem(ultimo.id);
      if (!r.ok) setError(r.error);
      router.refresh();
    });
  }

  if (hecho) {
    return (
      <div className="space-y-4 rounded-xl border border-line bg-surface p-6 text-center">
        <div className="text-4xl">✓</div>
        <h2 className="text-lg font-medium capitalize">{mealType} registrado</h2>
        <p className="text-sm text-muted">
          {hecho.total} {hecho.total === 1 ? "cosa" : "cosas"}
          {hecho.kcal ? ` · ≈ ${Math.round(hecho.kcal)} kcal` : ""}
        </p>
      </div>
    );
  }

  const numeroPaso = items.length * 2 + (pendiente ? 2 : 1);

  return (
    <div>
      <GuidedFlow
        step={paso()}
        stepNumber={numeroPaso}
        estimatedSteps={Math.max(4, numeroPaso + 1)}
        trail={items.map(
          (e) =>
            `${e.name}${e.amount !== null ? ` ${e.amount}${e.unit === "unit" ? "" : e.unit}` : ""}`,
        )}
        busy={pending}
        onAnswer={responder}
        onBack={atras}
        onFinish={items.length > 0 && !pendiente ? guardar : undefined}
        finishLabel={`Guardar ${mealType}`}
      />
      {error && (
        <p
          className="mt-3 rounded-lg bg-accent px-4 py-3 text-center font-medium text-white"
          role="status"
        >
          {error}
        </p>
      )}
    </div>
  );
}
