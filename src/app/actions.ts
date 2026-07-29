"use server";

import { revalidatePath } from "next/cache";
import { emit, EventValidationError } from "@/lib/events/emit";
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
  options?: { entityId?: string; startedAt?: string; source?: string; timeZone?: string },
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
export async function logQuickFlow(
  flowId: string,
  answers: Record<string, string | number>,
  timeZone: string,
): Promise<ActionResult> {
  const { buildQuickFlow } = await import("@/lib/quick/flows");
  const spec = await buildQuickFlow(flowId as never);
  if (!spec) return { ok: false, error: `Flujo desconocido: ${flowId}` };

  return logEvent(spec.kind, spec.build(answers), {
    source: "app:guiado",
    timeZone,
    startedAt: spec.startedAtFrom
      ? timeOfDayToDate(
          String(answers[spec.startedAtFrom] ?? ""),
          timeZone,
        )?.toISOString()
      : undefined,
  });
}

