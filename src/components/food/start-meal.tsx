"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { beginMeal, repeatLastMeal } from "@/app/food/actions";

type Recipe = { id: string; name: string; mealType: string | null; itemCount: number };

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
  const [tipo, setTipo] = useState<string>(sugerirTipo());

  function run(fn: () => Promise<{ ok: boolean; error?: string }>) {
    startTransition(async () => {
      setError(null);
      const r = await fn();
      if (!r.ok) setError(r.error ?? "Error");
    });
  }

  const anterior = repeatable[tipo];
  const recetasDelTipo = recipes.filter((r) => !r.mealType || r.mealType === tipo);

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-4 gap-2">
        {mealTypes.map((t) => (
          <button
            key={t}
            onClick={() => setTipo(t)}
            className={`rounded-xl border px-2 py-3 text-sm capitalize transition ${
              tipo === t
                ? "border-accent bg-surface font-medium"
                : "border-line bg-surface text-muted"
            }`}
          >
            {t}
          </button>
        ))}
      </div>

      {anterior && (
        <button
          disabled={pending}
          onClick={() => run(() => repeatLastMeal(tipo))}
          className="w-full rounded-xl bg-accent px-4 py-4 text-left text-white transition active:scale-[0.99] disabled:opacity-50"
        >
          <div className="font-medium capitalize">Repetir {tipo}</div>
          <div className="mt-0.5 text-sm opacity-90">{anterior.summary}</div>
        </button>
      )}

      <Link
        href={`/food/guiado/${tipo}`}
        className="block w-full rounded-xl bg-accent px-4 py-5 text-center text-lg font-medium text-white transition active:scale-[0.98]"
      >
        Registrar paso a paso
      </Link>

      {recetasDelTipo.length > 0 && (
        <section className="space-y-2">
          <h2 className="text-xs font-medium tracking-[0.12em] text-muted uppercase">
            Recetas
          </h2>
          {recetasDelTipo.map((receta) => (
            <button
              key={receta.id}
              disabled={pending}
              onClick={() => run(() => beginMeal(tipo, receta.id))}
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

      <button
        disabled={pending}
        onClick={() => run(() => beginMeal(tipo, null))}
        className="w-full py-3 text-sm text-muted disabled:opacity-50"
      >
        Modo manual
      </button>

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
