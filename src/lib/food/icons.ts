/**
 * Iconos por palabra clave. Presentación pura, sin acceso a datos.
 *
 * Vive aparte de `suggestions.ts` porque aquello consulta la base, y quien
 * solo quiere pintar un emoji no debería arrastrar una conexión de Postgres.
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
  return new RegExp(`(?<!\\p{L})(?:${formas.join("|")})(?!\\p{L})`, "iu");
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
 * oliva» como sugerencia de desayuno. Es un prior razonable, no una
 * preferencia: en cuanto hay historial, la frecuencia real lo desplaza.
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

export function prioridadFria(nombre: string, mealType: string): number {
  const patrones = PRIOR_FRIO[mealType] ?? [];
  const posicion = patrones.findIndex((p) => p.test(nombre));
  return posicion === -1 ? 0 : patrones.length - posicion;
}
