"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { deleteNote, toggleNoteDone } from "@/app/notas/actions";
import { ETIQUETAS, etiquetaPorId } from "@/lib/notes/tags";

/**
 * Las notas capturadas.
 *
 * Apuntar rápido es la parte fácil; lo que decide si un sistema de captura
 * sirve es poder ENCONTRAR lo apuntado. De ahí las tres cosas de esta lista:
 * filtro por etiqueta, agrupación por día y treinta días de historia — una
 * bandeja que solo enseña hoy obliga a vaciarla cada noche.
 */

export type NotaVista = {
  id: string;
  text: string;
  tag: string;
  at: string;
  /** Cuándo se marcó como hecha. Nulo si sigue pendiente. */
  doneAt: string | null;
  doneEventId: string | null;
};

export function NoteList({
  grupos,
  conteos,
  total,
  editandoId,
  onEditar,
  onCerrar,
}: {
  grupos: { dateKey: string; notas: NotaVista[] }[];
  conteos: Record<string, number>;
  total: number;
  /** Nota que está arriba en el editor. Se marca para no perderla de vista. */
  editandoId: string | null;
  onEditar: (n: NotaVista) => void;
  onCerrar: () => void;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [filtro, setFiltro] = useState<string | null>(null);

  const pendientes = grupos.reduce(
    (n, g) => n + g.notas.filter((x) => !x.doneAt).length,
    0,
  );

  const visibles = grupos
    .map((g) => ({
      ...g,
      notas: g.notas.filter((n) => {
        if (filtro === "__pendientes") return !n.doneAt;
        return filtro ? n.tag === filtro : true;
      }),
    }))
    .filter((g) => g.notas.length > 0);

  function marcar(n: NotaVista) {
    startTransition(async () => {
      const zona = Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
      await toggleNoteDone(n.id, n.doneEventId, zona);
      router.refresh();
    });
  }

  if (total === 0) {
    return (
      <p className="py-10 text-center text-sm text-muted">
        Nada capturado todavía.
      </p>
    );
  }

  return (
    <div className="space-y-4">
      {/* Solo salen las etiquetas que TIENEN algo: un filtro que devuelve cero
          siempre es ruido, y con cuatro chips se nota. */}
      <div className="flex flex-wrap gap-1.5">
        <Chip activo={filtro === null} onClick={() => setFiltro(null)}>
          Todas {total}
        </Chip>
        {/* Lo que queda por hacer es la pregunta más frecuente de una bandeja,
            así que va primero y separado de las etiquetas. */}
        {pendientes > 0 && pendientes < total && (
          <Chip
            activo={filtro === "__pendientes"}
            onClick={() =>
              setFiltro(filtro === "__pendientes" ? null : "__pendientes")
            }
          >
            ○ Pendientes {pendientes}
          </Chip>
        )}
        {ETIQUETAS.filter((t) => (conteos[t.id] ?? 0) > 0).map((t) => (
          <Chip
            key={t.id}
            activo={filtro === t.id}
            onClick={() => setFiltro(filtro === t.id ? null : t.id)}
          >
            {t.icon} {t.label} {conteos[t.id]}
          </Chip>
        ))}
      </div>

      {visibles.length === 0 ? (
        <p className="py-8 text-center text-sm text-muted">
          Nada con esa etiqueta.
        </p>
      ) : (
        visibles.map((grupo) => (
          <section key={grupo.dateKey} className="space-y-2">
            <h2 className="text-xs font-medium tracking-[0.12em] text-muted uppercase">
              {tituloDia(grupo.dateKey)}
            </h2>

            <ul className="space-y-2">
              {grupo.notas.map((n) => {
                const t = etiquetaPorId(n.tag);
                const activa = editandoId === n.id;
                return (
                  <li
                    key={n.id}
                    className={`overflow-hidden rounded-xl border bg-surface transition ${
                      activa ? "border-accent" : "border-line"
                    }`}
                  >
                    <div className="flex items-start">
                      {/* La casilla es un botón APARTE del texto: si el mismo
                          toque marcara y editara, cada vez que quisieras tachar
                          algo se te abriría el editor. Grande, que se pulsa de
                          pasada y con una mano. */}
                      <button
                        onClick={() => marcar(n)}
                        disabled={pending}
                        aria-pressed={Boolean(n.doneAt)}
                        aria-label={n.doneAt ? "Marcar como pendiente" : "Marcar como hecha"}
                        className="flex shrink-0 items-center justify-center self-stretch pt-3.5 pr-1 pl-3.5 disabled:opacity-50"
                      >
                        <span
                          className={`flex size-6 items-center justify-center rounded-full border text-[13px] font-bold transition ${
                            n.doneAt
                              ? "border-done bg-done text-white"
                              : "border-line text-transparent"
                          }`}
                        >
                          ✓
                        </span>
                      </button>

                      {/* Tocar la nota la sube al editor de arriba. Editar y
                          escribir usan la misma caja: dos formas de hacer lo
                          mismo serían una de más. */}
                      <button
                        onClick={() => (activa ? onCerrar() : onEditar(n))}
                        className="flex min-w-0 flex-1 gap-2.5 py-3.5 pr-3.5 pl-2 text-left"
                      >
                        <span className="shrink-0 text-lg leading-none" aria-hidden>
                          {t?.icon ?? "📝"}
                        </span>
                        <span className="min-w-0 flex-1">
                          {/* `whitespace-pre-line` respeta los saltos: una nota
                              dictada a trozos los lleva, y aplastarlos la
                              convierte en un párrafo ilegible. */}
                          <span
                            className={`block text-sm leading-relaxed break-words whitespace-pre-line ${
                              n.doneAt ? "text-muted line-through" : ""
                            }`}
                          >
                            {n.text}
                          </span>
                          <span className="mt-1.5 block font-mono text-[11px] tabular-nums text-muted">
                            {hora(n.at)}
                            {n.doneAt && (
                              <span className="text-done"> · hecha {hora(n.doneAt)}</span>
                            )}
                          </span>
                        </span>
                      </button>
                    </div>

                    {/* Solo borrar. El texto y la etiqueta se cambian arriba,
                        en el mismo cuadro donde se escriben. */}
                    {activa && (
                      <button
                        disabled={pending}
                        onClick={() =>
                          startTransition(async () => {
                            await deleteNote(n.id);
                            onCerrar();
                            router.refresh();
                          })
                        }
                        className="w-full border-t border-line py-3 text-xs text-muted transition active:scale-[0.99] disabled:opacity-50"
                      >
                        Borrar
                      </button>
                    )}
                  </li>
                );
              })}
            </ul>
          </section>
        ))
      )}
    </div>
  );
}

function Chip({
  activo,
  onClick,
  children,
}: {
  activo: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      aria-pressed={activo}
      className={`rounded-full border px-3 py-1.5 text-xs whitespace-nowrap transition active:scale-95 ${
        activo ? "border-accent bg-accent/10 font-medium" : "border-line text-muted"
      }`}
    >
      {children}
    </button>
  );
}

function hora(iso: string): string {
  return new Date(iso).toLocaleTimeString("es-MX", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
}

/** «Hoy», «Ayer», o la fecha. Contar días es más rápido que leer una fecha. */
function tituloDia(dateKey: string): string {
  const hoy = new Date();
  const clave = (d: Date) =>
    `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(
      d.getDate(),
    ).padStart(2, "0")}`;

  if (dateKey === clave(hoy)) return "Hoy";
  const ayer = new Date(hoy);
  ayer.setDate(ayer.getDate() - 1);
  if (dateKey === clave(ayer)) return "Ayer";

  const [y, m, d] = dateKey.split("-").map(Number);
  return new Date(y, m - 1, d).toLocaleDateString("es-MX", {
    weekday: "long",
    day: "numeric",
    month: "long",
  });
}
