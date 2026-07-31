"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { deleteNote } from "@/app/notas/actions";
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

  const visibles = grupos
    .map((g) => ({
      ...g,
      notas: filtro ? g.notas.filter((n) => n.tag === filtro) : g.notas,
    }))
    .filter((g) => g.notas.length > 0);

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
                    {/* Tocar la nota la sube al editor de arriba. Editar y
                        escribir usan la misma caja: dos formas de hacer lo
                        mismo serían una de más. */}
                    <button
                      onClick={() => (activa ? onCerrar() : onEditar(n))}
                      className="flex w-full gap-3 p-3.5 text-left"
                    >
                      <span className="shrink-0 text-lg leading-none" aria-hidden>
                        {t?.icon ?? "📝"}
                      </span>
                      <span className="min-w-0 flex-1">
                        {/* `whitespace-pre-line` respeta los saltos: una nota
                            dictada a trozos los lleva, y aplastarlos la
                            convierte en un párrafo ilegible. */}
                        <span className="block text-sm leading-relaxed break-words whitespace-pre-line">
                          {n.text}
                        </span>
                        <span className="mt-1.5 block font-mono text-[11px] tabular-nums text-muted">
                          {new Date(n.at).toLocaleTimeString("es-MX", {
                            hour: "2-digit",
                            minute: "2-digit",
                            hour12: false,
                          })}
                        </span>
                      </span>
                    </button>

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
