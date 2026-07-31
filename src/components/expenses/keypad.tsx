"use client";

/**
 * Teclado numérico propio.
 *
 * Un gasto es una cifra ARBITRARIA: 137, 62,50, 1.240. Los importes
 * predefinidos —50, 100, 200, 500— no aciertan casi nunca, así que siempre
 * acababas en «otra cantidad» y de ahí en un `<input type="number">` con las
 * flechitas del navegador.
 *
 * Y el teclado del sistema tampoco sirve: ocupa media pantalla, tapa las
 * categorías y sus teclas son pequeñas. Este es el mismo patrón que cualquier
 * terminal de pago — teclas grandes, siempre en el mismo sitio, sin nada que
 * aparezca o desaparezca debajo.
 */

const TECLAS = ["1", "2", "3", "4", "5", "6", "7", "8", "9", ".", "0", "⌫"];

export function Keypad({
  value,
  onChange,
  disabled,
}: {
  /** Lo tecleado, como texto: hace falta para distinguir «5» de «5.» y «5.0». */
  value: string;
  onChange: (v: string) => void;
  disabled?: boolean;
}) {
  function pulsar(tecla: string) {
    if (tecla === "⌫") return onChange(value.slice(0, -1));

    if (tecla === ".") {
      // Un solo punto, y nunca de primero: «.5» no es una cantidad que nadie
      // teclee a propósito.
      if (value.includes(".") || value === "") return;
      return onChange(`${value}.`);
    }

    // Dos decimales como mucho: el peso no tiene más, y seguir aceptando
    // dígitos daría la falsa impresión de que se guardan.
    const [, decimales] = value.split(".");
    if (decimales !== undefined && decimales.length >= 2) return;
    // Sin ceros a la izquierda: «007» se lee como un error.
    if (value === "0") return onChange(tecla);
    if (value.length >= 9) return;

    onChange(value + tecla);
  }

  return (
    <div className="grid grid-cols-3 gap-2">
      {TECLAS.map((t) => (
        <button
          key={t}
          type="button"
          disabled={disabled}
          onClick={() => pulsar(t)}
          aria-label={t === "⌫" ? "Borrar" : t}
          className={`rounded-2xl border border-line py-4 font-mono text-2xl tabular-nums transition active:scale-[0.95] disabled:opacity-40 ${
            t === "⌫" ? "text-muted" : "bg-surface"
          }`}
        >
          {t}
        </button>
      ))}
    </div>
  );
}
