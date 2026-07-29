import { db } from "@/lib/db";

/**
 * Sugerencias para la captura guiada.
 *
 * Es la pieza que decide si el flujo guiado sirve. Cuatro tarjetas fijas son
 * el desayuno de otra persona; cuatro tarjetas sacadas de lo que tú comes de
 * verdad quitan la escritura casi por completo.
 *
 * Degrada solo: sin historial devuelve el catálogo, y a medida que se
 * acumulan comidas el ranking por frecuencia toma el control. El día uno
 * funciona; el día treinta funciona mejor.
 */

export type FoodSuggestion = {
  id: string;
  name: string;
  unit: string;
  icon: string | null;
  /** Cantidad más frecuente en este contexto. Prellena el siguiente paso. */
  usualAmount: number | null;
  /** Veces registrado. 0 significa que viene del catálogo, no del historial. */
  timesLogged: number;
};

/**
 * Iconos por palabra clave.
 *
 * Los patrones se construyen con lookarounds sobre \p{L} en vez de \b, por dos
 * bugs reales:
 *   - \b es ASCII: después de «é» no hay límite de palabra, así que /\bcafé\b/
 *     nunca casaba con «Café negro».
 *   - Sin límite alguno, /pan/ casa dentro de «queso panela» y /res/ dentro de
 *     «fresas» — un sándwich en el queso y un filete en la fruta.
 *
 * Gana la primera coincidencia, así que lo específico va antes que lo genérico.
 */
function palabras(...formas: string[]): RegExp {
  const alternativas = formas.join("|");
  return new RegExp(`(?<!\\p{L})(?:${alternativas})(?!\\p{L})`, "iu");
}

const ICONOS: [RegExp, string][] = [
  [palabras("huevos?", "claras?"), "🍳"],
  [palabras("pollos?", "pechugas?"), "🍗"],
  [palabras("tortillas?"), "🫓"],
  [palabras("frijoles?"), "🫘"],
  [palabras("aguacates?"), "🥑"],
  [palabras("arroz"), "🍚"],
  [palabras("quesos?"), "🧀"],
  [palabras("caf[eé]s?"), "☕"],
  [palabras("leches?", "licuados?", "yogur\\w*"), "🥛"],
  [palabras("pan", "panes", "s[áa]ndwich\\w*", "tortas?", "bagels?"), "🥪"],
  [palabras("carnes?", "res", "bistec\\w*", "filetes?"), "🥩"],
  [palabras("pescados?", "at[uú]n", "salm[oó]n"), "🐟"],
  [palabras("manzanas?", "frutas?", "pl[áa]tanos?", "fresas?", "naranjas?"), "🍎"],
  [palabras("ensaladas?", "verduras?", "lechugas?", "jitomates?"), "🥗"],
  [palabras("avena", "cereal\\w*", "granola"), "🥣"],
  [palabras("prote[íi]nas?", "whey", "isolate"), "🥤"],
  [palabras("papas?", "pastas?"), "🥔"],
  [palabras("nueces?", "nuez", "cacahuates?", "almendras?"), "🥜"],
  [palabras("tacos?"), "🌮"],
  [palabras("aceites?", "mantequillas?"), "🫒"],
];

export function iconFor(name: string): string | null {
  return ICONOS.find(([patron]) => patron.test(name))?.[1] ?? null;
}

/**
 * Orden para el arranque en frío.
 *
 * El día uno no hay frecuencia y ordenar alfabéticamente pone «Aceite de
 * oliva» y «Almendras» como sugerencias de desayuno. Esto es un prior
 * razonable, no una preferencia: en cuanto hay historial, la frecuencia real
 * lo desplaza por completo.
 */
const PRIOR_FRIO: Record<string, RegExp[]> = {
  desayuno: [
    palabras("huevos?", "claras?"), palabras("avena"), palabras("caf[eé]s?"),
    palabras("pan", "panes"), palabras("yogur\\w*"),
    palabras("frutas?", "pl[áa]tanos?", "manzanas?", "fresas?"),
    palabras("leches?"), palabras("jam[óo]n"),
  ],
  comida: [
    palabras("pollos?", "pechugas?"), palabras("arroz"), palabras("frijoles?"),
    palabras("tortillas?"), palabras("carnes?", "res"), palabras("verduras?"),
    palabras("pescados?"), palabras("papas?", "pastas?"),
  ],
  cena: [
    palabras("huevos?", "claras?"), palabras("pollos?", "pechugas?"),
    palabras("at[uú]n"), palabras("ensaladas?", "lechugas?", "verduras?"),
    palabras("quesos?"), palabras("tortillas?"), palabras("aguacates?"),
  ],
  snack: [
    palabras("almendras?", "nueces?", "cacahuates?"),
    palabras("frutas?", "pl[áa]tanos?", "manzanas?", "fresas?"),
    palabras("yogur\\w*"), palabras("prote[íi]nas?"), palabras("quesos?"),
  ],
};

function prioridadFria(nombre: string, mealType: string): number {
  const patrones = PRIOR_FRIO[mealType] ?? [];
  const posicion = patrones.findIndex((p) => p.test(nombre));
  return posicion === -1 ? 0 : patrones.length - posicion;
}

/** Cantidad más repetida de una lista. La moda, no la media: comes 3 huevos
 *  o 2, nunca 2.4. */
