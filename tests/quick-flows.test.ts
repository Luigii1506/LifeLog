import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { createTestDatabase, HAY_BASE_DE_PRUEBAS } from "./setup-db";

let cleanup: () => void;
let db: typeof import("@/lib/db").db;
let flows: typeof import("@/lib/quick/flows");
let kinds: typeof import("@/lib/events/kinds");

beforeAll(async () => {
  if (!HAY_BASE_DE_PRUEBAS) return;
  const test = createTestDatabase();
  cleanup = test.cleanup;
  process.env.DATABASE_URL = test.url;
  ({ db } = await import("@/lib/db"));
  flows = await import("@/lib/quick/flows");
  kinds = await import("@/lib/events/kinds");
});

afterAll(async () => {
  if (!HAY_BASE_DE_PRUEBAS) return;
  await db.$disconnect();
  cleanup?.();
});

const COMPLETAS: Record<string, Record<string, string | number>> = {
  wake: { at: "07:32" },
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
  wake: { at: "07:32" },
  sleep: { hours: 8 },
  weight: { kg: 78 },
  medication: { name: "X" },
  mood: { score: "6" },
  expense: { amount: 50, category: "otro" },
  focus: { minutes: 25 },
  activity: { activity: "Correr" },
  note: { text: "x" },
};

describe.skipIf(!HAY_BASE_DE_PRUEBAS)("flujos guiados de dominios ligeros", () => {
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

  it("«Desperté» registra la hora real, no el payload", async () => {
    const spec = await flows.buildQuickFlow("wake");
    // El dato no va en el payload: va en startedAt.
    expect(spec!.build({ at: "07:32" })).toEqual({});
    expect(spec!.startedAtFrom).toBe("at");
    expect(spec!.steps).toHaveLength(1);
    expect(spec!.steps[0].type).toBe("time");
  });

  it("«Desperté» no pregunta nada más: solo la hora", async () => {
    const spec = await flows.buildQuickFlow("wake");
    expect(spec!.steps.map((p) => p.id)).toEqual(["at"]);
  });

  it("un flujo desconocido devuelve null en vez de romper", async () => {
    expect(await flows.buildQuickFlow("inventado" as never)).toBeNull();
  });
});

function flowIds() {
  return ["wake", "sleep", "weight", "medication", "mood", "expense", "focus", "activity", "note"] as const;
}

// ── Estado de las tarjetas de Hoy ───────────────────────────────────────

describe.skipIf(!HAY_BASE_DE_PRUEBAS)("pasos declarados en el catálogo", () => {
  it("coinciden con los del flujo real", async () => {
    // El catálogo duplica el número de pasos para que Hoy pueda decir
    // «paso 2 de 3» sin construir los nueve flujos. Si alguien añade un paso
    // y olvida la tabla, debe fallar aquí y no mentirle al usuario.
    const { QUICK_FLOWS } = await import("@/lib/quick/catalog");
    for (const entrada of QUICK_FLOWS) {
      const spec = await flows.buildQuickFlow(entrada.id);
      expect(spec, `no existe el flujo ${entrada.id}`).not.toBeNull();
      expect(spec!.steps.length, `pasos de ${entrada.id}`).toBe(entrada.steps);
    }
  });
});

describe.skipIf(!HAY_BASE_DE_PRUEBAS)("estado del día en las tarjetas", () => {
  let status: typeof import("@/lib/quick/status");
  let emit: typeof import("@/lib/events/emit");

  beforeAll(async () => {
    status = await import("@/lib/quick/status");
    emit = await import("@/lib/events/emit");
  });

  // `events` no se puede vaciar: un trigger hace cumplir I-02 (append-only) y
  // rechaza el DELETE. Eso es la invariante funcionando, así que las pruebas
  // miden el incremento en vez de partir de cero.
  const TJ = "America/Tijuana";
  async function cuenta(flow: string): Promise<number> {
    return (await status.todayStatus(new Date(), TJ)).flows[flow].count;
  }

  it("registrar sube la cuenta de esa tarjeta y solo de esa", async () => {
    const pesoAntes = await cuenta("weight");
    const animoAntes = await cuenta("mood");

    await emit.emit({
      kind: "weight.logged",
      payload: { kg: 78 },
      timezone: TJ,
      source: "test",
    });

    expect(await cuenta("weight")).toBe(pesoAntes + 1);
    expect(await cuenta("mood")).toBe(animoAntes);
  });

  it("la hora que muestra la tarjeta es local, con formato de 24 h", async () => {
    await emit.emit({
      kind: "medication.taken",
      payload: { name: "Vitamina D" },
      timezone: TJ,
      source: "test",
    });

    const e = await status.todayStatus(new Date(), TJ);
    expect(e.flows.medication.lastAt).toMatch(/^\d{2}:\d{2}$/);
  });

  it("corregir un evento no lo cuenta dos veces", async () => {
    // I-02: corregir es emitir otro que anula al anterior. Si contara los dos,
    // la tarjeta diría «2 hoy» por un único registro.
    const antes = await cuenta("mood");

    const original = await emit.emit({
      kind: "mood.logged",
      payload: { score: 3 },
      timezone: TJ,
      source: "test",
    });
    expect(await cuenta("mood")).toBe(antes + 1);

    await emit.revoke(original.id, {
      kind: "mood.logged",
      payload: { score: 8 },
      timezone: TJ,
      source: "test:correccion",
    });

    expect(await cuenta("mood")).toBe(antes + 1);
  });

  it("actividad cuenta tanto al empezar como al terminar", async () => {
    const antes = await cuenta("activity");
    await emit.emit({
      kind: "activity.started",
      payload: { activity: "leer" },
      timezone: TJ,
      source: "test",
    });
    await emit.emit({
      kind: "activity.ended",
      payload: { activity: "leer", minutes: 30 },
      timezone: TJ,
      source: "test",
    });
    expect(await cuenta("activity")).toBe(antes + 2);
  });
});

describe.skipIf(!HAY_BASE_DE_PRUEBAS)("ningún paso se queda sin nada que tocar", () => {
  it("las listas que salen del historial tienen arranque en frío", async () => {
    // El fallo: «¿En qué?» de Trabajo salía con cero opciones hasta tener
    // historial, así que preguntaba sin nada debajo salvo «otra cosa». Es la
    // misma enfermedad que tenía «¿Dónde?» en gasto.
    const { QUICK_FLOWS } = await import("@/lib/quick/catalog");
    for (const entrada of QUICK_FLOWS) {
      if (entrada.href) continue; // tiene pantalla propia, no es un flujo
      const spec = await flows.buildQuickFlow(entrada.id);
      for (const paso of spec?.steps ?? []) {
        if (paso.type !== "choice") continue;
        expect(
          paso.options.length,
          `${entrada.id} · «${paso.question}» se queda sin opciones`,
        ).toBeGreaterThan(0);
      }
    }
  });
});
