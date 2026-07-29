"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { newId } from "@/lib/ids";
import {
  addItem,
  closeMeal,
  discardMeal,
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
  timeZone: string,
): Promise<FoodResult> {
  try {
    await startMeal({ mealType, recipeId, timeZone, source: "app:food:guiado" });
  } catch (error) {
    return fail(error);
  }
  revalidatePath("/food");
  return { ok: true };
}

/** El atajo que más se usa: la mayoría de los desayunos son el mismo. */
export async function repeatLastMeal(
  mealType: string,
  timeZone: string,
): Promise<FoodResult> {
  try {
    const ultima = await lastMealOfType(mealType);
    if (!ultima) return { ok: false, error: `No hay ningún ${mealType} anterior` };
    await duplicateMeal(ultima.id, mealType, timeZone);
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

export async function removeMealItem(itemId: string): Promise<FoodResult> {
  try {
    await removeItem(itemId);
  } catch (error) {
    return fail(error);
  }
  revalidatePath("/food");
  return { ok: true };
}

export async function finishMeal(
  mealId: string,
): Promise<FoodResult & { kcal?: number | null; itemCount?: number }> {
  try {
    const r = await closeMeal(mealId);
    revalidatePath("/food");
    revalidatePath("/");
    return { ok: true, kcal: r.kcal, itemCount: r.itemCount };
  } catch (error) {
    return fail(error);
  }
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

/** Descarta una comida abierta que quedó vacía. Salir no debe dejar basura. */
export async function cancelMeal(mealId: string): Promise<FoodResult> {
  try {
    await discardMeal(mealId);
  } catch (error) {
    return fail(error);
  }
  revalidatePath("/food");
  return { ok: true };
}
