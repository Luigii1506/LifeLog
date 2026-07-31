/**
 * Las secciones principales, en orden.
 *
 * Una sola lista para la barra inferior y para el gesto de deslizar. Si cada
 * una tuviera el suyo, deslizar te llevaría a un sitio distinto del que marca
 * la pestaña, y el gesto dejaría de ser predecible — que es lo único que hace
 * útil un gesto.
 *
 * El orden es el del día: bebes agua todo el rato, entrenas una vez, comes
 * varias. Agua va primero porque es lo que más veces se abre.
 */

export type Section = {
  href: string;
  label: string;
  icon: string;
};

export const SECCIONES: Section[] = [
  { href: "/", label: "Hoy", icon: "☀️" },
  { href: "/agua", label: "Agua", icon: "💧" },
  { href: "/gym", label: "Gimnasio", icon: "🏋️" },
  { href: "/food", label: "Comida", icon: "🍽️" },
];

/** En qué sección estás, o -1 si la ruta no es una sección. */
export function sectionIndex(pathname: string): number {
  if (pathname === "/") return 0;
  return SECCIONES.findIndex((s) => s.href !== "/" && pathname.startsWith(s.href));
}

/**
 * La sección vecina, o null si no hay.
 *
 * No da la vuelta a propósito. Con una lista circular nunca sabes si vas hacia
 * adelante o has vuelto al principio, y el gesto pierde el sentido de posición
 * que le da la barra.
 */
export function neighbour(pathname: string, delta: 1 | -1): string | null {
  const i = sectionIndex(pathname);
  if (i < 0) return null;
  const destino = SECCIONES[i + delta];
  return destino ? destino.href : null;
}
