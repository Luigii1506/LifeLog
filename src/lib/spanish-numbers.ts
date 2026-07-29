/**
 * Números dichos en español.
 *
 * Compartido por el dictado de horas y el de series. Reconoce compuestos
 * («cuarenta y cinco», «ciento veinte») porque en el gimnasio los pesos se
 * dicen así y no en cifras.
 */

export const NUMEROS_BASE: Record<string, number> = {
  cero: 0, un: 1, uno: 1, una: 1, dos: 2, tres: 3, cuatro: 4, cinco: 5,
  seis: 6, siete: 7, ocho: 8, nueve: 9, diez: 10, once: 11, doce: 12,
  trece: 13, catorce: 14, quince: 15, dieciseis: 16, diecisiete: 17,
  dieciocho: 18, diecinueve: 19, veinte: 20, veintiuno: 21, veintiun: 21,
  veintiuna: 21, veintidos: 22, veintitres: 23, veinticuatro: 24,
  veinticinco: 25, veintiseis: 26, veintisiete: 27, veintiocho: 28,
  veintinueve: 29, treinta: 30, cuarenta: 40, cincuenta: 50, sesenta: 60,
  setenta: 70, ochenta: 80, noventa: 90,
};

const CENTENAS: Record<string, number> = {
  cien: 100, ciento: 100, doscientos: 200, trescientos: 300,
  cuatrocientos: 400, quinientos: 500,
  // No es un peso plausible, pero reconocerlo permite RECHAZAR «mil por diez»
  // en vez de ignorar la palabra y registrar una serie inventada.
  mil: 1000,
};

/** Fracciones que se dicen sueltas: «setenta y medio» son 70.5 kg. */
const FRACCIONES: Record<string, number> = { medio: 0.5, media: 0.5, cuarto: 0.25 };

export function normalizarPalabras(texto: string): string[] {
  return texto
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^\w\s:.,]/g, " ")
    .split(/\s+/)
    .filter(Boolean);
}

/**
 * Lee un número desde una secuencia de palabras, empezando en `desde`.
 * Devuelve el valor y cuántas palabras consumió, o null si no había número.
 *
 * Consume compuestos completos: «ciento veinte» son 120, no 100 y luego 20.
 */
export function leerNumero(
  palabras: string[],
  desde = 0,
): { valor: number; consumidas: number } | null {
  let total: number | null = null;
  let i = desde;

  while (i < palabras.length) {
    const palabra = palabras[i];

    // Cifra literal: "70", "70.5", "70,5"
    if (/^\d+([.,]\d+)?$/.test(palabra)) {
      if (total !== null) break;
      total = Number(palabra.replace(",", "."));
      i += 1;
      continue;
    }

    const centena = CENTENAS[palabra];
    if (centena !== undefined) {
      if (total !== null) break;
      total = centena;
      i += 1;
      continue;
    }

    const base = NUMEROS_BASE[palabra];
    if (base !== undefined) {
      if (total === null) {
        total = base;
        i += 1;
        continue;
      }
      // Compuesto: 100 + 20, o 40 + 5. Solo suma si es coherente.
      const esDecenaMasUnidad = total % 10 === 0 && total < 100 && base < 10;
      const esCentenaMasResto = total % 100 === 0 && base < 100;
      if (esDecenaMasUnidad || esCentenaMasResto) {
        total += base;
        i += 1;
        continue;
      }
      break;
    }

    // "y" solo continúa si viene otro número detrás.
    if (palabra === "y" && total !== null) {
      const siguiente = palabras[i + 1];
      const fraccion = siguiente ? FRACCIONES[siguiente] : undefined;
      if (fraccion !== undefined) {
        total += fraccion;
        i += 2;
        continue;
      }
      if (siguiente && (NUMEROS_BASE[siguiente] !== undefined || /^\d/.test(siguiente))) {
        i += 1;
        continue;
      }
      break;
    }

    break;
  }

  if (total === null) return null;
  return { valor: total, consumidas: i - desde };
}
