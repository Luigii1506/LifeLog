/**
 * Esqueletos de carga.
 *
 * Next los pinta al instante mientras la vista real se transmite. Sin esto,
 * tocar un enlace deja la pantalla congelada hasta que terminan todas las
 * consultas —medido: entre 300 ms y 4 s— y eso es lo que se siente como
 * lentitud, más que el tiempo en sí.
 *
 * La forma imita la de la vista real para que al llegar el contenido no salte
 * nada de sitio.
 */
export function Bloque({ className = "" }: { className?: string }) {
  return <div className={`animate-pulse rounded-xl bg-line ${className}`} />;
}

export function RejillaTarjetas({ filas = 3, columnas = 3 }: { filas?: number; columnas?: number }) {
  return (
    <div className={`grid gap-2 ${columnas === 2 ? "grid-cols-2" : "grid-cols-3"}`}>
      {Array.from({ length: filas * columnas }, (_, i) => (
        <Bloque key={i} className={columnas === 2 ? "h-24" : "h-20"} />
      ))}
    </div>
  );
}

export function Lista({ n = 4 }: { n?: number }) {
  return (
    <div className="space-y-2">
      {Array.from({ length: n }, (_, i) => (
        <Bloque key={i} className="h-20" />
      ))}
    </div>
  );
}
