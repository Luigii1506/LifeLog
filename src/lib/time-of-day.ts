import { partsIn, zonedToInstant } from "./timezone";

/**
 * "HH:MM" en la zona del usuario → el instante absoluto.
 *
 * Existe porque «Desperté» debe guardar la hora a la que despertaste, no la
 * hora en que abriste la app.
 *
 * La zona es obligatoria: sin ella se usaba la del servidor, y en producción
 * eso desplazaba cada evento siete horas.
 */
export function timeOfDayToDate(
  hhmm: string,
  timeZone: string,
  now: Date = new Date(),
): Date | undefined {
  const partes = hhmm.split(":");
  if (partes.length !== 2) return undefined;

  const h = Number(partes[0]);
  const m = Number(partes[1]);
  if (!Number.isInteger(h) || !Number.isInteger(m)) return undefined;
  if (h < 0 || h > 23 || m < 0 || m > 59) return undefined;

  const hoy = partsIn(now, timeZone);
  let cuando = zonedToInstant(hoy.year, hoy.month, hoy.day, h, m, timeZone);

  // Si sale en el futuro, la hora era de ayer: a las 00:20 registrando las
  // 07:30, ese 07:30 ya pasó.
  if (cuando.getTime() > now.getTime() + 60_000) {
    const ayer = partsIn(new Date(now.getTime() - 86_400_000), timeZone);
    cuando = zonedToInstant(ayer.year, ayer.month, ayer.day, h, m, timeZone);
  }
  return cuando;
}
