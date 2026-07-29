import { notFound } from "next/navigation";
import { GuidedMeal, type Suggestion } from "@/components/food/guided-meal";
import { MEAL_TYPES } from "@/lib/food/queries";
import { amountPresets, pairedWith, topFoodsForMealType } from "@/lib/food/suggestions";

export const dynamic = "force-dynamic";

export default async function GuidedMealPage({
  params,
}: {
  params: Promise<{ tipo: string }>;
}) {
  const { tipo } = await params;
  if (!(MEAL_TYPES as readonly string[]).includes(tipo)) notFound();

  const initial = await topFoodsForMealType(tipo, 8);

  // Todo el árbol se precalcula aquí: entre pregunta y pregunta no debe haber
  // una sola petición de red. La latencia es lo que mata este patrón.
  const [pairs, sets] = await Promise.all([
    Promise.all(
      initial.map(async (s) => [s.id, await pairedWith(s.id, tipo, { limit: 6 })] as const),
    ),
    Promise.all(
      initial.map(async (s) => [s.id, await amountPresets(s.id, s.unit)] as const),
    ),
  ]);

  const pairings = Object.fromEntries(pairs) as Record<string, Suggestion[]>;
  const presets = Object.fromEntries(sets) as Record<string, number[]>;

  return (
    <main className="py-4">

      <GuidedMeal
        mealType={tipo}
        initial={initial}
        pairings={pairings}
        presets={presets}
      />
    </main>
  );
}