function moda(valores: (number | null)[]): number | null {
  const limpios = valores.filter((v): v is number => v !== null);
  if (limpios.length === 0) return null;
  const cuenta = new Map<number, number>();
  for (const v of limpios) cuenta.set(v, (cuenta.get(v) ?? 0) + 1);
  return [...cuenta.entries()].sort((a, b) => b[1] - a[1])[0][0];
}

/**
 * Los alimentos que más registras en este tipo de comida.
 * Rellena con el catálogo hasta completar `limit`.
 */
export async function topFoodsForMealType(
  mealType: string,
  limit = 8,
): Promise<FoodSuggestion[]> {
  const items = await db.mealItem.findMany({
    where: { foodId: { not: null }, meal: { mealType, status: "closed" } },
    select: { foodId: true, amount: true, food: true },
    orderBy: { meal: { startedAt: "desc" } },
    take: 500,
  });

  const porAlimento = new Map<string, { food: NonNullable<(typeof items)[0]["food"]>; amounts: (number | null)[] }>();
  for (const item of items) {
    if (!item.food) continue;
    const entrada = porAlimento.get(item.food.id) ?? { food: item.food, amounts: [] };
    entrada.amounts.push(item.amount);
    porAlimento.set(item.food.id, entrada);
  }

  const delHistorial: FoodSuggestion[] = [...porAlimento.values()]
    .sort((a, b) => b.amounts.length - a.amounts.length)
    .slice(0, limit)
    .map(({ food, amounts }) => ({
      id: food.id,
      name: food.name,
      unit: food.unit,
      icon: iconFor(food.name),
      usualAmount: moda(amounts),
      timesLogged: amounts.length,
    }));

  if (delHistorial.length >= limit) return delHistorial;

  const yaEstan = new Set(delHistorial.map((s) => s.id));
  const candidatos = await db.food.findMany({
    where: { status: "active", id: { notIn: [...yaEstan] } },
    orderBy: { name: "asc" },
  });

  const relleno = candidatos
    .sort((a, b) => prioridadFria(b.name, mealType) - prioridadFria(a.name, mealType))
    .slice(0, limit - delHistorial.length);

  return [
    ...delHistorial,
    ...relleno.map((food) => ({
      id: food.id,
      name: food.name,
      unit: food.unit,
      icon: iconFor(food.name),
      usualAmount: food.unit === "unit" ? 1 : 100,
      timesLogged: 0,
    })),
  ];
}

/**
 * Con qué sueles acompañar un alimento.
 *
 * «Cuando comes huevos, ¿qué más comes?» — es la consulta que hace que el
 * segundo paso del flujo acierte. Sin ella el flujo guiado es un formulario
 * con más pantallas.
 */
export async function pairedWith(
  foodId: string,
  mealType: string,
  options: { exclude?: string[]; limit?: number } = {},
): Promise<FoodSuggestion[]> {
  const limit = options.limit ?? 6;
  const excluir = new Set([foodId, ...(options.exclude ?? [])]);

  const comidas = await db.meal.findMany({
    where: { mealType, status: "closed", items: { some: { foodId } } },
    select: { items: { select: { foodId: true, amount: true, food: true } } },
    orderBy: { startedAt: "desc" },
    take: 200,
  });

  const porAlimento = new Map<string, { food: NonNullable<(typeof comidas)[0]["items"][0]["food"]>; amounts: (number | null)[] }>();
  for (const comida of comidas) {
    for (const item of comida.items) {
      if (!item.food || excluir.has(item.food.id)) continue;
      const entrada = porAlimento.get(item.food.id) ?? { food: item.food, amounts: [] };
      entrada.amounts.push(item.amount);
      porAlimento.set(item.food.id, entrada);
    }
  }

  const acompañantes = [...porAlimento.values()]
    .sort((a, b) => b.amounts.length - a.amounts.length)
    .slice(0, limit)
    .map(({ food, amounts }) => ({
      id: food.id,
      name: food.name,
      unit: food.unit,
      icon: iconFor(food.name),
      usualAmount: moda(amounts),
      timesLogged: amounts.length,
    }));

  if (acompañantes.length >= limit) return acompañantes;

  // Sin co-ocurrencia todavía: lo más frecuente del tipo de comida sirve.
  const frecuentes = await topFoodsForMealType(mealType, limit + excluir.size);
  return [
    ...acompañantes,
    ...frecuentes
      .filter((f) => !excluir.has(f.id) && !acompañantes.some((a) => a.id === f.id))
      .slice(0, limit - acompañantes.length),
  ];
}

/**
 * Cantidades a ofrecer como botones para un alimento.
 * Las que tú usas primero; si no hay historial, una escala razonable.
 */
export async function amountPresets(
  foodId: string,
  unit: string,
): Promise<number[]> {
  const items = await db.mealItem.findMany({
    where: { foodId, meal: { status: "closed" } },
    select: { amount: true },
    orderBy: { id: "desc" },
    take: 100,
  });

  const cuenta = new Map<number, number>();
  for (const { amount } of items) {
    if (amount === null) continue;
    cuenta.set(amount, (cuenta.get(amount) ?? 0) + 1);
  }

  const usadas = [...cuenta.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 4)
    .map(([valor]) => valor)
    .sort((a, b) => a - b);

  if (usadas.length >= 3) return usadas;

  const porDefecto = unit === "unit" ? [1, 2, 3, 4] : [50, 100, 150, 200];
  return [...new Set([...usadas, ...porDefecto])].sort((a, b) => a - b).slice(0, 5);
}
