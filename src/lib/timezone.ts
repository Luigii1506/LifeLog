/**
 * Conversión entre hora local del usuario e instante absoluto.
 *
 * Existe por un bug real: `Intl…resolvedOptions().timeZone` devuelve la zona
 * de QUIEN EJECUTA. En una acción de servidor eso es Vercel —UTC— no el
 * teléfono. En desarrollo local coincidían y no se vio; en producción cada
 * evento quedaba siete horas desplazado y el agrupado por día usaba fronteras
 * UTC, así que «hoy» empezaba a las 17:00 del día anterior.
 *
 * La zona la manda el cliente y el servidor la respeta. Sin librerías: `Intl`
 * ya sabe los husos y los cambios de horario.
 */

/** Desfase de una zona respecto a UTC, en el instante dado. En milisegundos. */
export function offsetAt(instante: Date, timeZone: string): number {
  const formato = new Intl.DateTimeFormat("en-US", {
    timeZone,
    hour12: false,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
  const p = Object.fromEntries(
    formato.formatToParts(instante).map((x) => [x.type, x.value]),
  );
  const comoSiFueraUtc = Date.UTC(
    Number(p.year),
    Number(p.month) - 1,
    Number(p.day),
    Number(p.hour) % 24,
    Number(p.minute),
    Number(p.second),
  );
  return comoSiFueraUtc - instante.getTime();
}

/**
 * «Las 07:30 del 29 de julio en America/Tijuana» → el instante absoluto.
 *
 * Se calcula en dos pasos porque el desfase depende de la fecha: en marzo y en
 * julio la misma zona tiene offsets distintos, y usar el de hoy para una fecha
 * de otra estación se equivoca en una hora.
 */
export function zonedToInstant(
  year: number,
  month: number,
  day: number,
  hour: number,
  minute: number,
  timeZone: string,
): Date {
  const supuesto = Date.UTC(year, month - 1, day, hour, minute, 0, 0);
  const desfase = offsetAt(new Date(supuesto), timeZone);
  const corregido = supuesto - desfase;
  // Segunda pasada: si el primer ajuste cruzó un cambio de horario, el
  // desfase correcto es el del instante corregido, no el del supuesto.
  const desfase2 = offsetAt(new Date(corregido), timeZone);
  return new Date(supuesto - desfase2);
}

/** Partes de fecha de un instante, vistas desde una zona. */
export function partsIn(instante: Date, timeZone: string) {
  const formato = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    hour12: false,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
  const p = Object.fromEntries(
    formato.formatToParts(instante).map((x) => [x.type, x.value]),
  );
  return {
    year: Number(p.year),
    month: Number(p.month),
    day: Number(p.day),
    hour: Number(p.hour) % 24,
    minute: Number(p.minute),
  };
}

/** YYYY-MM-DD del día en curso EN ESA ZONA. La clave de DailyMetric. */
export function dateKeyIn(instante: Date, timeZone: string): string {
  const { year, month, day } = partsIn(instante, timeZone);
  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

/**
 * Límites del día en esa zona, como instantes absolutos.
 *
 * Sin esto, «hoy» se calcula con la medianoche del servidor: para alguien en
 * Tijuana, el día UTC empieza a las 17:00 del día anterior y la línea de
 * tiempo mezcla dos días.
 */
export function dayBoundsIn(instante: Date, timeZone: string) {
  const { year, month, day } = partsIn(instante, timeZone);
  const start = zonedToInstant(year, month, day, 0, 0, timeZone);
  const end = new Date(start.getTime() + 24 * 3600 * 1000);
  return { start, end };
}
