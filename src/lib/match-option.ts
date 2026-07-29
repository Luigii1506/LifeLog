/**
 * Empareja lo dicho con una lista de opciones.
 *
 * El reconocedor devuelve frases enteras («ponle pecho», «press inclinado con
 * barra»), no la etiqueta exacta. Sin tolerancia, dictar falla casi siempre y
 * el botón deja de usarse.
 *
 * Devuelve null si no hay una coincidencia clara. Elegir la opción equivocada
 * es peor que no elegir: registra un dato falso sin que te enteres.
 */

export function normalizar(texto: string): string {
  return texto
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^\w\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/** Palabras que la gente dice alrededor y que no distinguen una opción de otra. */
const RELLENO = new Set([
  "el", "la", "los", "las", "un", "una", "de", "del", "con", "en", "y",
  "ponle", "pon", "quiero", "dame", "vamos", "hacer", "haz", "toca", "a",
  "por", "para",
]);

function palabrasUtiles(texto: string): string[] {
  return normalizar(texto)
    .split(" ")
    .filter((p) => p.length > 1 && !RELLENO.has(p));
}

export type Matchable = { value: string; label: string };

/**
 * Devuelve la opción que mejor casa, o null si ninguna destaca.
 *
 * Se exige que la ganadora saque ventaja a la segunda: si «press inclinado con
 * barra» y «press inclinado con mancuernas» empatan, es que no se dijo lo
 * suficiente para distinguirlas y hay que elegir a mano.
 */
export function matchOption<T extends Matchable>(
  transcript: string,
  options: readonly T[],
): T | null {
  const dichas = palabrasUtiles(transcript);
  if (dichas.length === 0 || options.length === 0) return null;
  const frase = dichas.join(" ");

  const puntuadas = options.map((opcion) => {
    const etiqueta = normalizar(opcion.label);
    const suyas = palabrasUtiles(opcion.label);

    let puntos = 0;
    if (etiqueta === frase) puntos += 100;
    if (etiqueta.includes(frase) || frase.includes(etiqueta)) puntos += 40;

    // Cada palabra compartida suma; las de la opción pesan más que las dichas
    // de más, porque decir de más es normal y decir de menos es ambiguo.
    for (const palabra of suyas) {
      if (dichas.includes(palabra)) puntos += 10;
      else if (dichas.some((d) => d.startsWith(palabra) || palabra.startsWith(d))) {
        puntos += 4;
      }
    }
    return { opcion, puntos };
  });

  puntuadas.sort((a, b) => b.puntos - a.puntos);
  const [mejor, segunda] = puntuadas;

  if (mejor.puntos < 10) return null;
  if (segunda && mejor.puntos === segunda.puntos) return null;
  return mejor.opcion;
}
