/**
 * "HH:MM" → el instante de hoy a esa hora.
 *
 * Existe porque «Desperté» debe guardar la hora a la que despertaste, no la
 * hora en que abriste la app. Sin esto, registrar a las 9 lo que pasó a las
 * 7:32 falsea toda la serie de sueño.
 */
export function timeOfDayToDate(hhmm: string, now: Date = new Date()): Date | undefined {
  const partes = hhmm.split(":");
  if (partes.length !== 2) return undefined;

  const h = Number(partes[0]);
  const m = Number(partes[1]);
  if (!Number.isInteger(h) || !Number.isInteger(m)) return undefined;
  if (h < 0 || h > 23 || m < 0 || m > 59) return undefined;

  const cuando = new Date(now);
  cuando.setHours(h, m, 0, 0);

  // Si sale en el futuro, la hora era de ayer: a las 00:20 registrando las
  // 07:30, ese 07:30 ya pasó.
  if (cuando.getTime() > now.getTime() + 60_000) {
    cuando.setDate(cuando.getDate() - 1);
  }
  return cuando;
}
