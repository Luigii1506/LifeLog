/**
 * Jerarquía de navegación.
 *
 * El botón de atrás va al PADRE LÓGICO, no al historial del navegador. En una
 * app que es un bucle —registras, vuelves, registras— el historial se llena de
 * pasos intermedios y «atrás» acaba llevándote a sitios sin sentido.
 */

export type NavDestination = { value: string; label: string };

const PADRES: [patron: RegExp, padre: string][] = [
  [/^\/food\/guiado\//, "/food"],
  [/^\/registrar\//, "/"],
  [/^\/food$/, "/"],
  [/^\/gym$/, "/"],
];

export function parentOf(pathname: string): string | null {
  if (pathname === "/") return null;
  const encontrado = PADRES.find(([patron]) => patron.test(pathname));
  return encontrado ? encontrado[1] : "/";
}

/** Título corto de cada zona, para la barra superior. */
export function titleOf(pathname: string): string | null {
  if (pathname === "/") return null;
  if (pathname.startsWith("/gym")) return "Gimnasio";
  if (pathname.startsWith("/food")) return "Comida";
  if (pathname.startsWith("/registrar")) return "Registrar";
  return null;
}

/**
 * Órdenes de navegación por voz.
 *
 * Van junto a los destinos de registro en el mismo botón: quien habla no
 * distingue entre «llévame a» y «quiero registrar», y no debería tener que
 * hacerlo.
 */
export const ORDENES_NAVEGACION: NavDestination[] = [
  { value: "/", label: "inicio hoy menu principal casa" },
  { value: "__atras", label: "atras regresa regresar volver salir cancelar" },
];
