"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { parentOf, titleOf } from "@/lib/navigation";
import { useTopStatus, type TopStatus } from "./status-slot";

/**
 * Barra superior con vuelta atrás y estado en curso.
 *
 * Va al padre LÓGICO, no al historial. En un bucle de registro el historial se
 * llena de pasos intermedios y «atrás» acaba llevándote a la pantalla de
 * confirmación de algo que ya guardaste.
 *
 * A la izquierda porque es donde todo el mundo lo busca, y grande porque un
 * objetivo de 24 px no se acierta caminando.
 *
 * Lee los parámetros de la URL además de la ruta: en el gimnasio la
 * profundidad vive ahí, y sin ellos «atrás» desde una serie saltaba hasta Hoy.
 *
 * Cuando hay algo abierto —un entrenamiento, una comida— el título deja su
 * sitio al estado. Es el motivo de que esa información NO esté abajo: abajo se
 * actúa, y esa zona es del pulgar, de la navegación y del micrófono.
 */
export function TopBar() {
  const pathname = usePathname();
  const search = useSearchParams();
  const padre = parentOf(pathname, search);
  const titulo = titleOf(pathname);
  const status = useTopStatus();

  if (!padre) return null;

  return (
    <div className="sticky top-0 z-10 -mx-5 mb-2 flex items-center gap-1 border-b border-line bg-background/90 px-2 py-2 backdrop-blur">
      <Link
        href={padre}
        aria-label="Atrás"
        className="flex size-11 shrink-0 items-center justify-center rounded-xl text-2xl text-muted transition active:scale-90"
      >
        ‹
      </Link>

      {status ? (
        <StatusPill status={status} />
      ) : (
        titulo && (
          <span className="text-sm font-medium tracking-[0.12em] text-muted uppercase">
            {titulo}
          </span>
        )
      )}
    </div>
  );
}

function StatusPill({ status }: { status: TopStatus }) {
  const contenido = (
    <>
      {/* El punto latiendo dice «esto sigue corriendo» sin gastar palabras. Es
          lo que distingue una sesión abierta de un resumen. */}
      <span className="relative flex size-2 shrink-0" aria-hidden>
        <span
          className={`absolute inline-flex size-full animate-ping rounded-full opacity-60 ${
            status.warn ? "bg-accent" : "bg-done"
          }`}
        />
        <span
          className={`relative inline-flex size-2 rounded-full ${
            status.warn ? "bg-accent" : "bg-done"
          }`}
        />
      </span>
      <span className="truncate">{status.label}</span>
    </>
  );

  const clases = `flex min-w-0 items-center gap-2 rounded-full border px-3 py-1.5 text-sm ${
    status.warn ? "border-accent/40 bg-accent/10" : "border-line bg-surface"
  }`;

  if (!status.onTap) return <span className={clases}>{contenido}</span>;

  return (
    <button
      onClick={status.onTap}
      aria-label="Ver el entrenamiento en curso"
      className={`${clases} transition active:scale-[0.97]`}
    >
      {contenido}
    </button>
  );
}
