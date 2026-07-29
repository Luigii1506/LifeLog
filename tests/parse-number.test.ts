import { describe, expect, it } from "vitest";
import { parseFormNumber } from "@/lib/parse-number";

describe("parseFormNumber — el bug que perdió un registro de sueño", () => {
  it("acepta coma decimal, que es lo que da el teclado en español", () => {
    expect(parseFormNumber("7,5")).toBe(7.5);
  });

  it("acepta punto decimal", () => {
    expect(parseFormNumber("7.5")).toBe(7.5);
  });

  it("acepta enteros", () => {
    expect(parseFormNumber("8")).toBe(8);
  });

  it("vacío es undefined, no cero — 0 horas de sueño no es lo mismo que no registrar", () => {
    expect(parseFormNumber("")).toBeUndefined();
    expect(parseFormNumber("   ")).toBeUndefined();
    expect(parseFormNumber(null)).toBeUndefined();
  });

  it("cero explícito sí es cero", () => {
    expect(parseFormNumber("0")).toBe(0);
  });

  it("texto no numérico es undefined, no NaN", () => {
    expect(parseFormNumber("abc")).toBeUndefined();
    expect(parseFormNumber("7,5,3")).toBeUndefined();
  });

  it("separador de millar según de dónde venga el teclado", () => {
    expect(parseFormNumber("1.234,5")).toBe(1234.5);
    expect(parseFormNumber("1,234.5")).toBe(1234.5);
  });

  it("negativos, para correcciones de peso o gasto", () => {
    expect(parseFormNumber("-2,5")).toBe(-2.5);
  });
});
