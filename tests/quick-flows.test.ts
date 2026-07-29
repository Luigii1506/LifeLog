import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createTestDatabase } from "./setup-db";

let cleanup: () => void;
let db: typeof import("@/lib/db").db;
let flows: typeof import("@/lib/quick/flows");
let kinds: typeof import("@/lib/events/kinds");

beforeAll(async () => {
  const test = createTestDatabase();
  cleanup = test.cleanup;
  process.env.DATABASE_URL = test.url;
  ({ db } = await import("@/lib/db"));
  flows = await import("@/lib/quick/flows");
  kinds = await import("@/lib/events/kinds");
});

afterAll(async () => {
  await db.$disconnect();
  cleanup();
});

const COMPLETAS: Record<string, Record<string, string | number>> = {
  wake: { energy: "8" },
  sleep: { hours: 7.5, quality: "8" },
  weight: { kg: 78.4 },
  medication: { name: "Metilfenidato" },
  mood: { score: "10", note: "buen día" },
  expense: { amount: 138, category: "comida", merchant: "Café X" },
  focus: { minutes: 50, task: "LifeLog" },
  activity: { activity: "Gimnasio" },
  note: { text: "una nota" },
};

/** Lo mínimo que queda si se saltan todos los pasos opcionales. */
const MINIMAS: Record<string, Record<string, string | number>> = {
  wake: {},
  sleep: { hours: 8 },
  weight: { kg: 78 },
  medication: { name: "X" },
  mood: { score: "6" },
  expense: { amount: 50, category: "otro" },
  focus: { minutes: 25 },
  activity: { activity: "Correr" },
  note: { text: "x" },
};

describe("flujos guiados de dominios ligeros", () => {
  it.each(flowIds())("«%s» produce un payload válido", async (id) => {
    const spec = await flows.buildQuickFlow(id);
    expect(spec).not.toBeNull();
    const payload = spec!.build(COMPLETAS[id]);
    const r = kinds.EVENT_KINDS[spec!.kind].schema.safeParse(payload);
    expect(r.success, JSON.stringify(payload)).toBe(true);
  });

  it.each(flowIds())("«%s» sigue siendo válido con los pasos opcionales saltados", async (id) => {
    const spec = await flows.buildQuickFlow(id);
    const payload = spec!.build(MINIMAS[id]);
    const r = kinds.EVENT_KINDS[spec!.kind].schema.safeParse(payload);
    expect(r.success, JSON.stringify(payload)).toBe(true);
  });

  it("saltar un paso omite el campo en vez de mandarlo vacío", async () => {
    const spec = await flows.buildQuickFlow("mood");
    expect(spec!.build({ score: "6" })).toEqual({ score: 6 });
    expect(spec!.build({ score: "6", note: "algo" })).toEqual({ score: 6, note: "algo" });
  });

  it("las opciones de escala se convierten a número", async () => {
    const spec = await flows.buildQuickFlow("sleep");
    const payload = spec!.build({ hours: 7, quality: "8" });
    expect(payload.quality).toBe(8);
    expect(typeof payload.quality).toBe("number");
  });

  it("el peso sugiere alrededor del último registrado", async () => {
    const { newId } = await import("@/lib/ids");
    await db.event.create({
      data: {
        id: newId(), kind: "weight.logged", domain: "health",
        startedAt: new Date(), timezone: "UTC",
        payloadJson: JSON.stringify({ kg: 78 }), source: "test",
      },
    });
    const spec = await flows.buildQuickFlow("weight");
    const paso = spec!.steps[0];
    expect(paso.type).toBe("quantity");
    if (paso.type === "quantity") {
      expect(paso.suggested).toBe(78);
      expect(paso.presets).toContain(78);
    }
  });

  it("un flujo desconocido devuelve null en vez de romper", async () => {
    expect(await flows.buildQuickFlow("inventado" as never)).toBeNull();
  });
});

function flowIds() {
  return ["wake", "sleep", "weight", "medication", "mood", "expense", "focus", "activity", "note"] as const;
}
