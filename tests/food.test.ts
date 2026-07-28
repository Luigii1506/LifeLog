import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { createTestDatabase } from "./setup-db";

let cleanup: () => void;
let db: typeof import("@/lib/db").db;
let food: typeof import("@/lib/food/meal");
let queries: typeof import("@/lib/food/queries");
let macros: typeof import("@/lib/food/macros");
let newId: typeof import("@/lib/ids").newId;

let polloId: string;
let huevoId: string;
let tortillaId: string;
let recetaId: string;

beforeAll(async () => {
  const test = createTestDatabase();
  cleanup = test.cleanup;
  process.env.DATABASE_URL = test.url;
  ({ db } = await import("@/lib/db"));
  food = await import("@/lib/food/meal");
  queries = await import("@/lib/food/queries");
  macros = await import("@/lib/food/macros");
  ({ newId } = await import("@/lib/ids"));
});

afterAll(async () => {
  await db.$disconnect();
  cleanup();
});

beforeEach(async () => {
  await db.mealItem.deleteMany();
  await db.meal.deleteMany();
  await db.recipeIngredient.deleteMany();
  await db.recipe.deleteMany();
  await db.food.deleteMany();

  polloId = newId();
  huevoId = newId();
  tortillaId = newId();
  await db.food.createMany({
    data: [
      // por 100 g
      { id: polloId, name: "Pechuga de pollo", unit: "g", kcal: 165, proteinG: 31, carbsG: 0, fatG: 3.6 },
      // por pieza
      { id: huevoId, name: "Huevo entero", unit: "unit", kcal: 72, proteinG: 6.3, carbsG: 0.4, fatG: 4.8 },
      { id: tortillaId, name: "Tortilla de maíz", unit: "unit", kcal: 52, proteinG: 1.4, carbsG: 10.7, fatG: 0.7 },
    ],
  });

  recetaId = newId();
  await db.recipe.create({
    data: { id: recetaId, name: "Desayuno habitual", mealType: "desayuno", servings: 1 },
  });
  await db.recipeIngredient.createMany({
    data: [
      { id: newId(), recipeId: recetaId, foodId: huevoId, amount: 3, unit: "unit", sortOrder: 0 },
      { id: newId(), recipeId: recetaId, foodId: tortillaId, amount: 2, unit: "unit", sortOrder: 1 },
    ],
  });
});

// ── La base de los macros ───────────────────────────────────────────────

describe("macros — la base de referencia", () => {
  it("los alimentos por peso escalan sobre 100", () => {
    const pollo = { unit: "g", kcal: 165, proteinG: 31, carbsG: 0, fatG: 3.6 };
    expect(macros.scaleMacros(pollo, 200).kcal).toBe(330);
    expect(macros.scaleMacros(pollo, 210).proteinG).toBe(65.1);
  });

  it("los alimentos por pieza escalan sobre 1", () => {
    const huevo = { unit: "unit", kcal: 72, proteinG: 6.3, carbsG: 0.4, fatG: 4.8 };
    expect(macros.scaleMacros(huevo, 3).kcal).toBe(216);
  });

  it("confundir las dos bases es el error clásico: 3 huevos no son 2.16 kcal", () => {
    const comoSiFueraPeso = { unit: "g", kcal: 72, proteinG: null, carbsG: null, fatG: null };
    const comoPieza = { unit: "unit", kcal: 72, proteinG: null, carbsG: null, fatG: null };
    expect(macros.scaleMacros(comoSiFueraPeso, 3).kcal).toBe(2.2);
    expect(macros.scaleMacros(comoPieza, 3).kcal).toBe(216);
  });

  it("un item sin macros cuenta como cero y no invalida el total", () => {
    const total = macros.sumMacros([
      { kcal: 100, proteinG: 10, carbsG: null, fatG: null },
      { kcal: null, proteinG: null, carbsG: null, fatG: null },
    ]);
    expect(total.kcal).toBe(100);
    expect(total.proteinG).toBe(10);
  });

  it("cantidad nula no calcula macros", () => {
    const pollo = { unit: "g", kcal: 165, proteinG: 31, carbsG: 0, fatG: 3.6 };
    expect(macros.scaleMacros(pollo, null).kcal).toBeNull();
  });
});

// ── Ciclo de vida ───────────────────────────────────────────────────────

describe("ciclo de vida de la comida", () => {
  it("abrir una comida cierra la anterior en vez de bloquear", async () => {
    const desayuno = await food.startMeal({ mealType: "desayuno" });
    await food.addItem({ mealId: desayuno.id, foodId: huevoId, amount: 2 });

    const comida = await food.startMeal({ mealType: "comida" });

    const anterior = await queries.getMeal(desayuno.id);
    expect(anterior!.status).toBe("closed");
    expect(anterior!.eventId).not.toBeNull();
    expect(comida.status).toBe("open");
  });

  it("una comida cerrada es inmutable", async () => {
    const m = await food.startMeal({ mealType: "cena" });
    await food.addItem({ mealId: m.id, foodId: polloId, amount: 200 });
    await food.closeMeal(m.id);

    await expect(
      food.addItem({ mealId: m.id, foodId: polloId, amount: 100 }),
    ).rejects.toThrow(/cerrada/);
  });

  it("acepta algo suelto que aún no es entidad", async () => {
    const m = await food.startMeal({ mealType: "snack" });
    const item = await food.addItem({ mealId: m.id, name: "Café de la esquina", amount: null });
    expect(item.name).toBe("Café de la esquina");
    expect(item.foodId).toBeNull();
  });

  it("un item sin nombre ni alimento es un error", async () => {
    const m = await food.startMeal({ mealType: "snack" });
    await expect(food.addItem({ mealId: m.id, amount: 100 })).rejects.toThrow(/nombre/);
  });
});

