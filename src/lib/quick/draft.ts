/**
 * Borradores de flujo: salir a medias y volver justo donde estabas.
 *
 * Por qué en el navegador y no en la base, cuando el gimnasio y la comida sí
 * escriben cada paso:
 *
 * En el gimnasio, cada serie ES un dato — existió, la hiciste, merece estar en
 * la base aunque no cierres la sesión. Media respuesta de «¿cuánto pesas?» no
 * es nada: no hay un peso a medias. Escribirlo en `events` obligaría a admitir
 * eventos que no cumplen su propio esquema, y el registro dejaría de ser un
 * registro de hechos.
 *
 * El coste, dicho claro: un borrador no viaja entre dispositivos. Empiezas en
 * el móvil, sigues en el portátil y empiezas de cero. Para dos o tres pasos es
 * un precio menor que ensuciar el log.
 *
 * Los borradores caducan al cambiar el día. Retomar el jueves el «¿cómo
 * dormiste?» que dejaste a medias el martes no tiene sentido, y ofrecerlo hace
 * dudar de todo lo demás que muestre la app.
 */

export type Draft = {
  /** Índice del paso donde se quedó. */
  step: number;
  answers: Record<string, string | number>;
  /** Día local en el que se empezó, YYYY-MM-DD. */
  date: string;
};

const PREFIJO = "lifelog:draft:";

function clave(flowId: string): string {
  return `${PREFIJO}${flowId}`;
}

/** El día local de hoy según el navegador. Es el reloj del usuario. */
export function hoyLocal(): string {
  const ahora = new Date();
  const y = ahora.getFullYear();
  const m = String(ahora.getMonth() + 1).padStart(2, "0");
  const d = String(ahora.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

export function readDraft(flowId: string): Draft | null {
  if (typeof window === "undefined") return null;
  try {
    const crudo = window.localStorage.getItem(clave(flowId));
    if (!crudo) return null;
    const draft = JSON.parse(crudo) as Draft;
    if (draft.date !== hoyLocal()) {
      clearDraft(flowId);
      return null;
    }
    if (typeof draft.step !== "number" || typeof draft.answers !== "object") return null;
    return draft;
  } catch {
    // localStorage puede estar lleno, deshabilitado o traer basura de una
    // versión anterior. Nada de esto debe impedir registrar: sin borrador el
    // flujo empieza de cero, que es el comportamiento de siempre.
    return null;
  }
}

export function writeDraft(
  flowId: string,
  step: number,
  answers: Record<string, string | number>,
): void {
  if (typeof window === "undefined") return;
  try {
    // Un borrador en el paso 0 y sin respuestas no es progreso: guardarlo
    // marcaría la tarjeta «en curso» por el mero hecho de haberla abierto.
    if (step === 0 && Object.keys(answers).length === 0) return clearDraft(flowId);
    const draft: Draft = { step, answers, date: hoyLocal() };
    window.localStorage.setItem(clave(flowId), JSON.stringify(draft));
  } catch {
    // Ídem: preferimos perder el borrador a romper el registro.
  }
}

export function clearDraft(flowId: string): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.removeItem(clave(flowId));
  } catch {
    /* ignorado a propósito */
  }
}

/** Todos los borradores vivos, para pintar el estado de las tarjetas. */
export function allDrafts(): Record<string, Draft> {
  if (typeof window === "undefined") return {};
  const resultado: Record<string, Draft> = {};
  try {
    for (let i = 0; i < window.localStorage.length; i += 1) {
      const k = window.localStorage.key(i);
      if (!k?.startsWith(PREFIJO)) continue;
      const flowId = k.slice(PREFIJO.length);
      const draft = readDraft(flowId);
      if (draft) resultado[flowId] = draft;
    }
  } catch {
    return {};
  }
  return resultado;
}
