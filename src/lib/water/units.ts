/**
 * Metas y unidades del agua.
 *
 * Vive aparte de `queries.ts` por el mismo motivo que `catalog.ts` vive aparte
 * de `flows.ts`: ese módulo toca la base, y un componente de cliente que
 * importara de ahí arrastraría Prisma al bundle del navegador. Aquí no hay más
 * que números y texto.
 */

/** La meta. Por debajo, el día está incompleto. */
export const META_ML = 2000;
/** A partir de aquí, excelente. */
export const EXCELENTE_ML = 3000;

/**
 * Recipientes por defecto. Son el arranque en frío: en cuanto haya historial,
 * lo que de verdad usas manda sobre esta lista.
 */
export const RECIPIENTES: { ml: number; label: string; icon: string }[] = [
  { ml: 250, label: "Vaso", icon: "🥛" },
  { ml: 500, label: "Botella", icon: "💧" },
  { ml: 750, label: "Termo", icon: "🍶" },
  { ml: 1000, label: "Litro", icon: "🫙" },
];

/** «1,2 L» o «750 ml». En litros a partir del litro, que es como se habla. */
export function formatoAgua(ml: number): string {
  if (ml < 1000) return `${ml} ml`;
  return `${(ml / 1000).toLocaleString("es-MX", { maximumFractionDigits: 1 })} L`;
}
