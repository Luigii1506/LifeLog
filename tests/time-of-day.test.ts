import { describe, expect, it } from "vitest";
import { timeOfDayToDate } from "@/lib/time-of-day";

const TJ = "America/Tijuana";

describe("timeOfDayToDate — la hora elegida, no la hora de registrar", () => {
  it("una hora de hoy se queda en hoy", () => {
    const ahora = new Date("2026-07-29T09:00:00");
    const r = timeOfDayToDate("07:32", TJ, ahora)!;
    expect(r.getDate()).toBe(29);
    expect(r.getHours()).toBe(7);
    expect(r.getMinutes()).toBe(32);
  });

  it("una hora futura se entiende como ayer", () => {
    // 00:20 registrando «desperté a las 07:30»: fue ayer, no dentro de 7 horas.
    const ahora = new Date("2026-07-30T00:20:00");
    const r = timeOfDayToDate("07:30", TJ, ahora)!;
    expect(r.getDate()).toBe(29);
    expect(r.getHours()).toBe(7);
  });

  it("hace unos minutos sigue siendo hoy", () => {
    const ahora = new Date("2026-07-29T23:50:00");
    const r = timeOfDayToDate("23:45", TJ, ahora)!;
    expect(r.getDate()).toBe(29);
    expect(r.getHours()).toBe(23);
  });

  it("los segundos se ponen a cero: la precisión que no tienes no se finge", () => {
    const r = timeOfDayToDate("07:32", TJ, new Date("2026-07-29T09:00:37"))!;
    expect(r.getSeconds()).toBe(0);
    expect(r.getMilliseconds()).toBe(0);
  });

  it("entrada inválida devuelve undefined en vez de una fecha absurda", () => {
    const ahora = new Date("2026-07-29T09:00:00");
    expect(timeOfDayToDate("", TJ, ahora)).toBeUndefined();
    expect(timeOfDayToDate("basura", TJ, ahora)).toBeUndefined();
    expect(timeOfDayToDate("25:00", TJ, ahora)).toBeUndefined();
    expect(timeOfDayToDate("07:99", TJ, ahora)).toBeUndefined();
  });

  it("medianoche es válida", () => {
    const r = timeOfDayToDate("00:00", TJ, new Date("2026-07-29T09:00:00"))!;
    expect(r.getHours()).toBe(0);
  });
});
