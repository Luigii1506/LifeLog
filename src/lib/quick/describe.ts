import { EVENT_KINDS, isEventKind } from "@/lib/events/kinds";

/**
 * Cómo se lee un evento en una línea.
 *
 * Puro a propósito: no toca la base. Lo usan la pantalla del flujo Y la tarjeta
 * de Hoy, y con dos versiones acabarían diciendo cosas distintas del mismo
 * registro — que es peor que no decir nada.
 */

export type Descripcion = { summary: string; detail?: string };

export function horaEn(fecha: Date, timeZone: string): string {
  return fecha.toLocaleTimeString("es-MX", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
    timeZone,
  });
}

/**
 * Lo registrado, partido en dato y matiz.
 *
 * Cada flujo enseña SU dato, no un texto genérico: en «Desperté» lo que importa
 * es la hora que elegiste, no que exista un evento. El matiz va aparte porque
 * el dato se pinta en grande, y meter «7h 30m · desde las 23:00» en una sola
 * línea grande la parte en dos y deja la tarjeta torcida.
 */
export function describir(
  kind: string,
  p: Record<string, unknown>,
  startedAt: Date,
  timeZone: string,
): Descripcion {
  switch (kind) {
    case "wake.up":
      // La hora de despertar es `startedAt`, no un campo: el selector de hora
      // fija cuándo OCURRIÓ, que es justo el dato.
      return { summary: horaEn(startedAt, timeZone) };

    case "sleep.logged": {
      const h = Number(p.hours);
      if (!Number.isFinite(h)) return { summary: "—" };
      const horas = Math.floor(h);
      const min = Math.round((h - horas) * 60);
      // Las DOS horas, no solo la de acostarse. El número sale de una resta, y
      // enseñar solo un extremo lo vuelve incomprobable: con «14h» y «desde la
      // 1:00» no había forma de ver que el otro extremo estaba mal.
      const desde = typeof p.bedtime === "string" ? p.bedtime : null;
      const hasta = typeof p.waketime === "string" ? p.waketime : null;
      return {
        summary: min > 0 ? `${horas}h ${min}m` : `${horas}h`,
        detail:
          desde && hasta
            ? `${desde} → ${hasta}`
            : desde
              ? `desde las ${desde}`
              : undefined,
      };
    }

    case "weight.logged":
      return p.kg !== undefined ? { summary: `${p.kg} kg` } : { summary: "—" };

    case "mood.logged": {
      const score = Number(p.score);
      if (!Number.isFinite(score)) return { summary: "—" };
      // La cara va como icono grande de la tarjeta, así que aquí basta el
      // número: repetirla sería decir lo mismo dos veces.
      return {
        summary: `${score}/10`,
        detail: ETIQUETA_ANIMO.find(([tope]) => score <= tope)?.[1],
      };
    }

    default:
      return {
        summary: isEventKind(kind) ? EVENT_KINDS[kind].label : "registrado",
      };
  }
}

/** La misma escala que usa el flujo al preguntar. */
const ETIQUETA_ANIMO: [tope: number, texto: string][] = [
  [2, "Mal"],
  [4, "Regular"],
  [6, "Normal"],
  [8, "Bien"],
  [10, "Excelente"],
];

/** La cara, para usarla como icono de la tarjeta en vez del genérico. */
export function caraDeAnimo(score: number): string | null {
  const escala: [number, string][] = [
    [2, "😖"],
    [4, "😕"],
    [6, "😐"],
    [8, "🙂"],
    [10, "🤩"],
  ];
  return escala.find(([tope]) => score <= tope)?.[1] ?? null;
}
