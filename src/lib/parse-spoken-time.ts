/**
 * «cinco y media» → 05:30.
 *
 * Interpreta expresiones de hora dichas en español. Es la pieza que decide si
 * dictar sirve: la API de voz devuelve texto, y ese texto viene como lo dice
 * una persona, no como lo espera un formulario.
 *
 * Devuelve null si no está razonablemente seguro. Poner una hora equivocada es
 * peor que no poner ninguna: la primera corrompe el dato en silencio, la
 * segunda solo obliga a girar la rueda.
 */

export type SpokenTime = { hour: number; minute: number };

const NUMEROS: Record<string, number> = {
  cero: 0, un: 1, uno: 1, una: 1, dos: 2, tres: 3, cuatro: 4, cinco: 5,
  seis: 6, siete: 7, ocho: 8, nueve: 9, diez: 10, once: 11, doce: 12,
  trece: 13, catorce: 14, quince: 15, dieciseis: 16, diecisiete: 17,
  dieciocho: 18, diecinueve: 19, veinte: 20, veintiuno: 21, veintiun: 21,
  veintiuna: 21, veintidos: 22, veintitres: 23, veinticuatro: 24,
  veinticinco: 25, veintiseis: 26, veintisiete: 27, veintiocho: 28,
  veintinueve: 29, treinta: 30, cuarenta: 40, cincuenta: 50,
  // No son minutos válidos, pero reconocerlos permite RECHAZAR «siete
  // noventa» en vez de ignorar la palabra y devolver un 7:00 inventado.
  sesenta: 60, setenta: 70, ochenta: 80, noventa: 90, cien: 100,
};

/** Palabras que no aportan y que la gente dice al hablar. */
const RELLENO = new Set([
  "a", "al", "la", "las", "los", "el", "de", "del", "eso", "como", "mas",
  "menos_o_mas", "aproximadamente", "sobre", "hora", "horas", "minutos",
  "minuto", "son", "es", "fue", "desperte", "punto", "en",
]);

function normalizar(texto: string): string[] {
  return texto
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "") // quita acentos: "veintitrés" → "veintitres"
    .replace(/[^\w\s:]/g, " ")
    .split(/\s+/)
    .filter(Boolean);
}

export function parseSpokenTime(input: string): SpokenTime | null {
  if (!input.trim()) return null;
  const palabras = normalizar(input);
  const texto = palabras.join(" ");

  // Expresiones sin número: se resuelven antes de buscar cifras.
  if (/\bmediodia\b/.test(texto)) return { hour: 12, minute: 0 };
  if (/\bmedianoche\b/.test(texto)) return { hour: 0, minute: 0 };

  // Formato ya numérico: "7:30", "07:30".
  for (const palabra of palabras) {
    const m = /^(\d{1,2}):(\d{2})$/.exec(palabra);
    if (m) return validar(Number(m[1]), Number(m[2]), palabras);
  }

  let hora: number | null = null;
  let minuto: number | null = null;
  let menos = false;

  for (let i = 0; i < palabras.length; i++) {
    const palabra = palabras[i];

    if (palabra === "menos") {
      menos = true;
      continue;
    }
    if (palabra === "media") {
      minuto = 30;
      continue;
    }
    if (palabra === "cuarto") {
      minuto = 15;
      continue;
    }
    if (RELLENO.has(palabra)) continue;

    // Dígitos sueltos: "7 30", "730".
    if (/^\d+$/.test(palabra)) {
      const n = Number(palabra);
      if (palabra.length >= 3 && hora === null) {
        // "730" → 7:30
        hora = Math.floor(n / 100);
        minuto = n % 100;
        continue;
      }
      if (hora === null) hora = n;
      else if (minuto === null) minuto = n;
      continue;
    }

    const valor = NUMEROS[palabra];
    if (valor === undefined) continue;

    if (hora === null) {
      hora = valor;
      continue;
    }

    // Compuestos de minuto: "treinta y cinco", "cuarenta y cinco".
    if (minuto !== null && minuto % 10 === 0 && minuto >= 20 && minuto <= 50 && valor < 10) {
      minuto += valor;
      continue;
    }
    if (minuto === null) minuto = valor;
  }

  if (hora === null) return null;

  if (menos) {
    // "siete menos cuarto" = 6:45
    const restar = minuto ?? 0;
    hora = (hora + 23) % 24;
    minuto = 60 - restar;
    if (minuto === 60) minuto = 0;
  }

  return validar(hora, minuto ?? 0, palabras);
}

function validar(hora: number, minuto: number, palabras: string[]): SpokenTime | null {
  if (!Number.isInteger(hora) || !Number.isInteger(minuto)) return null;
  if (minuto < 0 || minuto > 59) return null;

  // "de la tarde" / "de la noche" desplazan al formato de 24 horas.
  const texto = palabras.join(" ");
  if (/\b(tarde|noche)\b/.test(texto) && hora >= 1 && hora <= 11) hora += 12;

  if (hora < 0 || hora > 23) return null;
  return { hour: hora, minute: minuto };
}
