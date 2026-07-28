import { z } from "zod";
import { db } from "@/lib/db";
import { EVENT_KINDS, type EventKind } from "./kinds";

/**
 * Vuelca el catálogo de kinds a la tabla `event_schemas` como JSON Schema.
 *
 * Por qué la tabla existe además del código: **brain-ops lee esta base desde
 * Python** y necesita saber qué significa un payload sin importar TypeScript.
 * Es un contrato entre lenguajes, no una duplicación.
 *
 * Idempotente: una versión ya publicada no se reescribe. Cambiar un schema
 * publicado invalidaría eventos históricos; lo correcto es subir `version` en
 * kinds.ts y publicar una fila nueva.
 */
export async function seedEventSchemas(): Promise<{
  inserted: string[];
  skipped: string[];
}> {
  const inserted: string[] = [];
  const skipped: string[] = [];

  for (const [kind, definition] of Object.entries(EVENT_KINDS)) {
    const { version, schema, label } = definition as (typeof EVENT_KINDS)[EventKind];

    const existing = await db.eventSchema.findUnique({
      where: { kind_schemaVersion: { kind, schemaVersion: version } },
    });
    if (existing) {
      skipped.push(`${kind}@${version}`);
      continue;
    }

    await db.eventSchema.create({
      data: {
        kind,
        schemaVersion: version,
        jsonSchema: JSON.stringify(z.toJSONSchema(schema)),
        description: label,
      },
    });
    inserted.push(`${kind}@${version}`);
  }

  return { inserted, skipped };
}
