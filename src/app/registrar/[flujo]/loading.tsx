import { Bloque } from "@/components/shell/skeleton";

export default function Cargando() {
  return (
    <main className="py-4">
      <Bloque className="h-1" />
      <Bloque className="mt-6 h-7 w-64" />
      <Bloque className="mt-6 h-14" />
      <div className="mt-2 grid grid-cols-2 gap-2">
        {Array.from({ length: 4 }, (_, i) => (
          <Bloque key={i} className="h-24" />
        ))}
      </div>
    </main>
  );
}
