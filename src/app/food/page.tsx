import { ActiveMeal } from "@/components/food/active-meal";
import { StartMeal } from "@/components/food/start-meal";
import {
  getFoods,
  getOpenMeal,
  getRecipes,
  lastMealOfType,
  MEAL_TYPES,
} from "@/lib/food/queries";

export const dynamic = "force-dynamic";

export default async function FoodPage() {
  const [abierta, foods, recipes] = await Promise.all([
    getOpenMeal(),
    getFoods(),
    getRecipes(),
  ]);

  if (abierta) {
    return (
      <Shell>
        <ActiveMeal
          mealId={abierta.id}
          mealType={abierta.mealType}
          startedAt={abierta.startedAt.toISOString()}
          items={abierta.items.map((i) => ({
            id: i.id,
            name: i.name,
            amount: i.amount,
            unit: i.unit,
            kcal: i.kcal,
            proteinG: i.proteinG,
          }))}
          foods={foods.map((f) => ({
            id: f.id,
            name: f.name,
            unit: f.unit,
            kcal: f.kcal,
          }))}
          recipes={recipes.map((r) => ({ id: r.id, name: r.name }))}
        />
      </Shell>
    );
  }

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
  return (
    <main className="py-4">
      {children}
    </main>
  );
}
