import { ulid } from "ulid";

/**
 * Identidad del sistema — ADR-116.
 *
 * Un solo formato de ID en todas las capas: las 1,491 entidades del vault, los
 * eventos, los dominios profundos y los activos. Un id se mueve entre capas sin
 * traducción, y es a la vez la referencia inmutable y el dato seudonimizado que
 * puede viajar a la nube (ADR-114).
 *
 * Los IDs se generan en la aplicación, no en la base: Postgres y SQLite no
 * comparten generador de ULID, y el formato debe sobrevivir a ADR-112.
 */

export const ULID_LENGTH = 26;
const CROCKFORD = /^[0-9A-HJKMNP-TV-Z]{26}$/;

/** ULID nuevo. `seed` en ms permite sembrar con el instante real del hecho. */
export function newId(seed?: number): string {
  return ulid(seed);
}

export function isId(value: unknown): value is string {
  return typeof value === "string" && CROCKFORD.test(value);
}

/**
 * Un id que no resuelve a nada es un error de integridad, no un dato ausente
 * (I-07). Nulo sí es válido: no todo evento apunta a una entidad.
 */
export function assertId(value: unknown, field: string): string {
  if (!isId(value)) {
    throw new Error(`${field} no es un ULID válido: ${String(value)}`);
  }
  return value;
}
