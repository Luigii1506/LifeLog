import { db } from "@/lib/db";
import { newId } from "@/lib/ids";
import { emit } from "@/lib/events/emit";
import { scaleMacros, sumMacros, type Macros } from "./macros";

/**
 * Ciclo de vida de una comida.
 *
 * Mutable mientras está abierta, inmutable al cerrarla. Al cerrar emite
 * `meal.logged` a la columna vertebral (I-11): sin ese evento la comida es
 * invisible para la línea de tiempo y para las proyecciones.
 */

export class MealError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "MealError";
  }
}

/**
 * Abre una comida. Si había otra abierta, la cierra antes.
 *
 * Bloquear en vez de cerrar sería fricción en el peor sitio: te olvidas de
 * cerrar el desayuno y a la hora de comer la app te dice que no. Y la comida
 * anterior no se pierde: se cierra bien, con su evento.
 */
export async function startMeal(input: {
  mealType: string;
  recipeId?: string | null;
  placeEntityId?: string | null;
  hungerBefore?: number | null;
  startedAt?: Date;
  /** Zona del USUARIO, enviada desde el navegador. En servidor es UTC. */
  timeZone?: string;
  source?: string;
}) {
  const abierta = await db.meal.findFirst({
    where: { status: "open" },
    include: { _count: { select: { items: true } } },
  });
  if (abierta) {
    // Una comida vacía se descarta, no se cierra: cerrarla emitiría un
    // meal.logged sin nada dentro y ensuciaría la línea de tiempo con una
    // comida que nunca ocurrió. Abrir el flujo y arrepentirse es normal.
    if (abierta._count.items === 0) await discardMeal(abierta.id);
    else await closeMeal(abierta.id);
  }

  const startedAt = input.startedAt ?? new Date();
  const meal = await db.meal.create({
    data: {
      id: newId(startedAt.getTime()),
      mealType: input.mealType,
      startedAt,
      timezone: input.timeZone ?? "UTC",
      recipeId: input.recipeId ?? null,
      placeEntityId: input.placeEntityId ?? null,
      hungerBefore: input.hungerBefore ?? null,
      status: "open",
      source: input.source ?? "app:food",
    },
  });

  if (input.recipeId) await addRecipe({ mealId: meal.id, recipeId: input.recipeId });
  return meal;
}

async function assertOpen(mealId: string) {
  const meal = await db.meal.findUnique({ where: { id: mealId }, select: { status: true } });
  if (!meal) throw new MealError(`No existe la comida ${mealId}`);
  if (meal.status !== "open") {
    throw new MealError("La comida está cerrada. Una comida cerrada es inmutable.");
  }
}

/** Añade un alimento del catálogo, o algo suelto que aún no es entidad. */
export async function addItem(input: {
  mealId: string;
  foodId?: string | null;
  name?: string;
  amount: number | null;
  unit?: string;
}) {
  await assertOpen(input.mealId);

  let nombre = input.name?.trim() ?? "";
  let macros: Macros = { kcal: null, proteinG: null, carbsG: null, fatG: null };
  let unidad = input.unit ?? "g";

  if (input.foodId) {
    const food = await db.food.findUnique({ where: { id: input.foodId } });
    if (!food) throw new MealError(`No existe el alimento ${input.foodId}`);
    nombre = nombre || food.name;
    unidad = input.unit ?? food.unit;
    macros = scaleMacros(food, input.amount);
  }

  if (!nombre) throw new MealError("El item necesita un nombre o un alimento.");

  return db.mealItem.create({
    data: {
      id: newId(),
      mealId: input.mealId,
      foodId: input.foodId ?? null,
      name: nombre,
      amount: input.amount,
      unit: unidad,
      ...macros,
    },
  });
}

/**
 * Expande una receta en items sueltos, en vez de guardarla como una unidad.
 *
 * Es lo que permite «repetir el desayuno habitual pero sin frijoles y con un
 * paquete de galletas». Si la receta viajara como bloque, cada desviación
 * exigiría una receta nueva y en un mes tendrías cuarenta.
 */
