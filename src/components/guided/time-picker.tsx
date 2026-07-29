"use client";

import { useEffect, useRef, useState } from "react";

/**
 * Selector de hora tipo rueda, 24 horas.
 *
 * Sin AM/PM: es una fuente de error real y aquí nunca hace falta.
 *
 * Pensado para el pulgar. Dos columnas con scroll-snap nativo — el navegador
 * hace la inercia y el imán, así que se siente como el selector del sistema
 * sin librerías ni listeners de gesto. Solo se lee el scroll para saber qué
 * quedó en el centro.
 */

const ALTO_ITEM = 56;
const VISIBLES = 5;
const RELLENO = ((VISIBLES - 1) / 2) * ALTO_ITEM;

export function TimePicker({
  value,
  onChange,
}: {
  value: { hour: number; minute: number };
  onChange: (v: { hour: number; minute: number }) => void;
}) {
  return (
    <div className="relative select-none">
      {/* Banda del centro: marca qué valor está elegido. */}
      <div
        className="pointer-events-none absolute inset-x-0 top-1/2 -translate-y-1/2 rounded-xl bg-surface"
        style={{ height: ALTO_ITEM }}
        aria-hidden
      />

      <div className="relative flex items-center justify-center gap-1">
        <Rueda
          values={Array.from({ length: 24 }, (_, i) => i)}
          value={value.hour}
          onChange={(hour) => onChange({ ...value, hour })}
          label="hora"
        />
        <span className="pb-1 text-3xl font-light text-muted" aria-hidden>
          :
        </span>
        <Rueda
          values={Array.from({ length: 60 }, (_, i) => i)}
          value={value.minute}
          onChange={(minute) => onChange({ ...value, minute })}
          label="minuto"
        />
      </div>
    </div>
  );
}

function Rueda({
  values,
  value,
  onChange,
  label,
}: {
  values: number[];
  value: number;
  onChange: (v: number) => void;
  label: string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [activo, setActivo] = useState(value);
  const inicializado = useRef(false);
  const temporizador = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Posición inicial sin animación: aparecer ya en el valor correcto.
  useEffect(() => {
    const nodo = ref.current;
    if (!nodo || inicializado.current) return;
    inicializado.current = true;
    nodo.scrollTop = values.indexOf(value) * ALTO_ITEM;
  }, [value, values]);

  function alHacerScroll() {
    const nodo = ref.current;
    if (!nodo) return;

    const indice = Math.round(nodo.scrollTop / ALTO_ITEM);
    const siguiente = values[Math.max(0, Math.min(values.length - 1, indice))];
    if (siguiente !== activo) setActivo(siguiente);

    // El valor se confirma cuando el scroll se detiene, no en cada píxel:
    // así no se emiten cincuenta cambios por gesto.
    if (temporizador.current) clearTimeout(temporizador.current);
    temporizador.current = setTimeout(() => {
      if (siguiente !== value) onChange(siguiente);
    }, 90);
  }

  return (
    <div
      ref={ref}
      onScroll={alHacerScroll}
      role="listbox"
      aria-label={label}
      tabIndex={0}
      className="no-scrollbar snap-y snap-mandatory overflow-y-scroll overscroll-contain scroll-smooth"
      style={{
        height: VISIBLES * ALTO_ITEM,
        width: 96,
        paddingBlock: RELLENO,
        maskImage:
          "linear-gradient(to bottom, transparent, #000 22%, #000 78%, transparent)",
        WebkitMaskImage:
          "linear-gradient(to bottom, transparent, #000 22%, #000 78%, transparent)",
      }}
    >
      {values.map((v) => {
        const distancia = Math.abs(v - activo);
        return (
          <div
            key={v}
            role="option"
            aria-selected={v === activo}
            onClick={() => {
              ref.current?.scrollTo({ top: values.indexOf(v) * ALTO_ITEM, behavior: "smooth" });
            }}
            className="flex snap-center items-center justify-center font-mono tabular-nums transition-all duration-150"
            style={{
              height: ALTO_ITEM,
              fontSize: distancia === 0 ? 34 : distancia === 1 ? 26 : 22,
              opacity: distancia === 0 ? 1 : distancia === 1 ? 0.45 : 0.2,
              fontWeight: distancia === 0 ? 600 : 400,
            }}
          >
            {String(v).padStart(2, "0")}
          </div>
        );
      })}
    </div>
  );
}
