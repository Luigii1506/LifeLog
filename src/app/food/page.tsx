import { GuidedMeal, type Suggestion } from "@/components/food/guided-meal";
import { StartMeal } from "@/components/food/start-meal";
import { getOpenMeal, getRecipes, lastMealOfType, MEAL_TYPES } from "@/lib/food/queries";
import { amountPresets, pairedWith, topFoodsForMealType } from "@/lib/food/suggestions";

export const dynamic = "force-dynamic";

export default async function FoodPage() {
  const abierta = await getOpenMeal();

  if (abierta) {
    // El contexto se queda pegado igual que el grupo muscular del gimnasio:
    // lo que se ofrece ahora depende de lo último que añadiste, no de una
    // lista fija. Sin esto, tras elegir huevos te vuelve a ofrecer huevos.
    const ultimo = abierta.items.at(-1);
    const yaPuestos = abierta.items
      .map((i) => i.foodId)
      .filter((id): id is string => id !== null);

    const sugerencias = ultimo?.foodId
      ? await pairedWith(ultimo.foodId, abierta.mealType, { exclude: yaPuestos, limit: 8 })
      : (await topFoodsForMealType(abierta.mealType, 8)).filter(
          (s) => !yaPuestos.includes(s.id),
        );

    // Todo el árbol se precalcula aquí: entre pregunta y pregunta no debe
    // haber una sola petición de red. La latencia es lo que mata este patrón.
    const [pares, cantidades] = await Promise.all([
      Promise.all(
        sugerencias.map(
          async (s) =>
            [
              s.id,
              await pairedWith(s.id, abierta.mealType, {
                exclude: yaPuestos,
                limit: 6,
              }),
            ] as const,
        ),
      ),
      Promise.all(
        sugerencias.map(async (s) => [s.id, await amountPresets(s.id, s.unit)] as const),
      ),
    ]);

    return (
      <Shell>
        <GuidedMeal
          mealId={abierta.id}
          mealType={abierta.mealType}
          logged={abierta.items.map((i) => ({
            id: i.id,
            foodId: i.foodId,
            name: i.name,
            amount: i.amount,
            unit: i.unit,
          }))}
          suggestions={sugerencias}
          pairings={Object.fromEntries(pares) as Record<string, Suggestion[]>}
          presets={Object.fromEntries(cantidades) as Record<string, number[]>}
        />
      </Shell>
    );
  }

  const recipes = await getRecipes();

  // Qué se puede repetir de cada tipo. Es el atajo más usado, así que se
  // calcula por adelantado en vez de esperar a que el usuario elija.
  const repetibles = Object.fromEntries(
    await Promise.all(
      MEAL_TYPES.map(async (tipo) => {
        const ultima = await lastMealOfType(tipo);
        if (!ultima) return [tipo, null] as const;
        const resumen = ultima.items
          .slice(0, 3)
          .map((i) => i.name)
          .join(", ");
        return [
          tipo,
          {
            at: ultima.startedAt.toISOString(),
            summary:
              resumen + (ultima.items.length > 3 ? ` +${ultima.items.length - 3}` : ""),
          },
        ] as const;
      }),
    ),
  );

  return (
    <Shell>
      <StartMeal
        mealTypes={MEAL_TYPES}
        recipes={recipes.map((r) => ({
          id: r.id,
          name: r.name,
          mealType: r.mealType,
          itemCount: r.ingredients.length,
        }))}
        repeatable={repetibles}
      />
    </Shell>
  );
}

function Shell({ children }: { children: React.ReactNode }) {
  return <main className="py-4">{children}</main>;
}
