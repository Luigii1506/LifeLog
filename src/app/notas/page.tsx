import { NoteCapture } from "@/components/notes/note-capture";
import { NoteList } from "@/components/notes/note-list";
import { agruparPorDia, contarPorEtiqueta, recentNotes } from "@/lib/notes/queries";

export const dynamic = "force-dynamic";

export default async function NotasPage() {
  const notas = await recentNotes(new Date());
  const grupos = agruparPorDia(notas);

  return (
    <main className="space-y-6 py-6">
      <h1 className="text-2xl font-semibold tracking-tight">Notas</h1>

      <NoteCapture />

      <NoteList
        total={notas.length}
        conteos={contarPorEtiqueta(notas)}
        grupos={grupos.map((g) => ({
          dateKey: g.dateKey,
          notas: g.notas.map((n) => ({
            id: n.id,
            text: n.text,
            tag: n.tag,
            at: n.at.toISOString(),
          })),
        }))}
      />
    </main>
  );
}
