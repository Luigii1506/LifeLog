"use server";

import { revalidatePath } from "next/cache";
import { emit, EventValidationError, revoke } from "@/lib/events/emit";
import { db } from "@/lib/db";
import { SUFIJO_RETIRADO } from "@/lib/events/query";
import { isEventKind, type EventKind } from "@/lib/events/kinds";
import { timeOfDayToDate } from "@/lib/time-of-day";

/** Nombres de campo en español para los mensajes de error. */
const ETIQUETAS: Record<string, string> = {
  hours: "horas de sueño",
  quality: "calidad",
  kg: "kilogramos",
  amount: "monto",
  minutes: "minutos",
  score: "puntuación",
  activity: "actividad",
  text: "texto",
  name: "nombre",
};

export type ActionResult = { ok: true } | { ok: false; error: string };

/**
 * Único punto de escritura de eventos desde la interfaz.
 *
 * No confía en el cliente: revalida el kind y el payload en el servidor.
 * `source` lo pone el servidor, no el navegador — es dato de procedencia.
 */
export async function logEvent(
  kind: string,
  payload: unknown,
  options?: {
    entityId?: string;
    startedAt?: string;
    source?: string;
    timeZone?: string;
    /** Anula un evento anterior: corregir, no apilar (I-02). */
    revokesId?: string | null;
  },
): Promise<ActionResult> {
  if (!isEventKind(kind)) {
    return { ok: false, error: `Tipo de evento desconocido: ${kind}` };
  }

  try {
    await emit({
      kind: kind as EventKind,
      payload,
      entityId: options?.entityId,
      startedAt: options?.startedAt
        ? new Date(options.startedAt)
        : undefined,
      timezone: options?.timeZone,
      revokesId: options?.revokesId ?? null,
      source: options?.source ?? "app:today",
    });
  } catch (error) {
    if (error instanceof EventValidationError) {
      // Decir QUÉ campo falla, no solo que algo falla. Un error genérico
      // hace que el usuario reintente a ciegas — o que se rinda.
      const issues = error.issues as { path: (string | number)[]; message: string }[];
      const campos = issues
        .map((i) => ETIQUETAS[String(i.path[0])] ?? String(i.path[0]))
        .filter(Boolean);
      return {
        ok: false,
        error: campos.length
          ? `Falta o es inválido: ${[...new Set(campos)].join(", ")}`
          : "Datos inválidos",
      };
    }
    console.error("logEvent falló", error);
    return { ok: false, error: "No se pudo registrar" };
  }

  revalidatePath("/");
  return { ok: true };
}

/** Botones de un toque: sin formulario, sin confirmación, sin fricción. */
export async function logOneTap(kind: string): Promise<ActionResult> {
  const payloads: Record<string, unknown> = {
    "wake.up": {},
    "medication.taken": { name: "Medicamento" },
  };
  return logEvent(kind, payloads[kind] ?? {});
}

/**
 * Cierra un flujo guiado de dominio ligero.
 *
 * El cliente manda las respuestas crudas; el payload se arma AQUÍ, con la
 * misma especificación que generó los pasos. Así el cliente no puede inventar
 * campos ni saltarse la forma del evento.
 */
/**
 * Registra un flujo rápido, o CORRIGE el de hoy si se pasa `replacesId`.
 *
 * Corregir no apila un segundo registro: emite uno que anula al anterior
 * (I-02). El log conserva ambos —si una corrección se comiera un dato, se
 * recupera— pero todas las consultas filtran los anulados, así que para quien
 * usa la app es una edición y punto.
 */
export async function logQuickFlow(
  flowId: string,
  answers: Record<string, string | number>,
  timeZone: string,
  replacesId?: string | null,
): Promise<ActionResult> {
  const { buildQuickFlow } = await import("@/lib/quick/flows");
  const spec = await buildQuickFlow(flowId as never);
  if (!spec) return { ok: false, error: `Flujo desconocido: ${flowId}` };

  return logEvent(spec.kind, spec.build(answers), {
    source: replacesId ? "app:guiado:correccion" : "app:guiado",
    timeZone,
    revokesId: replacesId ?? null,
    startedAt: spec.startedAtFrom
      ? timeOfDayToDate(
          String(answers[spec.startedAtFrom] ?? ""),
          timeZone,
        )?.toISOString()
      : undefined,
  });
}

/**
 * Quita un registro del día.
 *
 * No lo borra: emite un evento que lo anula, con el mismo tipo y un payload
 * vacío marcado. La base rechaza el DELETE —un trigger hace cumplir I-02— y
 * eso es deliberado: lo que se quita por error se puede recuperar.
 */
export async function deleteQuickEntry(eventId: string): Promise<ActionResult> {
  try {
    const objetivo = await db.event.findUnique({
      where: { id: eventId },
      select: { kind: true, timezone: true, payloadJson: true },
    });
    if (!objetivo) return { ok: false, error: "Ese registro ya no existe" };
    if (!isEventKind(objetivo.kind)) {
      return { ok: false, error: "Tipo de evento desconocido" };
    }

    // El anulador repite el payload del original: tiene que pasar el mismo
    // esquema, y no hay un «payload vacío» válido para todos los tipos.
    //
    // Lo que lo convierte en RETIRADA y no en corrección es el sufijo de
    // `source`: sin él quedaría visible en lugar del original, porque anular
    // esconde al anulado, no al anulador.
    await revoke(eventId, {
      kind: objetivo.kind,
      payload: JSON.parse(objetivo.payloadJson),
      timezone: objetivo.timezone,
      source: `app:guiado${SUFIJO_RETIRADO}`,
    });
  } catch (error) {
    console.error("retirar registro falló", error);
    return { ok: false, error: "No se pudo quitar" };
  }
  revalidatePath("/");
  return { ok: true };
}

