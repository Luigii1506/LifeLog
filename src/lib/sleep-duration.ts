/**
 * Cuánto dormiste, a partir de la hora a la que te acostaste.
 *
 * Registrar el sueño ocurre DESPUÉS de despertar —no se puede registrar
 * dormido—, así que la hora de despertar ya existe y las horas se deducen. Eso
 * cambia la pregunta: de «¿cuántas horas dormiste?», que obliga a una resta de
 * memoria y medio dormido, a «¿a qué hora te dormiste?», que se sabe.
 *
 * La sutileza está en la medianoche. «23:00» y «02:00» son ambas anteriores a
 * un despertar a las 07:30, pero una es de ayer y la otra de hoy. En vez de
 * adivinar con reglas sobre el número, se toma **la ocurrencia más reciente de
 * esa hora de reloj que sea anterior al despertar**: eso resuelve los dos casos
 * sin distinguirlos.
 *
 * Y la hora de reloj se interpreta SIEMPRE en la zona del usuario, nunca en la
 * de quien ejecuta. `setHours` usa la zona del proceso: en Vercel eso es UTC, y
 * «me dormí a la 1» acababa significando la 1 UTC —las 18:00 del día anterior
 * en Tijuana— así que una noche de siete horas se guardaba como catorce.
 */

import { partsIn, zonedToInstant } from "./timezone";

/** Menos de esto, no fue una noche de sueño. */
const MINIMO_MINUTOS = 45;
/** Más de esto, casi siempre es la rueda mal girada. */
const MAXIMO_MINUTOS = 16 * 60;

export type Duracion = {
  minutos: number;
  /** Dentro del rango de una noche creíble. */
  plausible: boolean;
};

/**
 * El instante en que empezó a dormir, dado el reloj elegido y el despertar.
 *
 * Devuelve siempre un instante ANTERIOR a `hasta`, retrocediendo un día si
 * hace falta. Con acostarse a las 23:00 y despertar a las 07:30, la fecha de
 * acostarse es la de ayer sin que nadie tenga que decirlo.
 */
export function instanteDeAcostarse(
  hora: { hour: number; minute: number },
  hasta: Date,
  timeZone: string,
): Date {
  const { year, month, day } = partsIn(hasta, timeZone);

  let candidato = zonedToInstant(year, month, day, hora.hour, hora.minute, timeZone);
  if (candidato.getTime() >= hasta.getTime()) {
    // Un día antes EN LA ZONA, no restando 24 h: en el cambio de horario un día
    // dura 23 o 25, y restar horas fijas movería la hora de acostarse.
    const ayer = new Date(Date.UTC(year, month - 1, day - 1));
    candidato = zonedToInstant(
      ayer.getUTCFullYear(),
      ayer.getUTCMonth() + 1,
      ayer.getUTCDate(),
      hora.hour,
      hora.minute,
      timeZone,
    );
  }
  return candidato;
}

export function duracionHasta(
  hora: { hour: number; minute: number },
  hastaISO: string,
  timeZone: string,
): Duracion | null {
  const hasta = new Date(hastaISO);
  if (Number.isNaN(hasta.getTime())) return null;

  const desde = instanteDeAcostarse(hora, hasta, timeZone);
  const minutos = Math.round((hasta.getTime() - desde.getTime()) / 60000);

  return {
    minutos,
    plausible: minutos >= MINIMO_MINUTOS && minutos <= MAXIMO_MINUTOS,
  };
}

/** «8h 30m», «7h», «45 min». */
export function formatoHoras(minutos: number): string {
  if (minutos < 60) return `${minutos} min`;
  const h = Math.floor(minutos / 60);
  const m = minutos % 60;
  return m > 0 ? `${h}h ${m}m` : `${h}h`;
}
