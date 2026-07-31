import { describe, expect, it } from "vitest";
import {
  duracionHasta,
  formatoHoras,
  instanteDeAcostarse,
} from "@/lib/sleep-duration";

/**
 * Deducir cuánto dormiste a partir de la hora de acostarte.
 *
 * El sueño se registra DESPUÉS de despertar —no se puede registrar dormido—,
 * así que la hora de despertar ya existe y las horas se deducen. Eso convierte
 * «¿cuántas horas dormiste?», que obliga a una resta de memoria y medio
 * dormido, en «¿a qué hora te dormiste?», que se sabe.
 *
 * Toda la dificultad está en la medianoche, y por eso hay tantos casos.
 */

const DESPERTAR = new Date("2026-07-30T07:30:00");

function horas(h: number, m = 0) {
  return duracionHasta({ hour: h, minute: m }, DESPERTAR.toISOString())!;
}

describe("la medianoche se resuelve sola", () => {
  it("acostarse a las 23:00 cuenta como el día anterior", () => {
    expect(horas(23).minutos).toBe(8 * 60 + 30);
    expect(instanteDeAcostarse({ hour: 23, minute: 0 }, DESPERTAR).getDate()).toBe(29);
  });

  it("acostarse a las 02:00 cuenta como el mismo día", () => {
    // Las dos horas son anteriores al despertar, pero una es de ayer y otra de
    // hoy. No hace falta distinguirlas: se toma la ocurrencia más reciente
    // ANTERIOR al despertar, y eso resuelve ambos casos con la misma regla.
    expect(horas(2).minutos).toBe(5 * 60 + 30);
    expect(instanteDeAcostarse({ hour: 2, minute: 0 }, DESPERTAR).getDate()).toBe(30);
  });

  it("medianoche justa cae en el mismo día", () => {
    expect(horas(0, 15).minutos).toBe(7 * 60 + 15);
    expect(instanteDeAcostarse({ hour: 0, minute: 15 }, DESPERTAR).getDate()).toBe(30);
  });

  it("la hora exacta del despertar retrocede un día entero", () => {
    // 07:30 no puede ser «hace cero minutos»: sería no haber dormido. Es el
    // día anterior, y el resultado —24 h— se marca como no plausible.
    const d = horas(7, 30);
    expect(d.minutos).toBe(24 * 60);
    expect(d.plausible).toBe(false);
  });
});

describe("lo que no es una noche, se marca", () => {
  it("media hora no es haber dormido", () => {
    expect(horas(7).plausible).toBe(false);
  });

  it("veintitrés horas es la rueda mal girada", () => {
    expect(horas(8).plausible).toBe(false);
  });

  it("una noche normal sí lo es", () => {
    for (const h of [21, 22, 23, 0, 1, 2, 3]) {
      expect(horas(h).plausible, `acostarse a las ${h}`).toBe(true);
    }
  });

  it("una siesta larga entra: dormir poco también se registra", () => {
    // El mínimo son 45 minutos. Alguien que se acuesta a las 06:00 y despierta
    // a las 07:30 durmió hora y media, y eso es un dato real.
    expect(horas(6).plausible).toBe(true);
    expect(horas(6).minutos).toBe(90);
  });
});

describe("formato", () => {
  it("dice horas y minutos como los diría una persona", () => {
    expect(formatoHoras(510)).toBe("8h 30m");
    expect(formatoHoras(420)).toBe("7h");
    expect(formatoHoras(45)).toBe("45 min");
  });
});

describe("robustez", () => {
  it("una fecha inválida no revienta la pantalla", () => {
    expect(duracionHasta({ hour: 23, minute: 0 }, "no soy una fecha")).toBeNull();
  });
});
