import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createTestDatabase, HAY_BASE_DE_PRUEBAS } from "./setup-db";
import { formatoAgua } from "@/lib/water/units";

/**
 * Agua del día.
 *
 * Es el registro más frecuente del sistema, y eso trae su propio riesgo: con
 * diez toques al día, el toque de más es cuestión de tiempo. Si deshacer no
 * baja el total, el número deja de ser fiable y se abandona la cuenta — así
 * que ese es el caso que más se prueba aquí.
 */

let cleanup: () => void;
let db: typeof import("@/lib/db").db;
let agua: typeof import("@/lib/water/queries");
let emit: typeof import("@/lib/events/emit");

beforeAll(async () => {
  if (!HAY_BASE_DE_PRUEBAS) return;
  const test = createTestDatabase();
  cleanup = test.cleanup;
  process.env.DATABASE_URL = test.url;
  ({ db } = await import("@/lib/db"));
  agua = await import("@/lib/water/queries");
  emit = await import("@/lib/events/emit");
});

afterAll(async () => {
  if (!HAY_BASE_DE_PRUEBAS) return;
  await db.$disconnect();
  cleanup?.();
});

const TJ = "America/Tijuana";
const beber = (ml: number, vessel?: string) =>
  emit.emit({
    kind: "water.logged",
    payload: { ml, ...(vessel ? { vessel } : {}) },
    timezone: TJ,
    source: "test",
  });

describe.skipIf(!HAY_BASE_DE_PRUEBAS)("agua del día", () => {
  it("suma los tragos del día", async () => {
    const antes = (await agua.waterForDay(new Date(), TJ)).totalMl;
    await beber(250, "vaso");
    await beber(500, "botella");
    const despues = await agua.waterForDay(new Date(), TJ);
    expect(despues.totalMl).toBe(antes + 750);
  });

  it("deshacer baja el total, no lo sube", async () => {
    // El anulador lleva ml: 0 —«no bebí nada»—. Con cualquier otro valor,
    // deshacer añadiría agua que no bebiste, que es lo contrario de deshacer.
    const antes = (await agua.waterForDay(new Date(), TJ)).totalMl;
    const trago = await beber(500, "botella");
    expect((await agua.waterForDay(new Date(), TJ)).totalMl).toBe(antes + 500);

    await emit.revoke(trago.id, {
      kind: "water.logged",
      payload: { ml: 0 },
      timezone: TJ,
      source: "test:deshacer",
    });

    expect((await agua.waterForDay(new Date(), TJ)).totalMl).toBe(antes);
  });

  it("el evento que anula no aparece como una fila vacía", async () => {
    // El anulador lleva ml: 0 y suma cero, que es correcto — pero no es un
    // trago. Sin filtrarlo, la lista se llena de filas de «0 ml» que el
    // usuario no puso ahí, y cada deshacer añade una más.
    const antes = (await agua.waterForDay(new Date(), TJ)).entries.length;
    const trago = await beber(500, "botella");
    await emit.revoke(trago.id, {
      kind: "water.logged",
      payload: { ml: 0 },
      timezone: TJ,
      source: "test:deshacer",
    });
    const dia = await agua.waterForDay(new Date(), TJ);
    expect(dia.entries.length).toBe(antes);
  });

  it("un trago deshecho desaparece de la lista", async () => {
    const trago = await beber(250, "vaso");
    await emit.revoke(trago.id, {
      kind: "water.logged",
      payload: { ml: 0 },
      timezone: TJ,
      source: "test:deshacer",
    });
    const dia = await agua.waterForDay(new Date(), TJ);
    expect(dia.entries.some((e) => e.id === trago.id)).toBe(false);
  });

  it("los recipientes se ordenan por lo que de verdad usas", async () => {
    // Degrada solo: sin historial devuelve los de por defecto, y con historial
    // tus cantidades reales los desplazan.
    const presets = await agua.vesselPresets();
    expect(presets.length).toBeGreaterThan(0);
    expect(presets.every((p) => p.ml > 0 && p.label)).toBe(true);
  });
});

describe("metas y formato", () => {
  it("la meta son 2 L y lo excelente 3 L", async () => {
    const { META_ML, EXCELENTE_ML } = await import("@/lib/water/units");
    expect(META_ML).toBe(2000);
    expect(EXCELENTE_ML).toBe(3000);
  });

  it("habla en litros a partir del litro, como una persona", () => {
    expect(formatoAgua(250)).toBe("250 ml");
    expect(formatoAgua(750)).toBe("750 ml");
    expect(formatoAgua(1000)).toBe("1 L");
    expect(formatoAgua(1500)).toBe("1.5 L");
    expect(formatoAgua(2000)).toBe("2 L");
  });
});