// ── I-11 ────────────────────────────────────────────────────────────────

describe("I-11 — el evento resumen es obligatorio", () => {
  it("cerrar emite meal.logged con los totales", async () => {
    const m = await food.startMeal({ mealType: "comida" });
    await food.addItem({ mealId: m.id, foodId: polloId, amount: 200 });
    await food.addItem({ mealId: m.id, foodId: tortillaId, amount: 3 });
    const r = await food.closeMeal(m.id);

    const evento = await db.event.findUnique({ where: { id: r.eventId } });
    expect(evento!.kind).toBe("meal.logged");
    expect(evento!.domain).toBe("nutrition");

    const payload = JSON.parse(evento!.payloadJson);
    expect(payload.mealId).toBe(m.id);
    expect(payload.itemCount).toBe(2);
    expect(payload.kcal).toBe(330 + 156);
    // El detalle NO viaja en el payload: vive en meal_items.
    expect(payload.items).toBeUndefined();
  });

  it("no queda ninguna comida cerrada sin evento", async () => {
    const m = await food.startMeal({ mealType: "cena" });
    await food.addItem({ mealId: m.id, foodId: huevoId, amount: 2 });
    await food.closeMeal(m.id);

    expect(await db.meal.count({ where: { status: "closed", eventId: null } })).toBe(0);
  });
});

// ── Recetas ─────────────────────────────────────────────────────────────

describe("recetas", () => {
  it("una receta se expande en items sueltos, no viaja como bloque", async () => {
    const m = await food.startMeal({ mealType: "desayuno", recipeId: recetaId });
    const detalle = await queries.getMeal(m.id);

    expect(detalle!.items).toHaveLength(2);
    expect(detalle!.items.map((i) => i.name).sort()).toEqual([
      "Huevo entero",
      "Tortilla de maíz",
    ]);
    // Se conserva el origen.
    expect(detalle!.recipeId).toBe(recetaId);
  });

  it("expandida se puede modificar solo lo distinto", async () => {
    const m = await food.startMeal({ mealType: "desayuno", recipeId: recetaId });
    const detalle = await queries.getMeal(m.id);

    // fuera las tortillas, dentro el pollo
    const tortillas = detalle!.items.find((i) => i.foodId === tortillaId)!;
    await food.removeItem(tortillas.id);
    await food.addItem({ mealId: m.id, foodId: polloId, amount: 150 });

    const final = await queries.getMeal(m.id);
    expect(final!.items.map((i) => i.name).sort()).toEqual([
      "Huevo entero",
      "Pechuga de pollo",
    ]);
  });

  it("las porciones escalan los ingredientes", async () => {
    const m = await food.startMeal({ mealType: "desayuno" });
    await food.addRecipe({ mealId: m.id, recipeId: recetaId, servings: 2 });

    const detalle = await queries.getMeal(m.id);
    const huevos = detalle!.items.find((i) => i.foodId === huevoId)!;
    expect(huevos.amount).toBe(6);
    expect(huevos.kcal).toBe(432);
  });
});

// ── El atajo que más se usa ─────────────────────────────────────────────

describe("repetir la comida de ayer", () => {
  it("lastMealOfType devuelve la última cerrada de ese tipo", async () => {
    const viejo = await food.startMeal({ mealType: "desayuno" });
    await food.addItem({ mealId: viejo.id, foodId: huevoId, amount: 2 });
    await food.closeMeal(viejo.id);

    const nuevo = await food.startMeal({ mealType: "desayuno" });
    await food.addItem({ mealId: nuevo.id, foodId: huevoId, amount: 3 });
    await food.closeMeal(nuevo.id);

    const ultimo = await queries.lastMealOfType("desayuno");
    expect(ultimo!.items[0].amount).toBe(3);
  });

  it("ignora las comidas abiertas: solo lo confirmado es referencia", async () => {
    const abierta = await food.startMeal({ mealType: "cena" });
    await food.addItem({ mealId: abierta.id, foodId: huevoId, amount: 2 });
    expect(await queries.lastMealOfType("cena")).toBeNull();
  });

  it("no mezcla tipos de comida", async () => {
    const d = await food.startMeal({ mealType: "desayuno" });
    await food.addItem({ mealId: d.id, foodId: huevoId, amount: 2 });
    await food.closeMeal(d.id);

    expect(await queries.lastMealOfType("cena")).toBeNull();
    expect(await queries.lastMealOfType("desayuno")).not.toBeNull();
  });

  it("duplicar copia los items y deja la copia editable", async () => {
    const origen = await food.startMeal({ mealType: "desayuno", recipeId: recetaId });
    await food.addItem({ mealId: origen.id, foodId: polloId, amount: 100 });
    await food.closeMeal(origen.id);

    const copia = await food.duplicateMeal(origen.id);
    const detalle = await queries.getMeal(copia.id);

    expect(detalle!.status).toBe("open");
    expect(detalle!.items).toHaveLength(3);
    expect(detalle!.recipeId).toBe(recetaId);
    // Y es editable: es el punto entero de duplicar.
    await food.addItem({ mealId: copia.id, name: "Salmas", amount: 1, unit: "unit" });
    expect((await queries.getMeal(copia.id))!.items).toHaveLength(4);
  });

  it("duplicar no re-expande la receta: copiaría los ingredientes dos veces", async () => {
    const origen = await food.startMeal({ mealType: "desayuno", recipeId: recetaId });
    await food.closeMeal(origen.id);

    const copia = await food.duplicateMeal(origen.id);
    expect((await queries.getMeal(copia.id))!.items).toHaveLength(2);
  });
});
