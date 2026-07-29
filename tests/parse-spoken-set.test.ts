import { describe, expect, it } from "vitest";
import { parseSpokenSet } from "@/lib/gym/parse-spoken-set";

const s = (weightKg: number | null, reps: number | null, rir: number | null = null) => ({
  weightKg, reps, rir,
});

describe("parseSpokenSet — dictar una serie en el gimnasio", () => {
  it("la forma natural: peso por reps", () => {
    expect(parseSpokenSet("setenta por diez")).toEqual(s(70, 10));
    expect(parseSpokenSet("cuarenta por doce")).toEqual(s(40, 12));
    expect(parseSpokenSet("70 por 10")).toEqual(s(70, 10));
  });

  it("compuestos: los pesos se dicen así, no en cifras", () => {
    expect(parseSpokenSet("cuarenta y cinco por ocho")).toEqual(s(45, 8));
    expect(parseSpokenSet("ciento veinte por cinco")).toEqual(s(120, 5));
    expect(parseSpokenSet("ciento por tres")).toEqual(s(100, 3));
  });

  it("medios kilos", () => {
    expect(parseSpokenSet("setenta y medio por diez")).toEqual(s(70.5, 10));
    expect(parseSpokenSet("22.5 por 12")).toEqual(s(22.5, 12));
  });

  it("con unidades dichas", () => {
    expect(parseSpokenSet("setenta kilos por diez")).toEqual(s(70, 10));
    expect(parseSpokenSet("setenta kilos diez repeticiones")).toEqual(s(70, 10));
    expect(parseSpokenSet("diez repeticiones con setenta kilos")).toEqual(s(70, 10));
  });

  it("reserva", () => {
    expect(parseSpokenSet("setenta por ocho con dos de reserva")).toEqual(s(70, 8, 2));
    expect(parseSpokenSet("setenta por ocho rir dos")).toEqual(s(70, 8, 2));
  });

  it("un solo número son repeticiones: el peso no cambió", () => {
    expect(parseSpokenSet("ocho")).toEqual(s(null, 8));
    expect(parseSpokenSet("diez repeticiones")).toEqual(s(null, 10));
  });

  it("como lo diría alguien de verdad", () => {
    expect(parseSpokenSet("hice setenta por diez")).toEqual(s(70, 10));
    expect(parseSpokenSet("puse cuarenta y cinco por ocho")).toEqual(s(45, 8));
  });

  it("rechaza en vez de inventar", () => {
    expect(parseSpokenSet("")).toBeNull();
    expect(parseSpokenSet("no sé")).toBeNull();
    expect(parseSpokenSet("mil por diez")).toBeNull();
    expect(parseSpokenSet("setenta por doscientos")).toBeNull();
  });

  it("peso corporal: cero es válido", () => {
    expect(parseSpokenSet("cero por quince")).toEqual(s(0, 15));
  });
});
