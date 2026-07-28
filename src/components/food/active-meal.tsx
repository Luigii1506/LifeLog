"use client";

import { useState, useTransition } from "react";
import {
  addMealItem,
  addMealRecipe,
  createFood,
  finishMeal,
  removeMealItem,
} from "@/app/food/actions";

type Item = {
  id: string;
  name: string;
  amount: number | null;
  unit: string;
  kcal: number | null;
  proteinG: number | null;
};

type FoodOption = { id: string; name: string; unit: string; kcal: number | null };
type RecipeOption = { id: string; name: string };

export function ActiveMeal({
  mealId,
  mealType,
  startedAt,
  items,
  foods,
  recipes,
}: {
  mealId: string;
  mealType: string;
  startedAt: string;
  items: Item[];
  foods: FoodOption[];
  recipes: RecipeOption[];
}) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [modo, setModo] = useState<"cerrado" | "alimento" | "receta">("cerrado");

  const kcal = items.reduce((s, i) => s + (i.kcal ?? 0), 0);
  const proteina = items.reduce((s, i) => s + (i.proteinG ?? 0), 0);

  function run(fn: () => Promise<{ ok: boolean; error?: string }>) {
    startTransition(async () => {
      setError(null);
      const r = await fn();
      if (!r.ok) setError(r.error ?? "Error");
      else setModo("cerrado");
    });
  }

  return (
    <div className="space-y-4">
      <header className="rounded-xl border border-line bg-surface p-4">
        <div className="flex items-baseline justify-between">
          <span className="font-medium capitalize">{mealType}</span>
          <time className="font-mono text-sm tabular-nums text-muted">
            {new Date(startedAt).toLocaleTimeString("es-MX", {
              hour: "2-digit",
              minute: "2-digit",
              hour12: false,
            })}
          </time>
        </div>
        <div className="mt-1 text-sm text-muted">
          {items.length} {items.length === 1 ? "item" : "items"}
          {kcal > 0 && ` · ≈ ${Math.round(kcal)} kcal · ${Math.round(proteina)} g proteína`}
        </div>
      </header>

      {items.length > 0 && (
        <ul className="space-y-1 rounded-xl border border-line bg-surface p-4">
          {items.map((item) => (
            <li key={item.id} className="flex items-baseline gap-3 text-sm">
              <span className="flex-1">{item.name}</span>
              <span className="font-mono tabular-nums text-muted">
                {item.amount ?? "—"} {item.unit === "unit" ? "u" : item.unit}
              </span>
              {item.kcal !== null && (
                <span className="w-16 text-right font-mono tabular-nums text-muted">
                  {Math.round(item.kcal)} kcal
                </span>
              )}
              <button
                onClick={() => run(() => removeMealItem(item.id))}
                disabled={pending}
                className="text-muted hover:text-accent disabled:opacity-50"
                aria-label={`Quitar ${item.name}`}
              >
                ×
              </button>
            </li>
          ))}
        </ul>
      )}

      {modo === "alimento" && (
        <PickFood
          foods={foods}
          pending={pending}
          onPick={(foodId, amount, unit) =>
            run(() => addMealItem({ mealId, foodId, name: null, amount, unit }))
          }
          onQuick={(name, amount, unit) =>
            run(() => addMealItem({ mealId, foodId: null, name, amount, unit }))
          }
          onCreate={(data, amount) =>
            startTransition(async () => {
              const creado = await createFood(data);
              if (!creado.ok || !creado.id) {
                setError(creado.ok ? "No se pudo crear" : creado.error);
                return;
              }
              const r = await addMealItem({
                mealId,
                foodId: creado.id,
                name: null,
                amount,
                unit: data.unit,
              });
              if (!r.ok) setError(r.error);
              else setModo("cerrado");
            })
          }
          onCancel={() => setModo("cerrado")}
        />
      )}

      {modo === "receta" && (
        <div className="space-y-1 rounded-xl border border-line bg-surface p-4">
          {recipes.map((receta) => (
            <button
              key={receta.id}
              disabled={pending}
              onClick={() => run(() => addMealRecipe(mealId, receta.id, 1))}
              className="w-full rounded-lg px-3 py-2 text-left hover:bg-background disabled:opacity-50"
            >
              {receta.name}
            </button>
          ))}
          <button onClick={() => setModo("cerrado")} className="w-full py-2 text-sm text-muted">
            Cancelar
          </button>
        </div>
      )}

      {modo === "cerrado" && (
        <div className="grid grid-cols-2 gap-2">
          <button
            onClick={() => setModo("alimento")}
            disabled={pending}
            className="rounded-xl border border-dashed border-line py-4 text-muted transition active:scale-[0.99] disabled:opacity-50"
          >
            + Alimento
          </button>
          <button
            onClick={() => setModo("receta")}
            disabled={pending || recipes.length === 0}
            className="rounded-xl border border-dashed border-line py-4 text-muted transition active:scale-[0.99] disabled:opacity-50"
          >
            + Receta
          </button>
        </div>
      )}

      {error && (
        <p className="text-sm text-accent" role="status">
          {error}
        </p>
      )}

      <button
        disabled={pending}
        onClick={() => run(() => finishMeal(mealId))}
        className="w-full rounded-xl bg-accent px-4 py-4 font-medium text-white transition active:scale-[0.98] disabled:opacity-50"
      >
        Terminar comida
      </button>
    </div>
  );
}

