import { Bloque, Lista } from "@/components/shell/skeleton";

export default function Cargando() {
  return (
    <main className="space-y-6 py-6">
      <Bloque className="h-8 w-28" />
      <Bloque className="h-28 rounded-2xl" />
      <Lista n={4} />
    </main>
  );
}
