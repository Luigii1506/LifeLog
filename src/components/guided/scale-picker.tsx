"use client";

import { ALTO_ITEM, Wheel } from "./wheel";

/**
 * Selector de un número con decimal, tipo rueda. Para la báscula.
 *
 * Dos ruedas —entero y décima— en vez de una sola con todos los valores. Con
 * 0,1 de paso entre 30 y 250 saldrían 2.200 posiciones: girar de 78,4 a 79,2
 * sería un viaje. Separadas, el entero se elige de un gesto y la décima de
 * otro, que es como se lee una báscula.
 *
 * Arranca en tu último peso: entre dos pesadas cambia medio kilo, así que casi
 * siempre solo hay que ajustar la décima. Ese es el gesto que sustituye a
 * teclear.
 */

/** Rango de una persona. Fuera de esto, es un dedo mal puesto. */
const MINIMO = 30;
const MAXIMO = 250;

const ENTEROS = Array.from({ length: MAXIMO - MINIMO + 1 }, (_, i) => MINIMO + i);
const DECIMAS = Array.from({ length: 10 }, (_, i) => i);

export function ScalePicker({
  value,
  onChange,
  unit = "kg",
}: {
  value: number;
  onChange: (v: number) => void;
  unit?: string;
}) {
  const seguro = Math.min(MAXIMO, Math.max(MINIMO, value));
  const entero = Math.floor(seguro);
  // `Math.round` y no truncar: 78.4 en coma flotante es 78.39999…, y truncar
  // daría 3 en vez de 4.
  const decima = Math.round((seguro - entero) * 10);

  return (
    <div className="relative select-none">
      {/* Banda del centro: marca qué valor está elegido. */}
      <div
        className="pointer-events-none absolute inset-x-0 top-1/2 -translate-y-1/2 rounded-xl bg-surface"
        style={{ height: ALTO_ITEM }}
        aria-hidden
      />

      <div className="relative flex items-center justify-center gap-0.5">
        <Wheel
          values={ENTEROS}
          value={entero}
          onChange={(n) => onChange(Number((n + decima / 10).toFixed(1)))}
          label={unit}
          format={(v) => String(v)}
          width={104}
        />
        <span className="pt-3 text-3xl font-light text-muted" aria-hidden>
          ,
        </span>
        <Wheel
          values={DECIMAS}
          value={decima}
          onChange={(d) => onChange(Number((entero + d / 10).toFixed(1)))}
          label="décimas"
          format={(v) => String(v)}
          width={72}
        />
        <span className="pt-4 pl-1 text-lg text-muted">{unit}</span>
      </div>
    </div>
  );
}
