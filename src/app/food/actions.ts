"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { newId } from "@/lib/ids";
import {
  addItem,
  addRecipe,
  closeMeal,
  duplicateMeal,
  MealError,
  removeItem,
  startMeal,
} from "@/lib/food/meal";
import { lastMealOfType } from "@/lib/food/queries";

export type FoodResult = { ok: true } | { ok: false; error: string };

function fail(error: unknown): FoodResult {
  if (error instanceof MealError) return { ok: false, error: error.message };
  console.error("food action falló", error);
  return { ok: false, error: "No se pudo completar la operación" };
}

export async function beginMeal(
  mealType: string,
  recipeId: string | null,
): Promise<FoodResult> {
  try {
    await startMeal({ mealType, recipeId });
  } catch (error) {
    return fail(error);
  }
  revalidatePath("/food");
  return { ok: true };
}

/** El atajo que más se usa: la mayoría de los desayunos son el mismo. */
export async function repeatLastMeal(mealType: string): Promise<FoodResult> {
  try {
    const ultima = await lastMealOfType(mealType);
    if (!ultima) return { ok: false, error: `No hay ningún ${mealType} anterior` };
    await duplicateMeal(ultima.id, mealType);
  } catch (error) {
    return fail(error);
  }
  revalidatePath("/food");
  return { ok: true };
}

export async function addMealItem(input: {
  mealId: string;
  foodId: string | null;
  name: string | null;
  amount: number | null;
  unit: string;
}): Promise<FoodResult> {
  try {
    await addItem({
      mealId: input.mealId,
      foodId: input.foodId,
      name: input.name ?? undefined,
      amount: input.amount,
      unit: input.unit,
    });
  } catch (error) {
    return fail(error);
  }
  revalidatePath("/food");
  return { ok: true };
}

export async function addMealRecipe(
  mealId: string,
  recipeId: string,
  servings: number,
): Promise<FoodResult> {
  try {
    await addRecipe({ mealId, recipeId, servings });
  } catch (error) {
    return fail(error);
  }
  revalidatePath("/food");
  return { ok: true };
}

export async function removeMealItem(itemId: string): Promise<FoodResult> {
  try {
    await removeItem(itemId);
  } catch (error) {
    return fail(error);
  }
  revalidatePath("/food");
  return { ok: true };
}

export async function finishMeal(mealId: string): Promise<FoodResult> {
  try {
    await closeMeal(mealId);
  } catch (error) {
    return fail(error);
  }
  revalidatePath("/food");
  revalidatePath("/");
  return { ok: true };
}

/** Crear un alimento sin salir del flujo. La fricción mata el registro. */
export async function createFood(input: {
  name: string;
  unit: string;
  kcal: number | null;
  proteinG: number | null;
  carbsG: number | null;
  fatG: number | null;
}): Promise<FoodResult & { id?: string }> {
  const nombre = input.name.trim();
  if (!nombre) return { ok: false, error: "El nombre no puede estar vacío" };

  try {
    const existente = await db.food.findUnique({ where: { name: nombre } });
    if (existente) return { ok: true, id: existente.id };

    const creado = await db.food.create({
      data: {
        id: newId(),
        name: nombre,
        unit: input.unit,
        kcal: input.kcal,
        proteinG: input.proteinG,
        carbsG: input.carbsG,
        fatG: input.fatG,
      },
    });
    revalidatePath("/food");
    return { ok: true, id: creado.id };
  } catch (error) {
    return fail(error);
  }
}

/**
 * Registra una comida completa en un solo paso, desde el flujo guiado.
 *
 * El flujo guiado acumula las respuestas en el cliente y las envía juntas al
 * final: entre pregunta y pregunta no hay red, y la latencia es lo que mata
 * este patrón. La comida se abre, se llena y se cierra en una sola operación.
 */
export async function logGuidedMeal(
  mealType: string,
  items: { foodId: string | null; name: string; amount: number | null; unit: string }[],
): Promise<FoodResult & { kcal?: number | null }> {
  if (items.length === 0) return { ok: false, error: "No hay nada que registrar" };

  try {
    const meal = await startMeal({ mealType, source: "app:food:guiado" });
    for (const item of items) {
      await addItem({
        mealId: meal.id,
        foodId: item.foodId,
        name: item.name,
        amount: item.amount,
        unit: item.unit,
      });
    }
    const resultado = await closeMeal(meal.id);
    revalidatePath("/food");
    revalidatePath("/");
    return { ok: true, kcal: resultado.kcal };
  } catch (error) {
    return fail(error);
  }
}
