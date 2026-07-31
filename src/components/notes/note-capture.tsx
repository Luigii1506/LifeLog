"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { saveNote } from "@/app/notas/actions";
import { useVoiceTarget } from "@/components/voice/registry";
import { ETIQUETAS, ETIQUETA_POR_DEFECTO } from "@/lib/notes/tags";

/**
 * Captura de nota.
 *
 * No es un flujo de preguntas: escribir una idea y clasificarla son la MISMA
 * decisión, y partirla en dos pantallas es lo que hace que la idea se pierda
 * por el camino. Todo cabe en una pantalla — texto, etiqueta, guardar.
 *
 * La etiqueta va DEBAJO del texto, no antes: primero sale la idea, después se
 * decide dónde va. Al revés obligaría a clasificar algo que aún no existe.
 *
 * Y viene una puesta por defecto para que nunca sea un paso obligatorio:
 * capturar no puede depender de acertar la categoría.
 */
export function NoteCapture() {
  const router = useRouter();
  const [texto, setTexto] = useState("");
  const [tag, setTag] = useState(ETIQUETA_POR_DEFECTO);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [guardada, setGuardada] = useState(false);
  const campo = useRef<HTMLTextAreaElement>(null);

  // Dictar AÑADE, no reemplaza: se habla a trozos, y sobrescribir lo dicho
  // antes convertiría cada pausa en una pérdida.
  useVoiceTarget("Dilo y lo escribo", (dicho) => {
    setTexto((prev) => (prev ? `${prev.trimEnd()} ${dicho}` : dicho));
    return true;
  });

  function guardar() {
    if (!texto.trim() || pending) return;
    setError(null);
    startTransition(async () => {
      const zona = Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
      const r = await saveNote(texto, tag, zona);
      if (!r.ok) return setError(r.error);
      setTexto("");
      setGuardada(true);
      window.setTimeout(() => setGuardada(false), 1200);
      campo.current?.focus();
      router.refresh();
    });
  }

  const activa = ETIQUETAS.find((t) => t.id === tag);

  return (
    <div className="space-y-3">
      <div className="relative">
        <textarea
          ref={campo}
          value={texto}
          onChange={(e) => setTexto(e.target.value)}
          onKeyDown={(e) => {
            // Enviar con ⌘/Ctrl+Enter. En el móvil no sirve, pero en el
            // portátil evita ir a buscar el botón con el ratón.
            if ((e.metaKey || e.ctrlKey) && e.key === "Enter") guardar();
          }}
          rows={4}
          placeholder={activa?.hint ?? "Escribe o dicta"}
          className="w-full resize-none rounded-2xl border border-line bg-surface px-4 py-3.5 text-base leading-relaxed outline-none transition focus:border-accent"
        />
        {guardada && (
          <span
            role="status"
            className="animate-[acuse_1200ms_ease-out] pointer-events-none absolute top-3 right-3 text-sm font-medium text-done"
          >
            Guardada
          </span>
        )}
      </div>

      {/* Cuatro caben en una fila del móvil y se eligen sin leer. */}
      <div className="grid grid-cols-4 gap-1.5">
        {ETIQUETAS.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => setTag(t.id)}
            aria-pressed={tag === t.id}
            className={`flex flex-col items-center gap-0.5 rounded-xl border px-1 py-2.5 transition active:scale-[0.96] ${
              tag === t.id
                ? "border-accent bg-accent/10 font-medium"
                : "border-line bg-surface text-muted"
            }`}
          >
            <span className="text-xl leading-none">{t.icon}</span>
            <span className="text-[10px] leading-tight">{t.label}</span>
          </button>
        ))}
      </div>

      <button
        onClick={guardar}
        disabled={pending || !texto.trim()}
        className="w-full rounded-xl bg-accent py-4 font-medium text-white transition active:scale-[0.98] disabled:opacity-40"
      >
        {pending ? "Guardando…" : "Guardar"}
      </button>

      {error && (
        <p role="status" className="text-center text-sm text-accent">
          {error}
        </p>
      )}
    </div>
  );
}
