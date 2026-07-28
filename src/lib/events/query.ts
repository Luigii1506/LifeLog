import { db } from "@/lib/db";
import { kindDefinition, isEventKind } from "./kinds";

/** Límites del día en zona horaria local. */
export function dayBounds(date: Date) {
  const start = new Date(date);
  start.setHours(0, 0, 0, 0);
  const end = new Date(start);
  end.setDate(end.getDate() + 1);
  return { start, end };
}

/** YYYY-MM-DD local, la clave de DailyMetric. */
export function localDateKey(date: Date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

export type TimelineEntry = {
  id: string;
  kind: string;
  domain: string;
  label: string;
  startedAt: Date;
  endedAt: Date | null;
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
export async function timelineForDay(date: Date): Promise<TimelineEntry[]> {
  const { start, end } = dayBounds(date);

  const events = await db.event.findMany({
    where: { startedAt: { gte: start, lt: end } },
    orderBy: { startedAt: "asc" },
  });

  const revoked = new Set(
    events.map((e) => e.revokesId).filter((id): id is string => id !== null),
  );

  return events
    .filter((e) => !revoked.has(e.id))
    .map((e) => ({
      id: e.id,
      kind: e.kind,
      domain: e.domain,
      label: isEventKind(e.kind) ? kindDefinition(e.kind).label : e.kind,
      startedAt: e.startedAt,
      endedAt: e.endedAt,
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
