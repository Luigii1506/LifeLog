"use client";

import { useRef, useState } from "react";
import { NoteCapture } from "./note-capture";
import { NoteList, type NotaVista } from "./note-list";

/**
 * La pantalla de notas: capturar arriba, encontrar abajo.
 *
 * Las dos mitades comparten estado porque tocar una nota la sube al editor —el
 * mismo cuadro donde se escribe— en vez de abrir otro sitio donde editar. Que
 * escribir y corregir usen la misma caja es lo que evita aprender dos formas de
 * hacer lo mismo.
 *
 * En un móvil el editor está arriba y la nota puede estar a tres pantallas de
 * scroll, así que al tocarla se sube sola. Sin eso, editar parecería no hacer
 * nada.
 */

export type Edicion = { id: string; text: string; tag: string };

export function NotesScreen({
  grupos,
  conteos,
  total,
}: {
  grupos: { dateKey: string; notas: NotaVista[] }[];
  conteos: Record<string, number>;
  total: number;
}) {
  const [editando, setEditando] = useState<Edicion | null>(null);
  const editor = useRef<HTMLDivElement>(null);

  function editar(n: NotaVista) {
    setEditando({ id: n.id, text: n.text, tag: n.tag });
    // `smooth` y no instantáneo: un salto seco no deja ver que el contenido
    // subió al cuadro de arriba, y parece que la app se reinició.
    editor.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  return (
    <>
      <div ref={editor} className="scroll-mt-16">
        <NoteCapture editando={editando} onCancel={() => setEditando(null)} />
      </div>

      <NoteList
        grupos={grupos}
        conteos={conteos}
        total={total}
        editandoId={editando?.id ?? null}
        onEditar={editar}
        onCerrar={() => setEditando(null)}
      />
    </>
  );
}
