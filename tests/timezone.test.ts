import { describe, expect, it } from "vitest";
import { dateKeyIn, dayBoundsIn, offsetAt, zonedToInstant } from "@/lib/timezone";

const TJ = "America/Tijuana";

describe("timezone — el bug de las siete horas", () => {
  it("Tijuana está a -7 en verano", () => {
    expect(offsetAt(new Date("2026-07-29T12:00:00Z"), TJ) / 3600000).toBe(-7);
  });

  it("y a -8 en invierno: el desfase depende de la fecha", () => {
    expect(offsetAt(new Date("2026-01-15T12:00:00Z"), TJ) / 3600000).toBe(-8);
  });

  it("«07:30 en Tijuana» es un instante distinto que «07:30 UTC»", () => {
    const real = zonedToInstant(2026, 7, 29, 7, 30, TJ);
    expect(real.toISOString()).toBe("2026-07-29T14:30:00.000Z");
    // Lo que se guardó por el bug: 07:30 UTC, siete horas antes.
    expect(new Date("2026-07-29T07:30:00.000Z").getTime()).toBeLessThan(real.getTime());
  });

  it("el mismo reloj en invierno cae en otro instante", () => {
    expect(zonedToInstant(2026, 1, 15, 7, 30, TJ).toISOString()).toBe(
      "2026-01-15T15:30:00.000Z",
    );
  });

  it("el día empieza a medianoche LOCAL, no a medianoche UTC", () => {
    const { start, end } = dayBoundsIn(new Date("2026-07-29T20:00:00Z"), TJ);
    expect(start.toISOString()).toBe("2026-07-29T07:00:00.000Z");
    expect(end.toISOString()).toBe("2026-07-30T07:00:00.000Z");
  });

  it("un evento de las 23:00 locales pertenece a ESE día, no al siguiente", () => {
    // 23:00 del 29 en Tijuana son las 06:00 UTC del 30.
    const instante = zonedToInstant(2026, 7, 29, 23, 0, TJ);
    expect(instante.toISOString()).toBe("2026-07-30T06:00:00.000Z");
    expect(dateKeyIn(instante, TJ)).toBe("2026-07-29");
    // Con fronteras UTC caería en el día 30: ahí estaba el error.
    expect(instante.toISOString().slice(0, 10)).toBe("2026-07-30");
  });

  it("funciona en cualquier zona, no solo en la tuya", () => {
    expect(zonedToInstant(2026, 7, 29, 9, 0, "Europe/Madrid").toISOString()).toBe(
      "2026-07-29T07:00:00.000Z",
    );
    expect(zonedToInstant(2026, 7, 29, 9, 0, "UTC").toISOString()).toBe(
      "2026-07-29T09:00:00.000Z",
    );
  });
});
