/**
 * Agrupa repeticiones seguidas en la línea de tiempo.
 *
 * El agua se registra ocho o diez veces al día, y cada toma era una fila. Un
 * día normal se quedaba en sesenta filas de «Agua» con el entrenamiento, el
 * sueño y las notas enterrados entre ellas — justo lo que uno abre Hoy para
 * ver.
 *
 * Se agrupan solo las SEGUIDAS y CERCANAS. Beber a las 9 y a las 14 son dos
 * momentos del día y deben verse como dos; beber cuatro veces en media hora es
 * uno. Sin la ventana de tiempo, un día entero de agua colapsaría en una línea
 * y se perdería la forma del día.
 *
 * Puro: no toca la base ni React, así que se prueba con datos a mano.
 */

/** Hasta aquí, dos registros del mismo tipo son el mismo momento. */
const VENTANA_MS = 30 * 60 * 1000;

export type Colapsable = {
  id: string;
  kind: string;
  startedAt: Date;
  payload: Record<string, unknown>;
};

export type Grupo<T extends Colapsable> = T & {
  /** Cuántos registros hay dentro. 1 significa que no se agrupó nada. */
  count: number;
  /** Los ids agrupados, por si hay que deshacer alguno. */
  ids: string[];
  /** Suma legible de lo agrupado: «1.2 L», «$450». Null si no aplica. */
  aggregate: string | null;
};

/** «1.2 L» o «750 ml», como el resto de la app. */
function litros(ml: number): string {
  if (ml < 1000) return `${ml} ml`;
  return `${(ml / 1000).toLocaleString("es-MX", { maximumFractionDigits: 1 })} L`;
}

/**
 * Qué suma tiene sentido enseñar por tipo.
 *
 * Solo donde sumar significa algo: cuatro tomas de agua son «1 L», pero cuatro
 * notas no son «4 de nota». Ahí basta el recuento.
 */
function resumir(kind: string, payloads: Record<string, unknown>[]): string | null {
  if (kind === "water.logged") {
    const ml = payloads.reduce((s, p) => s + (typeof p.ml === "number" ? p.ml : 0), 0);
    return ml > 0 ? litros(ml) : null;
  }

  if (kind === "expense.logged") {
    const total = payloads.reduce(
      (s, p) => s + (typeof p.amount === "number" ? p.amount : 0),
      0,
    );
    return total > 0
      ? `$${total.toLocaleString("es-MX", { maximumFractionDigits: 2 })}`
      : null;
  }

  return null;
}

export function colapsarRepetidos<T extends Colapsable>(
  entries: T[],
  ventanaMs: number = VENTANA_MS,
): Grupo<T>[] {
  const salida: Grupo<T>[] = [];
  /**
   * Estado por grupo abierto: los payloads acumulados y el instante del
   * último. Se lleva aparte porque recalcular la suma buscando los ids en la
   * lista original sería cuadrático, y aquí puede llegar un día entero.
   */
  let payloads: Record<string, unknown>[] = [];
  let ultimoInstante = 0;

  for (const e of entries) {
    const abierto = salida.at(-1);
    const mismoMomento =
      abierto !== undefined &&
      abierto.kind === e.kind &&
      // Contra el ÚLTIMO del grupo, no contra el primero: diez tomas cada
      // veinte minutos son una racha, aunque entre la primera y la última
      // pasen tres horas.
      Math.abs(e.startedAt.getTime() - ultimoInstante) <= ventanaMs;

    if (!mismoMomento) {
      payloads = [e.payload];
      ultimoInstante = e.startedAt.getTime();
      salida.push({
        ...e,
        count: 1,
        ids: [e.id],
        aggregate: resumir(e.kind, payloads),
      });
      continue;
    }

    // La HORA que se conserva es la del PRIMERO: es cuando empezó ese momento,
    // y es lo que uno recuerda del día.
    payloads.push(e.payload);
    ultimoInstante = e.startedAt.getTime();
    abierto.count += 1;
    abierto.ids.push(e.id);
    abierto.aggregate = resumir(e.kind, payloads);
  }

  return salida;
}
