import { describe, expect, it } from "vitest";
import { parseSpokenTime } from "@/lib/parse-spoken-time";

const t = (h: number, m: number) => ({ hour: h, minute: m });

describe("parseSpokenTime — español hablado", () => {
  it("«cinco y media»", () => {
    expect(parseSpokenTime("cinco y media")).toEqual(t(5, 30));
  });

  it("«y cuarto» y «menos cuarto»", () => {
    expect(parseSpokenTime("siete y cuarto")).toEqual(t(7, 15));
    expect(parseSpokenTime("siete menos cuarto")).toEqual(t(6, 45));
  });

  it("hora sola", () => {
    expect(parseSpokenTime("siete")).toEqual(t(7, 0));
    expect(parseSpokenTime("las siete")).toEqual(t(7, 0));
    expect(parseSpokenTime("a las siete en punto")).toEqual(t(7, 0));
  });

  it("hora y minutos dichos seguidos", () => {
    expect(parseSpokenTime("siete treinta")).toEqual(t(7, 30));
    expect(parseSpokenTime("siete y treinta")).toEqual(t(7, 30));
    expect(parseSpokenTime("seis cuarenta y cinco")).toEqual(t(6, 45));
    expect(parseSpokenTime("ocho veinticinco")).toEqual(t(8, 25));
  });

  it("como lo diría alguien de verdad", () => {
    expect(parseSpokenTime("desperté a las siete y media")).toEqual(t(7, 30));
    expect(parseSpokenTime("eso de las seis y cuarto")).toEqual(t(6, 15));
    expect(parseSpokenTime("como a las cinco")).toEqual(t(5, 0));
  });

  it("acentos y sin acentos", () => {
    expect(parseSpokenTime("veintitrés")).toEqual(t(23, 0));
    expect(parseSpokenTime("veintitres")).toEqual(t(23, 0));
    expect(parseSpokenTime("dieciséis treinta")).toEqual(t(16, 30));
  });

  it("formato numérico si el dictado lo devuelve así", () => {
    expect(parseSpokenTime("7:30")).toEqual(t(7, 30));
    expect(parseSpokenTime("07:05")).toEqual(t(7, 5));
    expect(parseSpokenTime("730")).toEqual(t(7, 30));
    expect(parseSpokenTime("7 30")).toEqual(t(7, 30));
  });

  it("tarde y noche pasan a 24 horas", () => {
    expect(parseSpokenTime("siete de la tarde")).toEqual(t(19, 0));
    expect(parseSpokenTime("once de la noche")).toEqual(t(23, 0));
    expect(parseSpokenTime("siete de la mañana")).toEqual(t(7, 0));
  });

  it("mediodía y medianoche", () => {
    expect(parseSpokenTime("mediodía")).toEqual(t(12, 0));
    expect(parseSpokenTime("medianoche")).toEqual(t(0, 0));
  });

  it("devuelve null en vez de inventar", () => {
    expect(parseSpokenTime("")).toBeNull();
    expect(parseSpokenTime("no sé")).toBeNull();
    expect(parseSpokenTime("hola qué tal")).toBeNull();
    expect(parseSpokenTime("veinticinco")).toBeNull();
    expect(parseSpokenTime("siete noventa")).toBeNull();
  });

  it("medianoche y las horas de un solo dígito", () => {
    expect(parseSpokenTime("cero treinta")).toEqual(t(0, 30));
    expect(parseSpokenTime("una y media")).toEqual(t(1, 30));
  });
});
