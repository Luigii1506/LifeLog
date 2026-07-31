/**
 * Categorías de gasto.
 *
 * Puro: no toca la base, así que la pantalla puede importarlo sin arrastrar
 * Prisma al navegador.
 *
 * Ocho y fijas. Es el número que cabe en dos filas de cuatro sin encoger nada,
 * y una lista libre acabaría en «comida», «Comida» y «comidas» — con lo que
 * sumar por categoría, que es para lo único que sirve clasificar, dejaría de
 * funcionar.
 */

export type Categoria = { id: string; label: string; icon: string };

export const CATEGORIAS: Categoria[] = [
  { id: "comida", label: "Comida", icon: "🍽" },
  { id: "super", label: "Súper", icon: "🛒" },
  { id: "transporte", label: "Transporte", icon: "⛽" },
  { id: "casa", label: "Casa", icon: "🏠" },
  { id: "salud", label: "Salud", icon: "💊" },
  { id: "ocio", label: "Ocio", icon: "🎬" },
  { id: "ropa", label: "Ropa", icon: "👕" },
  { id: "otro", label: "Otro", icon: "📦" },
];

/**
 * Resuelve una categoría, tolerando cómo se guardaba antes.
 *
 * El flujo anterior guardaba la etiqueta en minúsculas —«súper», con acento—
 * mientras que los ids van sin él. Comparar en crudo dejaría esos gastos sin
 * categoría, y no por un error del usuario sino por un cambio nuestro. Se
 * normaliza en vez de migrar: son datos que ya existen y no hacen daño.
 */
export function categoriaPorId(id: string | null | undefined): Categoria | undefined {
  if (!id) return undefined;
  const buscado = normalizar(id);
  return CATEGORIAS.find((c) => normalizar(c.id) === buscado);
}

function normalizar(s: string): string {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim();
}

/** «$250», «$1,250.50». Sin decimales cuando son cero, que es casi siempre. */
export function formatoDinero(monto: number): string {
  return `$${monto.toLocaleString("es-MX", {
    minimumFractionDigits: monto % 1 === 0 ? 0 : 2,
    maximumFractionDigits: 2,
  })}`;
}
