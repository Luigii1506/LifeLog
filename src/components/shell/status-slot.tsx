"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";

/**
 * Estado en curso, en la barra superior.
 *
 * El problema que resuelve: un entrenamiento abierto tiene que verse desde
 * cualquier pantalla, y la primera versión lo puso en una barra flotante abajo.
 * Ahí competía con el botón de voz y con la navegación — tres capas fijas
 * peleando por la zona del pulgar.
 *
 * El error era de concepto: una sesión en curso es ESTADO, no acción. El
 * estado va arriba, donde uno mira para enterarse; abajo se actúa. Es lo que
 * hacen la llamada en curso de iOS o el reproductor de Spotify.
 *
 * Y como la barra superior ya existe, esto no añade una cuarta capa fija: el
 * título deja su sitio al estado mientras haya algo corriendo.
 *
 * Sirve para cualquier cosa abierta, no solo el gimnasio: una comida a medias
 * tiene exactamente la misma forma.
 */

export type TopStatus = {
  /** Se pinta con el punto latiendo delante. */
  label: React.ReactNode;
  /** Qué pasa al tocarlo. Sin esto es solo informativo. */
  onTap?: () => void;
  /** Marca algo que probablemente se quedó olvidado. */
  warn?: boolean;
};

type Registro = {
  status: TopStatus | null;
  set: (s: TopStatus | null) => void;
};

const StatusContext = createContext<Registro | null>(null);

export function StatusProvider({ children }: { children: React.ReactNode }) {
  const [status, setStatus] = useState<TopStatus | null>(null);
  const set = useCallback((s: TopStatus | null) => setStatus(s), []);
  const valor = useMemo(() => ({ status, set }), [status, set]);
  return <StatusContext.Provider value={valor}>{children}</StatusContext.Provider>;
}

/** Lo lee la barra superior. */
export function useTopStatus(): TopStatus | null {
  return useContext(StatusContext)?.status ?? null;
}

/**
 * Publica el estado desde una pantalla.
 *
 * Se pasa deshecho en piezas primitivas —y no el objeto— a propósito: un objeto
 * literal cambia de identidad en cada render y volvería a publicar sesenta
 * veces por segundo.
 */
export function usePublishStatus(
  label: React.ReactNode,
  onTap?: () => void,
  warn?: boolean,
): void {
  const registro = useContext(StatusContext);
  const set = registro?.set;

  // Publicar y limpiar van en efectos SEPARADOS a propósito.
  //
  // Con uno solo, cada cambio del texto —el reloj se refresca cada quince
  // segundos— ejecutaba la limpieza antes de volver a publicar, y en ese hueco
  // el estado quedaba en null. La barra superior enseñaba el título durante un
  // fotograma y volvía a la píldora: un parpadeo cada quince segundos.
  useEffect(() => {
    set?.({ label, onTap, warn });
  }, [set, label, onTap, warn]);

  useEffect(() => {
    return () => set?.(null);
  }, [set]);
}
