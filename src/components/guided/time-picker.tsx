"use client";

import { ALTO_ITEM, Wheel } from "./wheel";

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

// Constantes de módulo: si se crearan en cada render, su identidad cambiaría
// y el efecto de sincronización se dispararía sin motivo en cada pintada.
const HORAS = Array.from({ length: 24 }, (_, i) => i);
const MINUTOS = Array.from({ length: 60 }, (_, i) => i);

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
        <Wheel
          values={HORAS}
          value={value.hour}
          onChange={(hour) => onChange({ ...value, hour })}
          label="hora"
        />
        <span className="pb-1 text-3xl font-light text-muted" aria-hidden>
          :
        </span>
        <Wheel
          values={MINUTOS}
          value={value.minute}
          onChange={(minute) => onChange({ ...value, minute })}
          label="minuto"
        />
      </div>
    </div>
  );
}
