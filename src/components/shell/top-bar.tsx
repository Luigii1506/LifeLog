"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { parentOf, titleOf } from "@/lib/navigation";

/**
 * Barra superior con vuelta atrás.
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
 */
export function TopBar() {
  const pathname = usePathname();
  const search = useSearchParams();
  const padre = parentOf(pathname, search);
  const titulo = titleOf(pathname);

  if (!padre) return null;

  return (
    <div className="sticky top-0 z-10 -mx-5 mb-2 flex items-center gap-1 border-b border-line bg-background/90 px-2 py-2 backdrop-blur">
      <Link
        href={padre}
        aria-label="Atrás"
        className="flex size-11 items-center justify-center rounded-xl text-2xl text-muted transition active:scale-90"
      >
        ‹
      </Link>
      {titulo && (
        <span className="text-sm font-medium tracking-[0.12em] text-muted uppercase">
          {titulo}
        </span>
      )}
    </div>
  );
}
