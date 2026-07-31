"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { allDrafts, type Draft } from "@/lib/quick/draft";

/**
 * Tarjeta de Hoy con su estado.
 *
 * Tres estados, y la diferencia entre ellos es el punto entero de la pantalla:
 *
 *   pendiente  — sin tocar hoy
 *   en curso   — lo empezaste y lo dejaste a medias; dice por qué paso vas
 *   hecho      — con la hora, para no volver a registrarlo por si acaso
 *
 * El «hecho» lo sabe el servidor (hay evento). El «en curso» solo lo sabe el
 * navegador, porque un flujo a medias no es un dato que merezca estar en la
 * base. Por eso la tarjeta es de cliente aunque el estado principal venga ya
 * calculado: pintar el borrador exige leer localStorage.
 */

export type CardStatus = {
  count: number;
  lastAt: string | null;
  /** Sesión o comida abierta ahora mismo. Solo gimnasio y comida. */
  open?: boolean;
  /**
   * Progreso hacia una meta, 0–1. Solo el agua.
   *
   * El agua no se cuenta en veces sino en cantidad: «3 registros» no informa,
   * «1,5 de 2 L» sí. Por eso su tarjeta lleva barra y no marca de hecho.
   */
  progress?: number;
  progressLabel?: string;
};

export function TodayCard({
  href,
  icon,
  label,
  status,
  destacada,
  totalSteps,
  flowId,
}: {
  href: string;
  icon: string;
  label: string;
  status: CardStatus;
  destacada?: boolean;
  /** Cuántos pasos tiene el flujo, para poder decir «2 de 3». */
  totalSteps?: number;
  /** Clave del borrador. Si falta, la tarjeta no tiene progreso que mostrar. */
  flowId?: string;
}) {
  const draft = useDraft(flowId);

  const enCurso = Boolean(draft) || status.open;
  const conMeta = status.progress !== undefined;
  // Con meta, «hecho» es haberla cumplido, no haber registrado algo: un vaso
  // de agua no es el día resuelto.
  const hecho = conMeta ? status.progress! >= 1 : status.count > 0 && !enCurso;

  const borde = enCurso
    ? "border-accent"
    : hecho
      ? "border-done"
      : "border-line";
  const fondo = hecho ? "bg-done-surface" : "bg-surface";

  return (
    <Link
      href={href}
      aria-label={`${label} · ${leyendaAccesible(status, draft, totalSteps)}`}
      className={`relative flex flex-col items-center justify-center gap-1.5 rounded-xl border ${borde} ${fondo} text-center transition active:scale-[0.96] ${
        destacada ? "py-6" : "py-4"
      }`}
    >
      {hecho && (
        <span
          aria-hidden
          className="absolute top-2 right-2 flex h-5 w-5 items-center justify-center rounded-full bg-done text-[11px] font-bold text-white"
        >
          ✓
        </span>
      )}
      {enCurso && (
        <span
          aria-hidden
          className="absolute top-2 right-2 h-2 w-2 animate-pulse rounded-full bg-accent"
        />
      )}

      <span className={destacada ? "text-3xl" : "text-2xl"}>{icon}</span>
      <span className={`font-medium ${destacada ? "" : "text-sm"}`}>{label}</span>

      {conMeta && (
        <span
          className="mt-0.5 h-1 w-10 overflow-hidden rounded-full bg-line"
          aria-hidden
        >
          <span
            className={`block h-full rounded-full transition-all duration-500 ${
              hecho ? "bg-done" : "bg-accent"
            }`}
            style={{ width: `${Math.round(Math.min(1, status.progress!) * 100)}%` }}
          />
        </span>
      )}

      <span
        className={`text-[11px] tabular-nums ${
          enCurso ? "font-medium text-accent" : hecho ? "text-done" : "text-muted"
        }`}
      >
        {leyenda(status, draft, totalSteps)}
      </span>
    </Link>
  );
}

function leyenda(
  status: CardStatus,
  draft: Draft | null,
  totalSteps?: number,
): string {
  if (status.progressLabel) return status.progressLabel;
  if (status.open) return "sin cerrar";
  if (draft) {
    return totalSteps
      ? `paso ${Math.min(draft.step + 1, totalSteps)} de ${totalSteps}`
      : "a medias";
  }
  if (status.count === 0) return "pendiente";
  if (status.count > 1) return `${status.count} hoy`;
  return status.lastAt ?? "hecho";
}

/**
 * Lo mismo, dicho entero para quien use lector de pantalla.
 *
 * Tiene que decir lo MISMO que la leyenda visible. Si la tarjeta muestra
 * «3 hoy» y el lector dice «hecho a las 11:48», son dos interfaces distintas
 * y una de las dos está mintiendo.
 */
function leyendaAccesible(
  status: CardStatus,
  draft: Draft | null,
  totalSteps?: number,
): string {
  if (status.progressLabel) return status.progressLabel;
  if (status.open) return "sin cerrar, toca para continuar";
  if (draft) return `a medias, ${leyenda(status, draft, totalSteps)}`;
  if (status.count === 0) return "pendiente";
  if (status.count > 1) {
    return `${status.count} registros hoy${status.lastAt ? `, el último a las ${status.lastAt}` : ""}`;
  }
  return `hecho${status.lastAt ? ` a las ${status.lastAt}` : ""}`;
}

/**
 * Lee el borrador después de montar, nunca durante el render del servidor.
 *
 * Si se leyera en el primer render, el HTML del servidor —que no puede ver
 * localStorage— diría «pendiente» y el cliente diría «paso 2 de 3»: React
 * marcaría un error de hidratación y descartaría el árbol.
 */
function useDraft(flowId?: string): Draft | null {
  const [draft, setDraft] = useState<Draft | null>(null);

  useEffect(() => {
    if (!flowId) return;
    const leer = () => setDraft(allDrafts()[flowId] ?? null);
    leer();
    // Volver con el botón atrás no siempre remonta el componente; sin esto la
    // tarjeta seguiría anunciando un borrador que acabas de terminar.
    window.addEventListener("focus", leer);
    window.addEventListener("storage", leer);
    return () => {
      window.removeEventListener("focus", leer);
      window.removeEventListener("storage", leer);
    };
  }, [flowId]);

  return draft;
}
