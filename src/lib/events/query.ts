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
export const ZONA_POR_DEFECTO = "America/Tijuana";

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
 * Marca de RETIRADA: el evento no corrige nada, borra.
 *
 * Corregir y retirar se parecen —los dos anulan al anterior— pero terminan
 * distinto: la corrección deja un dato nuevo a la vista, la retirada no debe
 * dejar nada.
 *
 * Y con solo `revokesId` eso no se puede expresar. B anula a A, pero entonces B
 * queda visible; C anula a B y queda C. La cadena nunca termina: siempre sobra
 * uno. Por eso hace falta una marca explícita, y va en `source` porque es el
 * único campo libre que ya existe — la tabla es append-only y no admite un
 * estado que se actualice después.
 */
export const SUFIJO_RETIRADO = ":retirado";

/**
 * Marcas de retirada anteriores a `:retirado`.
 *
 * El deshacer del agua nació antes que la marca y usaba `:deshacer`. Esos
 * eventos siguen en el log —nada se borra— y sin reconocerlos aparecen como
 * tomas de 0 ml: sesenta y tres filas de «Agua» que nadie registró.
 *
 * Se reconocen en vez de migrarse: son datos que ya existen, y reescribir el
 * log para arreglar una consulta es exactamente lo que I-02 prohíbe.
 */
const SUFIJOS_LEGADO = [":deshacer"];

/**
 * Los ids que NO deben verse, de entre los que se le pasen (I-02).
 *
 * Se ocultan dos cosas: lo anulado por una corrección posterior, y las propias
 * retiradas. La corrección puede llegar CUALQUIER DÍA —te das cuenta mañana de
 * que ayer registraste mal— así que se pregunta a la base en vez de buscar la
 * anulación dentro de la misma ventana.
 *
 * Vive aquí y no en cada consulta para que la línea de tiempo, las tarjetas y
 * los totales no puedan discrepar sobre qué cuenta como registrado.
 */
export async function revokedAmong(ids: string[]): Promise<Set<string>> {
  if (ids.length === 0) return new Set();

  const [anulaciones, retiradas] = await Promise.all([
    db.event.findMany({
      where: { revokesId: { in: ids } },
      select: { revokesId: true },
    }),
    db.event.findMany({
      where: {
        id: { in: ids },
        OR: [
          { source: { endsWith: SUFIJO_RETIRADO } },
          ...SUFIJOS_LEGADO.map((s) => ({ source: { endsWith: s } })),
        ],
      },
      select: { id: true },
    }),
  ]);

  const ocultos = new Set<string>();
  for (const a of anulaciones) if (a.revokesId) ocultos.add(a.revokesId);
  for (const r of retiradas) ocultos.add(r.id);
  return ocultos;
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
    .filter((e) => registraAlgo(e.kind, safeParse(e.payloadJson)))
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

/**
 * ¿Este evento registra algo?
 *
 * Un trago de 0 ml no es un trago: son los eventos de deshacer de antes de que
 * existiera la marca de retirada. Sin este filtro, la línea de tiempo decía
 * «Agua ×23» mientras la pantalla de agua contaba 4 tomas — y cuando dos
 * pantallas discrepan sobre el mismo día, se deja de creer a las dos.
 */
function registraAlgo(kind: string, payload: Record<string, unknown>): boolean {
  if (kind === "water.logged") return (payload.ml as number) > 0;
  return true;
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
