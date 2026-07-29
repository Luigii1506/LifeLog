import { describe, expect, it } from "vitest";
import * as macros from "@/lib/food/macros";

describe("macros — la base de referencia", () => {
  it("los alimentos por peso escalan sobre 100", () => {
    const pollo = { unit: "g", kcal: 165, proteinG: 31, carbsG: 0, fatG: 3.6 };
    expect(macros.scaleMacros(pollo, 200).kcal).toBe(330);
    expect(macros.scaleMacros(pollo, 210).proteinG).toBe(65.1);
  });

  it("los alimentos por pieza escalan sobre 1", () => {
    const huevo = { unit: "unit", kcal: 72, proteinG: 6.3, carbsG: 0.4, fatG: 4.8 };
    expect(macros.scaleMacros(huevo, 3).kcal).toBe(216);
  });

  it("confundir las dos bases es el error clásico: 3 huevos no son 2.16 kcal", () => {
    const comoSiFueraPeso = { unit: "g", kcal: 72, proteinG: null, carbsG: null, fatG: null };
    const comoPieza = { unit: "unit", kcal: 72, proteinG: null, carbsG: null, fatG: null };
    expect(macros.scaleMacros(comoSiFueraPeso, 3).kcal).toBe(2.2);
    expect(macros.scaleMacros(comoPieza, 3).kcal).toBe(216);
  });

  it("un item sin macros cuenta como cero y no invalida el total", () => {
    const total = macros.sumMacros([
      { kcal: 100, proteinG: 10, carbsG: null, fatG: null },
      { kcal: null, proteinG: null, carbsG: null, fatG: null },
    ]);
    expect(total.kcal).toBe(100);
    expect(total.proteinG).toBe(10);
  });

  it("cantidad nula no calcula macros", () => {
    const pollo = { unit: "g", kcal: 165, proteinG: 31, carbsG: 0, fatG: 3.6 };
    expect(macros.scaleMacros(pollo, null).kcal).toBeNull();
  });
});
