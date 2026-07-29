"use client";

import { useState, useTransition } from "react";
import { beginMeal, repeatLastMeal } from "@/app/food/actions";

type Recipe = { id: string; name: string; mealType: string | null; itemCount: number };

/**
 * Entrada a la comida, con la misma forma que la del gimnasio.
 *
 * Antes había cuatro salidas —repetir, paso a paso, receta y «modo manual»—
 * y dos de ellas llevaban a interfaces distintas. Ahora todas entran al mismo
 * flujo guiado: el tipo de comida es al desayuno lo que el grupo muscular es
 * al entrenamiento, un toque y estás dentro.
 */
export function StartMeal({
  mealTypes,
  recipes,
  repeatable,
}: {
  mealTypes: readonly string[];
  recipes: Recipe[];
  /** Tipos de comida que tienen una anterior que repetir. */
  repeatable: Record<string, { at: string; summary: string } | null>;
}) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  /** El tipo probable según la hora. Se puede cambiar, pero casi nunca hace falta. */
  const [tipo, setTipo] = useState<string>(sugerirTipo());

  function run(fn: (zona: string) => Promise<{ ok: boolean; error?: string }>) {
    startTransition(async () => {
      setError(null);
      // La zona la sabe el navegador. En el servidor es UTC.
      const zona = Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
      const r = await fn(zona);
      if (!r.ok) setError(r.error ?? "Error");
    });
  }

  const anterior = repeatable[tipo];
  const recetasDelTipo = recipes.filter((r) => !r.mealType || r.mealType === tipo);

  return (
    <div className="space-y-5">
      <section className="space-y-2">
        <h2 className="text-xs font-medium tracking-[0.12em] text-muted uppercase">
          Qué estás comiendo
        </h2>
        <div className="grid grid-cols-2 gap-2">
          {mealTypes.map((t) => (
            <button
              key={t}
              disabled={pending}
              onClick={() => {
                setTipo(t);
                run((zona) => beginMeal(t, null, zona));
              }}
              className={`rounded-xl border px-3 py-5 text-base capitalize transition active:scale-[0.98] disabled:opacity-50 ${
                tipo === t
                  ? "border-accent bg-surface font-medium"
                  : "border-line bg-surface"
              }`}
            >
              {t}
            </button>
          ))}
        </div>
      </section>

      {anterior && (
        <button
          disabled={pending}
          onClick={() => run((zona) => repeatLastMeal(tipo, zona))}
          className="w-full rounded-xl bg-accent px-4 py-4 text-left text-white transition active:scale-[0.99] disabled:opacity-50"
        >
          <div className="font-medium capitalize">Repetir {tipo}</div>
          <div className="mt-0.5 text-sm opacity-90">{anterior.summary}</div>
        </button>
      )}

      {recetasDelTipo.length > 0 && (
        <section className="space-y-2">
          <h2 className="text-xs font-medium tracking-[0.12em] text-muted uppercase">
            Recetas
          </h2>
          {recetasDelTipo.map((receta) => (
            <button
              key={receta.id}
              disabled={pending}
              onClick={() => run((zona) => beginMeal(tipo, receta.id, zona))}
              className="flex w-full items-baseline justify-between rounded-xl border border-line bg-surface p-4 text-left transition active:scale-[0.99] disabled:opacity-50"
            >
              <span className="font-medium">{receta.name}</span>
              <span className="text-sm text-muted">
                {receta.itemCount} {receta.itemCount === 1 ? "item" : "items"}
              </span>
            </button>
          ))}
        </section>
      )}

      {error && (
        <p className="text-sm text-accent" role="status">
          {error}
        </p>
      )}
    </div>
  );
}

/** El tipo de comida más probable según la hora. Un toque menos. */
function sugerirTipo(): string {
  const h = new Date().getHours();
  if (h < 11) return "desayuno";
  if (h < 17) return "comida";
  if (h < 22) return "cena";
  return "snack";
}
