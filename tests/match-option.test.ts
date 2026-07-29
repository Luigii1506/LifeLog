import { describe, expect, it } from "vitest";
import { matchOption } from "@/lib/match-option";

const grupos = ["pecho", "espalda", "pierna", "hombro", "bíceps", "tríceps", "core", "cardio"]
  .map((g) => ({ value: g, label: g }));

const ejercicios = [
  "Press de banca", "Press inclinado con barra", "Press inclinado con mancuernas",
  "Aperturas con mancuernas", "Fondos en paralelas",
].map((e) => ({ value: e, label: e }));

describe("matchOption — emparejar lo dicho con las opciones", () => {
  it("la palabra exacta", () => {
    expect(matchOption("pecho", grupos)?.value).toBe("pecho");
    expect(matchOption("espalda", grupos)?.value).toBe("espalda");
  });

  it("con acento y sin acento", () => {
    expect(matchOption("biceps", grupos)?.value).toBe("bíceps");
    expect(matchOption("bíceps", grupos)?.value).toBe("bíceps");
  });

  it("frases completas como las dice la gente", () => {
    expect(matchOption("ponle pecho", grupos)?.value).toBe("pecho");
    expect(matchOption("vamos a hacer espalda", grupos)?.value).toBe("espalda");
  });

  it("nombres largos con palabras de sobra", () => {
    expect(matchOption("press de banca", ejercicios)?.value).toBe("Press de banca");
    expect(matchOption("quiero press inclinado con barra", ejercicios)?.value).toBe(
      "Press inclinado con barra",
    );
    expect(matchOption("aperturas", ejercicios)?.value).toBe("Aperturas con mancuernas");
  });

  it("distingue variantes cuando se dice lo suficiente", () => {
    expect(matchOption("press inclinado con mancuernas", ejercicios)?.value).toBe(
      "Press inclinado con mancuernas",
    );
  });

  it("no elige cuando dos opciones empatan", () => {
    expect(matchOption("press inclinado", ejercicios)).toBeNull();
  });

  it("devuelve null en vez de elegir cualquier cosa", () => {
    expect(matchOption("", grupos)).toBeNull();
    expect(matchOption("qué hora es", grupos)).toBeNull();
    expect(matchOption("pecho", [])).toBeNull();
  });

  it("ignora el relleno que no distingue", () => {
    expect(matchOption("de la con y", grupos)).toBeNull();
  });
});
