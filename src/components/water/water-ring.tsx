"use client";

import { formatoAgua, formatoLitros } from "@/lib/water/units";

/**
 * Anillo de progreso del agua.
 *
 * Dentro del aro va SOLO lo que cabe sin apretarse: la cantidad y la meta. El
 * estado —«faltan 500 ml», «meta cumplida»— va debajo, fuera. Estaba dentro y
 * se salía: un aro de 224 px deja unos 180 px de hueco, y «Meta cumplida · 1 L
 * para excelente» no entra en eso sin pisar el trazo.
 *
 * Dos umbrales, no uno. El arco fuerte llena hasta la meta; pasada, un segundo
 * arco más tenue avanza hacia lo excelente. Una barra que se llena y ya no dice
 * nada desperdicia justo el momento en que queda algo que perseguir.
 *
 * NO se toca, y eso hay que decirlo con el diseño: un círculo grande con un
 * número, en una app donde todo lo demás se pulsa, se lee como un botón. Lleva
 * la etiqueta «HOY» encima para que se lea como un marcador, y debajo va la
 * pregunta que sí tiene respuesta pulsable.
 */
export function WaterRing({
  total,
  goalMl,
  excellentMl,
}: {
  total: number;
  goalMl: number;
  excellentMl: number;
}) {
  const R = 82;
  const CIRC = 2 * Math.PI * R;

  const cumplida = total >= goalMl;
  const excelente = total >= excellentMl;

  const hastaMeta = Math.min(total, goalMl) / goalMl;
  const extra =
    excellentMl > goalMl
      ? Math.max(0, Math.min(total, excellentMl) - goalMl) / (excellentMl - goalMl)
      : 0;

  return (
    <div className="flex flex-col items-center gap-2">
      <span className="text-[11px] font-medium tracking-[0.14em] text-muted uppercase">
        Hoy
      </span>
      <div className="relative size-52">
        <svg viewBox="0 0 200 200" className="size-full -rotate-90">
          <circle
            cx="100" cy="100" r={R} fill="none"
            className="stroke-line" strokeWidth="10"
          />
          {extra > 0 && (
            <circle
              cx="100" cy="100" r={R} fill="none"
              className="stroke-done/35" strokeWidth="10" strokeLinecap="round"
              strokeDasharray={CIRC}
              strokeDashoffset={CIRC * (1 - extra)}
              // Solo el trazo se anima. Con `transition-all` también se
              // interpolaba el cambio de color, y el aro pasaba por un gris
              // sucio a mitad de camino.
              style={{ transition: "stroke-dashoffset 400ms ease-out" }}
            />
          )}
          <circle
            cx="100" cy="100" r={R} fill="none"
            strokeWidth="10" strokeLinecap="round"
            className={cumplida ? "stroke-done" : "stroke-accent"}
            strokeDasharray={CIRC}
            strokeDashoffset={CIRC * (1 - hastaMeta)}
            style={{ transition: "stroke-dashoffset 400ms ease-out" }}
          />
        </svg>

        <div className="absolute inset-0 flex flex-col items-center justify-center">
          {/* Las dos líneas van en LITROS. Con «250 ml» encima de «de 2 L»
              había que convertir mentalmente para saber por dónde ibas. */}
          <span className="font-mono text-4xl leading-none tabular-nums">
            {formatoLitros(total)}
          </span>
          <span className="mt-1.5 text-xs text-muted">
            de {formatoLitros(goalMl)}
          </span>
        </div>
      </div>

      {/* Fuera del aro: aquí el texto puede ser tan largo como haga falta. */}
      <p
        className={`text-center text-sm ${
          cumplida ? "font-medium text-done" : "text-muted"
        }`}
        role="status"
      >
        {excelente
          ? "Excelente"
          : cumplida
            ? `Meta cumplida · ${formatoAgua(excellentMl - total)} para excelente`
            : `Faltan ${formatoAgua(goalMl - total)}`}
      </p>
    </div>
  );
}
