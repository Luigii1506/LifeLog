import { describe, expect, it } from "vitest";
import { SUPLEMENTOS, formatoDosis, suplementoPorId } from "@/lib/supplements/catalog";

/**
 * Catálogo de suplementos.
 *
 * Cada uno declara CÓMO se registra, no solo cómo se llama. Es la diferencia
 * entre una lista y algo usable: una pastilla se toma o no —un toque basta—
 * mientras que la proteína va en medios scoops y la creatina en scoops de 5 g.
 */

describe("cada suplemento se dosifica a su manera", () => {
  it("las pastillas son de un toque", () => {
    // Pedir cantidad para una pastilla sería un paso inventado.
    expect(suplementoPorId("psiquiatra")!.dosing.kind).toBe("single");
    expect(suplementoPorId("omega3")!.dosing.kind).toBe("single");
  });

  it("la proteína va en medios scoops", () => {
    // A veces son dos y medio. Redondear a enteros falsearía el dato justo en
    // el suplemento donde más se nota.
    const d = suplementoPorId("proteina")!.dosing;
    expect(d.kind).toBe("steps");
    if (d.kind !== "steps") return;
    expect(d.step).toBe(0.5);
    expect(d.default).toBe(1);
  });

  it("la creatina va en scoops de 5 GRAMOS", () => {
    // No miligramos: en mg el dato quedaría mil veces por debajo y nadie lo
    // notaría hasta mirar una media.
    const d = suplementoPorId("creatina")!.dosing;
    expect(d.kind).toBe("steps");
    if (d.kind !== "steps") return;
    expect(d.step).toBe(5);
    expect(d.default).toBe(5);
    expect(d.unit).toBe("g");
  });

  it("todos tienen tope de cordura", () => {
    // Por encima del tope, casi siempre es un toque de más en el «+».
    for (const s of SUPLEMENTOS) {
      if (s.dosing.kind !== "steps") continue;
      expect(s.dosing.max, s.name).toBeGreaterThan(s.dosing.default);
    }
  });
});

describe("cómo se lee la dosis", () => {
  it("singular y plural, sin «1 scoops»", () => {
    const p = suplementoPorId("proteina")!.dosing;
    expect(formatoDosis(1, p)).toBe("1 scoop");
    expect(formatoDosis(2, p)).toBe("2 scoops");
    expect(formatoDosis(2.5, p)).toBe("2.5 scoops");
  });

  it("la creatina se lee en gramos", () => {
    const c = suplementoPorId("creatina")!.dosing;
    expect(formatoDosis(5, c)).toBe("5 g");
    expect(formatoDosis(10, c)).toBe("10 g");
  });

  it("los de un toque no llevan dosis", () => {
    expect(formatoDosis(1, suplementoPorId("psiquiatra")!.dosing)).toBe("");
  });
});

describe("integridad del catálogo", () => {
  it("los nombres son únicos: el evento se guarda por nombre", () => {
    // Si dos suplementos compartieran nombre, lo tomado de uno contaría en el
    // otro. El emparejamiento va por `name` porque es lo que guarda el evento.
    const nombres = SUPLEMENTOS.map((s) => s.name);
    expect(new Set(nombres).size).toBe(nombres.length);
  });

  it("los ids son únicos", () => {
    const ids = SUPLEMENTOS.map((s) => s.id);
    expect(new Set(ids).size).toBe(ids.length);
  });
});
