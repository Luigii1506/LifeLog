"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";

/**
 * Rueda de scroll para elegir un valor.
 *
 * Sale del selector de hora, donde estaba encerrada. La mecánica es la misma
 * para cualquier escala —hora, peso— y duplicarla habría significado dos sitios
 * donde arreglar el mismo tirón.
 *
 * Usa scroll-snap nativo: el navegador hace la inercia y el imán, así que se
 * siente como el selector del sistema sin librerías ni gestos a mano. Solo se
 * lee el scroll para saber qué quedó en el centro.
 */

/**
 * useLayoutEffect corre ANTES de pintar, así que la rueda aparece ya en su
 * sitio en vez de mostrar el primer valor durante un fotograma. En el servidor
 * no existe layout, así que ahí se cae a useEffect para no avisar por consola.
 */
const useEfectoDeLayout = typeof window !== "undefined" ? useLayoutEffect : useEffect;

export const ALTO_ITEM = 56;
const VISIBLES = 5;
const RELLENO = ((VISIBLES - 1) / 2) * ALTO_ITEM;

export function Wheel({
  values,
  value,
  onChange,
  label,
  format = (v) => String(v).padStart(2, "0"),
  width = 96,
}: {
  values: number[];
  value: number;
  onChange: (v: number) => void;
  label: string;
  /** Cómo se pinta cada valor. La hora lleva cero delante; el peso no. */
  format?: (v: number) => string;
  width?: number;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [activo, setActivo] = useState(value);
  const montado = useRef(false);
  /** Último valor que ESTA rueda emitió, para distinguir quién causó el cambio. */
  const emitido = useRef(value);
  const temporizador = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEfectoDeLayout(() => {
    const nodo = ref.current;
    if (!nodo) return;

    if (!montado.current) {
      montado.current = true;
      emitido.current = value;
      // INSTANTÁNEO, no suave: la rueda de minutos son 3.300 px hasta el 59, y
      // con scroll suave eso es un segundo largo girando desde 00. Se ve como
      // si no hubiera puesto la hora actual — que es justo lo que hace.
      nodo.scrollTo({ top: values.indexOf(value) * ALTO_ITEM, behavior: "instant" });
      return;
    }

    // El valor cambió desde FUERA —el dictado, por ejemplo— así que hay que
    // mover la rueda. Si el cambio vino del propio scroll del usuario, la
    // rueda ya está en su sitio y moverla otra vez daría un tirón.
    if (value === emitido.current) return;
    emitido.current = value;
    setActivo(value);
    nodo.scrollTo({ top: values.indexOf(value) * ALTO_ITEM, behavior: "smooth" });
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
      if (siguiente === value) return;
      emitido.current = siguiente;
      onChange(siguiente);
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
        width,
        paddingBlock: RELLENO,
        maskImage:
          "linear-gradient(to bottom, transparent, #000 22%, #000 78%, transparent)",
        WebkitMaskImage:
          "linear-gradient(to bottom, transparent, #000 22%, #000 78%, transparent)",
      }}
    >
      {values.map((v) => {
        const distancia = Math.abs(values.indexOf(v) - values.indexOf(activo));
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
            {format(v)}
          </div>
        );
      })}
    </div>
  );
}
