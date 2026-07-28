"use server";

import { revalidatePath } from "next/cache";
import { emit, EventValidationError } from "@/lib/events/emit";
import { isEventKind, type EventKind } from "@/lib/events/kinds";

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
  options?: { entityId?: string; startedAt?: string; source?: string },
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
      source: options?.source ?? "app:today",
    });
  } catch (error) {
    if (error instanceof EventValidationError) {
      return { ok: false, error: `Datos inválidos para ${kind}` };
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