function PickFood({
  foods,
  pending,
  onPick,
  onQuick,
  onCreate,
  onCancel,
}: {
  foods: FoodOption[];
  pending: boolean;
  onPick: (foodId: string, amount: number | null, unit: string) => void;
  onQuick: (name: string, amount: number | null, unit: string) => void;
  onCreate: (
    data: {
      name: string;
      unit: string;
      kcal: number | null;
      proteinG: number | null;
      carbsG: number | null;
      fatG: number | null;
    },
    amount: number | null,
  ) => void;
  onCancel: () => void;
}) {
  const [filtro, setFiltro] = useState("");
  const [elegido, setElegido] = useState<FoodOption | null>(null);
  const [creando, setCreando] = useState(false);

  const visibles = foods.filter((f) =>
    f.name.toLowerCase().includes(filtro.trim().toLowerCase()),
  );
  const exacto = foods.some((f) => f.name.toLowerCase() === filtro.trim().toLowerCase());

  if (elegido) {
    return (
      <form
        className="space-y-3 rounded-xl border border-line bg-surface p-4"
        onSubmit={(e) => {
          e.preventDefault();
          const amount = Number(new FormData(e.currentTarget).get("amount"));
          onPick(elegido.id, Number.isFinite(amount) ? amount : null, elegido.unit);
        }}
      >
        <div className="font-medium">{elegido.name}</div>
        <label className="block">
          <span className="mb-1 block text-xs tracking-wide text-muted uppercase">
            Cantidad en {elegido.unit === "unit" ? "piezas" : elegido.unit}
          </span>
          <input
            autoFocus
            name="amount"
            type="number"
            step="any"
            inputMode="decimal"
            defaultValue={elegido.unit === "unit" ? 1 : 100}
            className="w-full rounded-lg border border-line bg-background px-3 py-3 text-center tabular-nums outline-none focus:border-accent"
          />
        </label>
        <div className="flex gap-2">
          <button
            type="submit"
            disabled={pending}
            className="flex-1 rounded-lg bg-foreground py-3 font-medium text-background disabled:opacity-50"
          >
            Añadir
          </button>
          <button
            type="button"
            onClick={() => setElegido(null)}
            className="rounded-lg border border-line px-4 text-muted"
          >
            Atrás
          </button>
        </div>
      </form>
    );
  }

  if (creando) {
    return (
      <form
        className="space-y-3 rounded-xl border border-line bg-surface p-4"
        onSubmit={(e) => {
          e.preventDefault();
          const d = new FormData(e.currentTarget);
          const num = (k: string) => {
            const v = d.get(k);
            return v === null || v === "" ? null : Number(v);
          };
          onCreate(
            {
              name: filtro.trim(),
              unit: String(d.get("unit") || "g"),
              kcal: num("kcal"),
              proteinG: num("proteinG"),
              carbsG: num("carbsG"),
              fatG: num("fatG"),
            },
            num("amount"),
          );
        }}
      >
        <div className="font-medium">{filtro.trim()}</div>
        <label className="block">
          <span className="mb-1 block text-xs tracking-wide text-muted uppercase">
            Se mide en
          </span>
          <select
            name="unit"
            defaultValue="g"
            className="w-full rounded-lg border border-line bg-background px-3 py-3 outline-none focus:border-accent"
          >
            <option value="g">gramos</option>
            <option value="ml">mililitros</option>
            <option value="unit">piezas</option>
          </select>
        </label>
        <p className="text-xs text-muted">
          Macros por 100 g/ml, o por pieza si se mide en piezas.
        </p>
        <div className="grid grid-cols-4 gap-2">
          <Num name="kcal" label="kcal" />
          <Num name="proteinG" label="prot" />
          <Num name="carbsG" label="carb" />
          <Num name="fatG" label="gras" />
        </div>
        <Num name="amount" label="cantidad ahora" defaultValue={100} />
        <div className="flex gap-2">
          <button
            type="submit"
            disabled={pending}
            className="flex-1 rounded-lg bg-foreground py-3 font-medium text-background disabled:opacity-50"
          >
            Crear y añadir
          </button>
          <button
            type="button"
            onClick={() => setCreando(false)}
            className="rounded-lg border border-line px-4 text-muted"
          >
            Atrás
          </button>
        </div>
      </form>
    );
  }

  return (
    <div className="space-y-2 rounded-xl border border-line bg-surface p-4">
      <input
        autoFocus
        value={filtro}
        onChange={(e) => setFiltro(e.target.value)}
        placeholder="Buscar alimento"
        className="w-full rounded-lg border border-line bg-background px-3 py-3 outline-none focus:border-accent"
      />

      <div className="max-h-56 space-y-1 overflow-y-auto">
        {visibles.map((f) => (
          <button
            key={f.id}
            disabled={pending}
            onClick={() => setElegido(f)}
            className="flex w-full items-baseline justify-between rounded-lg px-3 py-2 text-left hover:bg-background disabled:opacity-50"
          >
            <span>{f.name}</span>
            {f.kcal !== null && (
              <span className="text-xs text-muted">
                {f.kcal} kcal / {f.unit === "unit" ? "pieza" : `100 ${f.unit}`}
              </span>
            )}
          </button>
        ))}
      </div>

      {filtro.trim() && !exacto && (
        <div className="grid grid-cols-2 gap-2">
          <button
            disabled={pending}
            onClick={() => onQuick(filtro.trim(), null, "g")}
            className="rounded-lg border border-dashed border-line py-3 text-sm text-muted disabled:opacity-50"
          >
            Añadir suelto
          </button>
          <button
            disabled={pending}
            onClick={() => setCreando(true)}
            className="rounded-lg border border-dashed border-line py-3 text-sm text-muted disabled:opacity-50"
          >
            Crear con macros
          </button>
        </div>
      )}

      <button onClick={onCancel} className="w-full py-2 text-sm text-muted">
        Cancelar
      </button>
    </div>
  );
}

function Num({
  name,
  label,
  defaultValue,
}: {
  name: string;
  label: string;
  defaultValue?: number;
}) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs tracking-wide text-muted uppercase">
        {label}
      </span>
      <input
        name={name}
        type="number"
        step="any"
        inputMode="decimal"
        defaultValue={defaultValue}
        className="w-full rounded-lg border border-line bg-background px-2 py-3 text-center tabular-nums outline-none focus:border-accent"
      />
    </label>
  );
}
