import { db } from "@/lib/db";
import { newId } from "@/lib/ids";
import { kindDefinition, type EventKind } from "./kinds";

/**
 * Emisión de eventos a la columna vertebral.
 *
 * Es el ÚNICO camino para escribir en `events`. Toda escritura valida contra
 * el schema del kind antes de tocar la base (ADR-101, coste aceptado: la
 * validación vive en la aplicación, no en la base).
 *
 * Invariantes que sostiene:
 *   I-02  append-only — nunca actualiza ni borra; corregir es `revoke()`
 *   I-10  idempotencia por id (ULID)
 */

/**
 * Zona horaria de QUIEN EJECUTA esta función.
 *
 * En el navegador es la del usuario. En una acción de servidor es la de
 * Vercel —UTC—, que no sirve. Por eso los flujos mandan la suya explícitamente
 * y esto queda solo como último recurso.
 */
export function currentTimezone(): string {
  return Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
}

export type EmitInput<K extends EventKind = EventKind> = {
  kind: K;
  payload: unknown;
  /** Cuándo ocurrió. Por defecto, ahora. Difiere al registrar en diferido. */
  startedAt?: Date;
  /** Cuándo terminó. Nulo si es instantáneo. */
  endedAt?: Date | null;
  /** Zona del USUARIO. Si falta se cae a la de quien ejecuta, que en
   *  servidor es UTC y casi nunca es la correcta. */
  timezone?: string;
  /** ULID de una entidad que vive fuera de esta base (ADR-114). */
  entityId?: string | null;
  /** 'app:today', 'app:gym', 'cli', 'import:owntracks' */
  source: string;
  /** Para imports: reusar el id de origen hace la operación idempotente. */
  id?: string;
  /** Anula un evento anterior. Usar `revoke()` en vez de esto directamente. */
  revokesId?: string | null;
};

export class EventValidationError extends Error {
  constructor(
    public readonly kind: string,
    public readonly issues: unknown,
  ) {
    super(`Payload inválido para "${kind}"`);
    this.name = "EventValidationError";
  }
}

export async function emit<K extends EventKind>(input: EmitInput<K>) {
  const definition = kindDefinition(input.kind);

  const parsed = definition.schema.safeParse(input.payload);
  if (!parsed.success) {
    throw new EventValidationError(input.kind, parsed.error.issues);
  }

  const startedAt = input.startedAt ?? new Date();

  return db.event.create({
    data: {
      id: input.id ?? newId(startedAt.getTime()),
      kind: input.kind,
      domain: definition.domain,
      startedAt,
      endedAt: input.endedAt ?? null,
      timezone: input.timezone ?? currentTimezone(),
      entityId: input.entityId ?? null,
      payloadJson: JSON.stringify(parsed.data),
      schemaVersion: definition.version,
      source: input.source,
      revokesId: input.revokesId ?? null,
    },
  });
}

/**
 * Corrección de un evento. I-02: no se actualiza ni se borra el original —
 * se emite uno nuevo que lo anula. El histórico conserva ambos, y por tanto
 * conserva la evidencia del error, que a veces es el dato interesante.
 */
export async function revoke<K extends EventKind>(
  targetId: string,
  replacement: Omit<EmitInput<K>, "revokesId">,
) {
  const target = await db.event.findUnique({ where: { id: targetId } });
  if (!target) throw new Error(`No existe el evento ${targetId}`);

  return emit({ ...replacement, revokesId: targetId });
}

/** Emisión idempotente para imports (I-10): mismo id, una sola fila. */
export async function emitOnce<K extends EventKind>(
  input: EmitInput<K> & { id: string },
) {
  const existing = await db.event.findUnique({ where: { id: input.id } });
  if (existing) return existing;
  return emit(input);
}
