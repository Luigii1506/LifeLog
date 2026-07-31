/**
 * Jerarquía de navegación.
 *
 * El botón de atrás va al PADRE LÓGICO, no al historial del navegador. En una
 * app que es un bucle —registras, vuelves, registras— el historial se llena de
 * pasos intermedios y «atrás» acaba llevándote a sitios sin sentido.
 */

export type NavDestination = { value: string; label: string };

const PADRES: [patron: RegExp, padre: string][] = [
  [/^\/registrar\//, "/"],
  [/^\/food$/, "/"],
  [/^\/agua$/, "/"],
  [/^\/suplementos$/, "/"],
  [/^\/notas$/, "/"],
  [/^\/gasto$/, "/"],
  [/^\/gym$/, "/"],
];

/**
 * El padre lógico de una pantalla.
 *
 * El gimnasio necesita los parámetros de la URL porque su profundidad no está
 * en la ruta: `/gym` es a la vez el selector de grupo, la lista de ejercicios y
 * el registro de series, y lo que las distingue es `?grupo=` y `?ejercicio=`.
 *
 * Sin esto, «atrás» desde una serie te mandaba a Hoy — que es tres pantallas
 * de más. Lo obvio al terminar un ejercicio es volver a los ejercicios del
 * mismo grupo, igual que el grupo se queda pegado al elegir.
 */
export function parentOf(pathname: string, search?: URLSearchParams | null): string | null {
  if (pathname === "/") return null;

  if (pathname === "/gym") {
    // Registrando series → la lista de ejercicios, con el grupo pegado.
    if (search?.get("ejercicio")) return "/gym";

    // Lista de ejercicios de un grupo concreto → el selector de grupo.
    // `?grupo=` vacío es distinto de ausente: es la forma de PEDIR el selector,
    // y desde el selector se sale a Hoy.
    const grupo = search?.get("grupo");
    if (grupo) return "/gym?grupo=";

    // `/gym` a secas es ambiguo: sin sesión abierta muestra el selector de
    // grupo, y con sesión abierta la lista del grupo pegado. La URL no lo dice
    // y la barra superior no consulta la base. Hoy sirve para ambos.
    return "/";
  }

  const encontrado = PADRES.find(([patron]) => patron.test(pathname));
  return encontrado ? encontrado[1] : "/";
}

/** Título corto de cada zona, para la barra superior. */
export function titleOf(pathname: string): string | null {
  if (pathname === "/") return null;
  if (pathname.startsWith("/gym")) return "Gimnasio";
  if (pathname.startsWith("/food")) return "Comida";
  if (pathname.startsWith("/agua")) return "Agua";
  if (pathname.startsWith("/suplementos")) return "Suplementos";
  if (pathname.startsWith("/notas")) return "Notas";
  if (pathname.startsWith("/gasto")) return "Gasto";
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
