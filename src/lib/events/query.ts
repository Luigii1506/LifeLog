import { db } from "@/lib/db";
import { kindDefinition, isEventKind } from "./kinds";

import { dateKeyIn, dayBoundsIn } from "@/lib/timezone";

/**
 * Zona con la que se agrupan los días cuando no se sabe la del usuario.
 *
 * Antes se usaba la del servidor: en Vercel eso es UTC, así que para alguien
 * en Tijuana «hoy» empezaba a las 17:00 del día anterior y la línea de tiempo
 * mezclaba dos días.
 */
const ZONA_POR_DEFECTO = "America/Tijuana";

/** Límites del día en la zona del usuario. */
export function dayBounds(date: Date, timeZone: string = ZONA_POR_DEFECTO) {
  return dayBoundsIn(date, timeZone);
}

/** YYYY-MM-DD del día en la zona del usuario. La clave de DailyMetric. */
export function localDateKey(date: Date, timeZone: string = ZONA_POR_DEFECTO) {
  return dateKeyIn(date, timeZone);
}

export type TimelineEntry = {
  id: string;
  kind: string;
  domain: string;
  label: string;
  startedAt: Date;
  endedAt: Date | null;
  timezone: string;
  entityId: string | null;
  payload: Record<string, unknown>;
};

/**
 * Línea de tiempo del día: la vista que justifica que la columna vertebral
 * exista. Es lo único que ve todos los dominios a la vez.
 *
 * Excluye los eventos revocados (I-02): un evento anulado por una corrección
 * posterior no aparece, pero sigue en la base.
 */
/**
 * Los ids anulados de entre los que se le pasen (I-02).
 *
 * La corrección puede llegar CUALQUIER DÍA: te das cuenta mañana de que ayer
 * registraste mal. Por eso se pregunta a la base en vez de buscar la anulación
 * dentro de la misma ventana — así no reaparece un evento corregido tarde.
 *
 * Vive aquí y no en cada consulta para que la línea de tiempo y el estado de
 * las tarjetas no puedan discrepar sobre qué cuenta como registrado.
 */
export async function revokedAmong(ids: string[]): Promise<Set<string>> {
  if (ids.length === 0) return new Set();
  const anulaciones = await db.event.findMany({
    where: { revokesId: { in: ids } },
    select: { revokesId: true },
  });
  return new Set(
    anulaciones.map((a) => a.revokesId).filter((id): id is string => id !== null),
  );
}

export async function timelineForDay(
  date: Date,
  timeZone?: string,
): Promise<TimelineEntry[]> {
  const { start, end } = dayBounds(date, timeZone);

  const events = await db.event.findMany({
    where: { startedAt: { gte: start, lt: end } },
    orderBy: { startedAt: "asc" },
  });

  const revoked = await revokedAmong(events.map((e) => e.id));

  return events
    .filter((e) => !revoked.has(e.id))
    .map((e) => ({
      id: e.id,
      kind: e.kind,
      domain: e.domain,
      label: isEventKind(e.kind) ? kindDefinition(e.kind).label : e.kind,
      startedAt: e.startedAt,
      endedAt: e.endedAt,
      timezone: e.timezone,
      entityId: e.entityId,
      payload: safeParse(e.payloadJson),
    }));
}

function safeParse(json: string): Record<string, unknown> {
  try {
    const parsed: unknown = JSON.parse(json);
    return typeof parsed === "object" && parsed !== null
      ? (parsed as Record<string, unknown>)
      : {};
  } catch {
    return {};
  }
}

export type OpenActivity = { id: string; activity: string; startedAt: Date };

/**
 * Actividades iniciadas y no terminadas.
 *
 * `activity.started` sin su `activity.ended` deja la actividad colgando. Sin
 * esta consulta no hay forma de cerrarla desde la interfaz, y en un mes
 * tendrías treinta gimnasios abiertos.
 */
export async function openActivities(
  date: Date,
  timeZone?: string,
): Promise<OpenActivity[]> {
  const { start, end } = dayBounds(date, timeZone);

  const eventos = await db.event.findMany({
    where: {
      kind: { in: ["activity.started", "activity.ended"] },
      startedAt: { gte: start, lt: end },
    },
    orderBy: { startedAt: "asc" },
  });

  const abiertas = new Map<string, OpenActivity>();
  for (const evento of eventos) {
    const payload = safeParse(evento.payloadJson);
    const nombre = typeof payload.activity === "string" ? payload.activity : null;
    if (!nombre) continue;

    if (evento.kind === "activity.started") {
      abiertas.set(nombre, { id: evento.id, activity: nombre, startedAt: evento.startedAt });
    } else {
      abiertas.delete(nombre);
    }
  }
  return [...abiertas.values()];
}
