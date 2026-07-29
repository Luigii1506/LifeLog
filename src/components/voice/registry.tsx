"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

/**
 * Registro de voz: el micrófono es uno solo y la pantalla dice qué hace.
 *
 * Antes había tres mecanismos sin relación —el micro de la barra que solo
 * navegaba, el botón ancho dentro de cada flujo, y el lanzador del home—, así
 * que la respuesta a «¿dónde hablo?» dependía de dónde estuvieras. Con tres
 * sitios distintos, hablar deja de ser un reflejo y se vuelve una decisión.
 *
 * Ahora el botón está siempre en el mismo punto y lo que cambia es el
 * significado. La pantalla activa registra su intérprete; el botón lo usa.
 *
 * Es una PILA, no un solo valor: dentro de un flujo puede haber un paso que
 * registre lo suyo sobre lo que ya registró la pantalla. Al desmontarse se
 * retira y manda el de debajo, sin que nadie tenga que coordinarse.
 */

export type VoiceHandler = (texto: string) => boolean | void;

type Entrada = { id: number; handler: VoiceHandler; hint: string };

type Registro = {
  push: (handler: VoiceHandler, hint: string) => number;
  pop: (id: number) => void;
  /** El intérprete activo y su pista, o null si nadie registró nada. */
  activo: { handler: VoiceHandler; hint: string } | null;
};

const VoiceContext = createContext<Registro | null>(null);

export function VoiceProvider({ children }: { children: React.ReactNode }) {
  const pila = useRef<Entrada[]>([]);
  const siguienteId = useRef(1);
  // Solo la CIMA de la pila provoca re-render. Guardar la pila entera en
  // estado repintaría el botón cada vez que cualquier paso se registra.
  const [cima, setCima] = useState<Entrada | null>(null);

  const sincronizar = useCallback(() => {
    setCima(pila.current.at(-1) ?? null);
  }, []);

  const push = useCallback(
    (handler: VoiceHandler, hint: string) => {
      const id = siguienteId.current++;
      pila.current = [...pila.current, { id, handler, hint }];
      sincronizar();
      return id;
    },
    [sincronizar],
  );

  const pop = useCallback(
    (id: number) => {
      pila.current = pila.current.filter((e) => e.id !== id);
      sincronizar();
    },
    [sincronizar],
  );

  const valor = useMemo<Registro>(
    () => ({
      push,
      pop,
      activo: cima ? { handler: cima.handler, hint: cima.hint } : null,
    }),
    [push, pop, cima],
  );

  return <VoiceContext.Provider value={valor}>{children}</VoiceContext.Provider>;
}

/** Lo usa el botón flotante. Fuera del proveedor no hay registro que leer. */
export function useVoiceRegistry(): Registro | null {
  return useContext(VoiceContext);
}

/**
 * Declara qué hace la voz en esta pantalla.
 *
 * El intérprete se guarda en una referencia, así que puede cerrar sobre el
 * estado más reciente sin volver a registrarse en cada render — registrarse
 * en cada render reconstruiría la pila sesenta veces por segundo.
 *
 * Devolver `false` significa «no lo entendí»: el botón entonces prueba con
 * las órdenes de navegación, que funcionan en todas partes.
 */
export function useVoiceTarget(hint: string, handler: VoiceHandler): void {
  const registro = useVoiceRegistry();
  const actual = useRef(handler);
  actual.current = handler;

  const push = registro?.push;
  const pop = registro?.pop;

  useEffect(() => {
    if (!push || !pop) return;
    const id = push((texto) => actual.current(texto), hint);
    return () => pop(id);
  }, [push, pop, hint]);
}
