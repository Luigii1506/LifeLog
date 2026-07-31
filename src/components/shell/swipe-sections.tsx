"use client";

import { useEffect, useRef } from "react";
import { usePathname, useRouter } from "next/navigation";
import { neighbour } from "@/lib/sections";

/**
 * Deslizar para cambiar de sección.
 *
 * Deslizar a la IZQUIERDA avanza —Hoy → Agua → Gimnasio → Comida— y a la
 * derecha retrocede. Es la convención de todo lo que tiene pestañas: el dedo
 * empuja el contenido hacia un lado y entra el de ese lado.
 *
 * El gesto solo funciona si coincide con un orden visible, y ese orden es la
 * barra inferior. Sin ella no sabrías cuántas secciones hay ni dónde estás, y
 * deslizar sería una ruleta.
 *
 * Es un ATAJO, no la única forma de navegar: las pestañas siguen ahí. Quien no
 * descubra el gesto no pierde nada, y quien no pueda hacerlo tampoco.
 */

/** Distancia mínima. Por debajo, es un toque tembloroso, no un gesto. */
const MINIMO_PX = 64;
/** El movimiento horizontal debe superar al vertical por este factor. */
const DOMINANCIA = 1.6;
/** Más lento que esto no es un gesto: es arrastrar el dedo sin querer. */
const MAXIMO_MS = 700;

export function SwipeSections({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const contenedor = useRef<HTMLDivElement>(null);
  // La ruta cambia sin que el efecto se vuelva a montar; la referencia evita
  // reinstalar los escuchadores en cada navegación.
  const ruta = useRef(pathname);
  ruta.current = pathname;

  useEffect(() => {
    const nodo = contenedor.current;
    if (!nodo) return;

    let x0 = 0;
    let y0 = 0;
    let t0 = 0;
    let valido = false;

    function empezar(e: TouchEvent) {
      const t = e.touches[0];
      if (!t || e.touches.length > 1) {
        valido = false;
        return;
      }
      // Nada de gestos sobre una hoja abierta ni sobre algo que se desplaza a
      // lo ancho: ahí el dedo ya significa otra cosa.
      const destino = e.target as HTMLElement | null;
      if (destino?.closest('[role="dialog"], [data-sin-swipe]')) {
        valido = false;
        return;
      }
      x0 = t.clientX;
      y0 = t.clientY;
      t0 = Date.now();
      valido = true;
    }

    function terminar(e: TouchEvent) {
      if (!valido) return;
      valido = false;

      const t = e.changedTouches[0];
      if (!t) return;

      const dx = t.clientX - x0;
      const dy = t.clientY - y0;

      if (Date.now() - t0 > MAXIMO_MS) return;
      if (Math.abs(dx) < MINIMO_PX) return;
      // Sin esto, cualquier desplazamiento vertical con algo de inclinación
      // cambiaría de sección a media lectura.
      if (Math.abs(dx) < Math.abs(dy) * DOMINANCIA) return;

      // Dedo a la izquierda → entra la sección de la derecha.
      const destino = neighbour(ruta.current, dx < 0 ? 1 : -1);
      if (destino) router.push(destino);
    }

    nodo.addEventListener("touchstart", empezar, { passive: true });
    nodo.addEventListener("touchend", terminar, { passive: true });
    return () => {
      nodo.removeEventListener("touchstart", empezar);
      nodo.removeEventListener("touchend", terminar);
    };
  }, [router]);

  return (
    <div ref={contenedor} className="contents">
      {children}
    </div>
  );
}
