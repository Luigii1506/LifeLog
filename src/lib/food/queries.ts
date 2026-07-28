import { db } from "@/lib/db";

export const MEAL_TYPES = ["desayuno", "comida", "cena", "snack"] as const;
export type MealType = (typeof MEAL_TYPES)[number];

export async function getFoods() {
  return db.food.findMany({
    where: { status: "active" },
    orderBy: { name: "asc" },
  });
}

export async function getRecipes() {
  return db.recipe.findMany({
    where: { status: "active" },
    orderBy: { name: "asc" },
    include: {
      ingredients: {
        orderBy: { sortOrder: "asc" },
        include: { food: true },
      },
    },
  });
}

/** La comida en curso. Solo puede haber una a la vez. */
export async function getOpenMeal() {
  return db.meal.findFirst({
    where: { status: "open" },
    orderBy: { startedAt: "desc" },
    include: { recipe: true, items: { orderBy: { id: "asc" }, include: { food: true } } },
  });
}

export async function getMeal(mealId: string) {
  return db.meal.findUnique({
    where: { id: mealId },
    include: { recipe: true, items: { orderBy: { id: "asc" }, include: { food: true } } },
  });
}

/**
 * La última comida cerrada de un tipo. Es lo que hace posible «repetir el
 * desayuno de ayer», que es el atajo que más veces se usa: la mayoría de los
 * desayunos son el mismo desayuno.
 */
export async function lastMealOfType(mealType: string) {
  return db.meal.findFirst({
    where: { mealType, status: "closed" },
    orderBy: { startedAt: "desc" },
    include: { items: { orderBy: { id: "asc" } }, recipe: true },
  });
}

export async function mealsForDay(date: Date) {
  const start = new Date(date);
  start.setHours(0, 0, 0, 0);
  const end = new Date(start);
  end.setDate(end.getDate() + 1);

  return db.meal.findMany({
    where: { startedAt: { gte: start, lt: end } },
    orderBy: { startedAt: "asc" },
    include: { items: true, recipe: true },
  });
}
