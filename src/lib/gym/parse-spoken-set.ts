import { leerNumero, normalizarPalabras } from "@/lib/spanish-numbers";

/**
 * «setenta por diez» → 70 kg × 10.
 *
 * Es el dictado que más vale en el gimnasio: entre series, con las manos
 * ocupadas o sucias, decirlo es mucho más rápido que teclear dos números.
 *
 * En español la serie se dice PESO por REPS, en ese orden. Se admite también
 * el orden inverso cuando se dice explícitamente («diez repeticiones con
 * setenta»), porque quien lo dice así lo dice siempre así.
 */

export type SpokenSet = {
  weightKg: number | null;
  reps: number | null;
  rir: number | null;
};

/** Separadores que significan «por»: peso × reps. */
const POR = new Set(["por", "x", "veces"]);

/** Palabras que anuncian repeticiones. */
const REPS = new Set(["repeticiones", "repes", "reps", "veces"]);

/** Palabras que anuncian peso. */
const PESO = new Set(["kilos", "kilo", "kg", "kilogramos"]);

/**
 * La reserva se dice de dos maneras y en direcciones opuestas:
 * «rir dos» va delante del número, «con dos de reserva» va detrás.
 */
const RESERVA_ANTES = new Set(["rir"]);
const RESERVA_DESPUES = new Set(["reserva", "guardadas", "sobrando"]);

const RELLENO = new Set([
  "con", "de", "a", "en", "y", "la", "el", "las", "los", "hice", "puse",
  "fueron", "son", "es", "al", "un", "una", "peso", "serie",
]);

export function parseSpokenSet(input: string): SpokenSet | null {
  if (!input.trim()) return null;
  const palabras = normalizarPalabras(input);

  type Etiqueta = "peso" | "reps" | "rir";
  const numeros: { valor: number; etiqueta: Etiqueta | null; traspor: boolean }[] = [];
  let vistoPor = false;
  let siguienteEtiqueta: Etiqueta | null = null;

  /**
   * En español la unidad va DETRÁS de su número: «setenta kilos», «diez
   * repeticiones». Así que estas palabras etiquetan el número anterior.
   */
  function etiquetarAtras(etiqueta: Etiqueta) {
    const ultimo = numeros[numeros.length - 1];
    if (ultimo && ultimo.etiqueta === null) ultimo.etiqueta = etiqueta;
  }

  for (let i = 0; i < palabras.length; ) {
    const palabra = palabras[i];

    if (POR.has(palabra) && !REPS.has(palabra)) {
      vistoPor = true;
      i += 1;
      continue;
    }
    if (RESERVA_ANTES.has(palabra)) {
      siguienteEtiqueta = "rir";
      i += 1;
      continue;
    }
    if (RESERVA_DESPUES.has(palabra)) {
      etiquetarAtras("rir");
      i += 1;
      continue;
    }
    if (REPS.has(palabra)) {
      etiquetarAtras("reps");
      i += 1;
      continue;
    }
    if (PESO.has(palabra)) {
      etiquetarAtras("peso");
      i += 1;
      continue;
    }

    const leido = leerNumero(palabras, i);
    if (leido) {
      numeros.push({ valor: leido.valor, etiqueta: siguienteEtiqueta, traspor: vistoPor });
      siguienteEtiqueta = null;
      vistoPor = false;
      i += Math.max(1, leido.consumidas);
      continue;
    }

    if (!RELLENO.has(palabra)) siguienteEtiqueta = null;
    i += 1;
  }

  if (numeros.length === 0) return null;

  let peso: number | null = null;
  let reps: number | null = null;
  let rir: number | null = null;

  // Primero lo dicho explícitamente: gana sobre la posición.
  for (const n of numeros) {
    if (n.etiqueta === "peso" && peso === null) peso = n.valor;
    if (n.etiqueta === "reps" && reps === null) reps = n.valor;
    if (n.etiqueta === "rir" && rir === null) rir = n.valor;
  }

  // Luego los sin etiquetar, por posición: peso, luego reps.
  for (const n of numeros) {
    if (n.etiqueta !== null) continue;
    if (peso === null && !n.traspor) peso = n.valor;
    else if (reps === null) reps = n.valor;
    else if (rir === null) rir = n.valor;
  }

  // Un solo número sin contexto son repeticiones: es lo que cambia entre
  // series cuando el peso se queda igual.
  if (numeros.length === 1 && numeros[0].etiqueta === null) {
    reps = numeros[0].valor;
    peso = null;
  }

  return validar({ weightKg: peso, reps, rir });
}

function validar(s: SpokenSet): SpokenSet | null {
  if (s.weightKg !== null && (s.weightKg < 0 || s.weightKg > 500)) return null;
  if (s.reps !== null && (!Number.isInteger(s.reps) || s.reps < 1 || s.reps > 100)) return null;
  if (s.rir !== null && (!Number.isInteger(s.rir) || s.rir < 0 || s.rir > 10)) return null;
  if (s.weightKg === null && s.reps === null) return null;
  return s;
}
