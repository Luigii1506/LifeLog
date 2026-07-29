import { Bloque } from "@/components/shell/skeleton";

export default function Cargando() {
  return (
    <main className="space-y-4 py-4">
      <div className="grid grid-cols-4 gap-2">
        {Array.from({ length: 4 }, (_, i) => (
          <Bloque key={i} className="h-12" />
        ))}
      </div>
      <Bloque className="h-20" />
      <Bloque className="h-16" />
      <Bloque className="h-16" />
    </main>
  );
}
