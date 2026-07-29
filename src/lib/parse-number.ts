/**
 * Lectura de un número desde un formulario.
 *
 * Existe por un fallo real: el teclado en español da coma decimal, y
 * `<input type="number">` la rechaza y entrega el valor vacío. Un registro
 * de sueño de «7,5 horas» se perdía en silencio — el campo obligatorio
 * llegaba como `undefined`, la validación fallaba y el error aparecía como
 * texto gris pequeño que nadie ve en un móvil.
 */
export function parseFormNumber(value: FormDataEntryValue | null): number | undefined {
  if (value === null) return undefined;
  const texto = String(value).trim();
  if (texto === "") return undefined;

  // Coma decimal y separadores de millar. "1.234,5" y "1,234.5" son ambos
  // números válidos según de dónde venga el teclado.
  const normalizado = normalizarDecimal(texto);
  const n = Number(normalizado);
  return Number.isFinite(n) ? n : undefined;
}

function normalizarDecimal(texto: string): string {
  const tieneComa = texto.includes(",");
  const tienePunto = texto.includes(".");

  if (tieneComa && tienePunto) {
    // El último separador que aparece es el decimal.
    return texto.lastIndexOf(",") > texto.lastIndexOf(".")
      ? texto.replace(/\./g, "").replace(",", ".")
      : texto.replace(/,/g, "");
  }
  if (tieneComa) return texto.replace(",", ".");
  return texto;
}
