import { QUICK_FLOWS } from "./quick/catalog";

/**
 * La cadena de secciones, en el orden de la pantalla de Hoy.
 *
 * Deslizar recorre esta lista. Funciona porque el orden es VISIBLE: es
 * exactamente el de las tarjetas de Hoy, de izquierda a derecha y de arriba
 * abajo. Un gesto que salta a un sitio que no puedes prever no se usa.
 *
 * Por eso los flujos rápidos salen de `QUICK_FLOWS`, la misma lista que pinta
 * las tarjetas: si se reordenan ahí, la cadena se reordena sola. Con dos listas
 * separadas, deslizar acabaría llevando a un sitio distinto del que enseña la
 * rejilla y nadie sabría por qué.
 */

export type Section = {
  href: string;
  label: string;
  icon: string;
  /** Sale en la barra inferior. Solo las cuatro principales. */
  enBarra?: boolean;
};

/**
 * Las cuatro que llevan barra propia, en el orden del día: se bebe agua todo
 * el rato, se entrena una vez, se come varias.
 */
const PRINCIPALES: Section[] = [
  { href: "/", label: "Hoy", icon: "☀️", enBarra: true },
  { href: "/agua", label: "Agua", icon: "💧", enBarra: true },
  { href: "/gym", label: "Gimnasio", icon: "🏋️", enBarra: true },
  { href: "/food", label: "Comida", icon: "🍽️", enBarra: true },
];

export const SECCIONES: Section[] = [
  ...PRINCIPALES,
  ...QUICK_FLOWS.map((f) => ({
    href: f.href ?? `/registrar/${f.id}`,
    label: f.label,
    icon: f.icon,
  })),
];

/** Las de la barra inferior. */
export const EN_BARRA = SECCIONES.filter((s) => s.enBarra);

/** En qué eslabón estás, o -1 si la ruta no está en la cadena. */
export function sectionIndex(pathname: string): number {
  if (pathname === "/") return 0;
  // Se compara la ruta completa para los flujos: `/registrar/weight` no debe
  // casar con `/registrar/wake` por ser prefijo.
  return SECCIONES.findIndex(
    (s) =>
      s.href !== "/" && (pathname === s.href || pathname.startsWith(`${s.href}/`)),
  );
}

/**
 * El eslabón vecino, o null si no hay.
 *
 * No da la vuelta a propósito. Con una lista circular nunca sabes si avanzas o
 * has vuelto al principio, y con doce paradas eso se nota enseguida.
 */
export function neighbour(pathname: string, delta: 1 | -1): string | null {
  const i = sectionIndex(pathname);
  if (i < 0) return null;
  const destino = SECCIONES[i + delta];
  return destino ? destino.href : null;
}
