import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createTestDatabase, HAY_BASE_DE_PRUEBAS } from "./setup-db";

let db: typeof import("@/lib/db").db;
let cleanup: () => void;

beforeAll(async () => {
  if (!HAY_BASE_DE_PRUEBAS) return;
  const test = createTestDatabase();
  cleanup = test.cleanup;
  process.env.DATABASE_URL = test.url;
  ({ db } = await import("@/lib/db"));
});

afterAll(async () => {
  if (!HAY_BASE_DE_PRUEBAS) return;
  await db.$disconnect();
  cleanup?.();
});

const ULID = /^[0-9A-HJKMNP-TV-Z]{26}$/;

async function insertEvent(overrides: Partial<Parameters<typeof db.event.create>[0]["data"]> = {}) {
  const { ulid } = await import("ulid");
  return db.event.create({
    data: {
      id: ulid(),
      kind: "weight.logged",
      domain: "health",
      startedAt: new Date(),
      timezone: "America/Mexico_City",
      payloadJson: JSON.stringify({ kg: 78.4 }),
      source: "test",
      ...overrides,
    },
  });
}

// ── I-02: append-only, garantizado por la base ──────────────────────────

describe.skipIf(!HAY_BASE_DE_PRUEBAS)("I-02 — events es append-only", () => {
  // OJO al depurar: el trigger devuelve SQLITE_CONSTRAINT_TRIGGER, y el cliente
  // de Prisma mapea CUALQUIER SQLITE_CONSTRAINT_* a "Foreign key constraint
  // violated". El mensaje que ve la aplicación es engañoso: no hay ningún
  // problema de clave foránea. Por eso el mensaje real se verifica con SQL
  // crudo y el comportamiento con el cliente.

  it("el trigger devuelve el mensaje de la invariante (SQL crudo)", async () => {
    const event = await insertEvent();
    await expect(
      db.$executeRawUnsafe(`UPDATE events SET kind='hackeado' WHERE id='${event.id}'`),
    ).rejects.toThrow(/I-02: events es append-only/);
  });

  it("el trigger bloquea también el DELETE (SQL crudo)", async () => {
    const event = await insertEvent();
    await expect(
      db.$executeRawUnsafe(`DELETE FROM events WHERE id='${event.id}'`),
    ).rejects.toThrow(/I-02: events es append-only/);
  });

  it("el cliente de Prisma no puede actualizar un evento", async () => {
    const event = await insertEvent();
    await expect(
      db.event.update({ where: { id: event.id }, data: { kind: "hackeado" } }),
    ).rejects.toThrow();
    const intacto = await db.event.findUnique({ where: { id: event.id } });
    expect(intacto?.kind).toBe("weight.logged");
  });

  it("el evento sobrevive al intento de borrado", async () => {
    const event = await insertEvent();
    await db.event.delete({ where: { id: event.id } }).catch(() => {});
    expect(await db.event.findUnique({ where: { id: event.id } })).not.toBeNull();
  });

  it("corregir es emitir con revokesId, no actualizar", async () => {
    const malo = await insertEvent({ payloadJson: JSON.stringify({ kg: 87.4 }) });
    const bueno = await insertEvent({
      payloadJson: JSON.stringify({ kg: 78.4 }),
      revokesId: malo.id,
    });

    // Los dos siguen ahí: el histórico conserva la evidencia del error.
    expect(await db.event.findUnique({ where: { id: malo.id } })).not.toBeNull();
    expect(bueno.revokesId).toBe(malo.id);
  });
});

// ── I-10: idempotencia ──────────────────────────────────────────────────

describe.skipIf(!HAY_BASE_DE_PRUEBAS)("I-10 — idempotencia por id", () => {
  it("el mismo id dos veces falla en vez de duplicar", async () => {
    const { ulid } = await import("ulid");
    const id = ulid();
    await insertEvent({ id });
    await expect(insertEvent({ id })).rejects.toThrow();
    expect(await db.event.count({ where: { id } })).toBe(1);
  });
});

// ── ADR-116: identidad ──────────────────────────────────────────────────

describe.skipIf(!HAY_BASE_DE_PRUEBAS)("ADR-116 — identidad ULID", () => {
  it("los ids son ULID de 26 caracteres", async () => {
    const event = await insertEvent();
    expect(event.id).toMatch(ULID);
  });

  it("los ids sembrados con el tiempo del hecho son ordenables", async () => {
    const { ulid } = await import("ulid");
    const viejo = ulid(new Date("2020-01-01").getTime());
    const nuevo = ulid(new Date("2026-01-01").getTime());
    expect(viejo < nuevo).toBe(true);
  });
});

// ── Convenciones de objeto ──────────────────────────────────────────────

describe.skipIf(!HAY_BASE_DE_PRUEBAS)("Convenciones de objeto — DATA_OWNERSHIP §9", () => {
  it("timezone es obligatorio: sin él un viaje corrompe la serie", async () => {
    await expect(insertEvent({ timezone: undefined })).rejects.toThrow();
  });

  it("todo evento lleva status, source, createdAt y updatedAt", async () => {
    const event = await insertEvent();
    expect(event.status).toBe("active");
    expect(event.source).toBe("test");
    expect(event.createdAt).toBeInstanceOf(Date);
    expect(event.updatedAt).toBeInstanceOf(Date);
  });

  it("startedAt es distinto de createdAt: el desayuno se registra a las 23:00", async () => {
    const desayuno = new Date("2026-07-27T09:00:00");
    const event = await insertEvent({ kind: "meal.logged", domain: "nutrition", startedAt: desayuno });
    expect(event.startedAt.getTime()).toBe(desayuno.getTime());
    expect(event.createdAt.getTime()).toBeGreaterThan(desayuno.getTime());
  });

  it("entityId nulo es válido — no todo evento apunta a una entidad", async () => {
    const event = await insertEvent();
    expect(event.entityId).toBeNull();
  });
});