export async function addRecipe(input: {
  mealId: string;
  recipeId: string;
  servings?: number;
}) {
  await assertOpen(input.mealId);

  const recipe = await db.recipe.findUnique({
    where: { id: input.recipeId },
    include: { ingredients: { orderBy: { sortOrder: "asc" }, include: { food: true } } },
  });
  if (!recipe) throw new MealError(`No existe la receta ${input.recipeId}`);

  const factor = (input.servings ?? 1) / (recipe.servings || 1);

  for (const ingrediente of recipe.ingredients) {
    const cantidad = ingrediente.amount * factor;
    await db.mealItem.create({
      data: {
        id: newId(),
        mealId: input.mealId,
        foodId: ingrediente.foodId,
        name: ingrediente.food.name,
        amount: cantidad,
        unit: ingrediente.unit,
        ...scaleMacros(ingrediente.food, cantidad),
      },
    });
  }
}

export async function removeItem(itemId: string) {
  const item = await db.mealItem.findUnique({
    where: { id: itemId },
    include: { meal: { select: { status: true } } },
  });
  if (!item) return;
  if (item.meal.status !== "open") {
    throw new MealError("No se puede borrar un item de una comida cerrada.");
  }
  await db.mealItem.delete({ where: { id: itemId } });
}

/** Copia una comida anterior como una nueva, abierta y editable. */
export async function duplicateMeal(
  sourceMealId: string,
  mealType?: string,
  timeZone?: string,
) {
  const origen = await db.meal.findUnique({
    where: { id: sourceMealId },
    include: { items: { orderBy: { id: "asc" } } },
  });
  if (!origen) throw new MealError(`No existe la comida ${sourceMealId}`);

  const nueva = await startMeal({
    mealType: mealType ?? origen.mealType,
    recipeId: null, // los items ya vienen copiados; no se re-expande la receta
    timeZone: timeZone ?? origen.timezone,
  });

  for (const item of origen.items) {
    await db.mealItem.create({
      data: {
        id: newId(),
        mealId: nueva.id,
        foodId: item.foodId,
        name: item.name,
        amount: item.amount,
        unit: item.unit,
        kcal: item.kcal,
        proteinG: item.proteinG,
        carbsG: item.carbsG,
        fatG: item.fatG,
      },
    });
  }

  if (origen.recipeId) {
    await db.meal.update({ where: { id: nueva.id }, data: { recipeId: origen.recipeId } });
  }

  return nueva;
}

/**
 * Descarta una comida abierta sin emitir evento. Solo si está vacía.
 *
 * El gimnasio tenía `discardSession` y la comida no: se podía abrir el flujo,
 * arrepentirse, y quedaba colgando para siempre sin forma de quitarla.
 */
export async function discardMeal(mealId: string) {
  const meal = await db.meal.findUnique({
    where: { id: mealId },
    include: { _count: { select: { items: true } } },
  });
  if (!meal) return;
  if (meal.status !== "open") {
    throw new MealError("Solo se descartan comidas abiertas.");
  }
  if (meal._count.items > 0) {
    throw new MealError(
      "La comida tiene items registrados. Ciérrala en vez de descartarla.",
    );
  }
  await db.meal.delete({ where: { id: mealId } });
}

export type CloseMealResult = {
  mealId: string;
  eventId: string;
  itemCount: number;
} & Macros;

export async function closeMeal(
  mealId: string,
  options: { fullnessAfter?: number | null; notes?: string | null } = {},
): Promise<CloseMealResult> {
  const meal = await db.meal.findUnique({
    where: { id: mealId },
    include: { recipe: true, items: true },
  });
  if (!meal) throw new MealError(`No existe la comida ${mealId}`);
  if (meal.status !== "open") throw new MealError("La comida ya está cerrada.");

  const totales = sumMacros(
    meal.items.map((i) => ({
      kcal: i.kcal,
      proteinG: i.proteinG,
      carbsG: i.carbsG,
      fatG: i.fatG,
    })),
  );

  const evento = await emit({
    kind: "meal.logged",
    payload: {
      mealId,
      mealType: meal.mealType,
      recipe: meal.recipe?.name,
      itemCount: meal.items.length,
      kcal: totales.kcal ?? undefined,
      proteinG: totales.proteinG ?? undefined,
      carbsG: totales.carbsG ?? undefined,
      fatG: totales.fatG ?? undefined,
    },
    startedAt: meal.startedAt,
    timezone: meal.timezone,
    entityId: meal.placeEntityId,
    source: "app:food",
  });

  await db.meal.update({
    where: { id: mealId },
    data: {
      endedAt: new Date(),
      status: "closed",
      ...totales,
      fullnessAfter: options.fullnessAfter ?? meal.fullnessAfter,
      notes: options.notes ?? meal.notes,
      eventId: evento.id,
    },
  });

  return { mealId, eventId: evento.id, itemCount: meal.items.length, ...totales };
}
