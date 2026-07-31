import { Bloque } from "@/components/shell/skeleton";

export default function Cargando() {
  return (
    <main className="py-6">
      <Bloque className="mb-6 h-8 w-24" />
      <Bloque className="mx-auto size-56 rounded-full" />
      <div className="mt-6 grid grid-cols-2 gap-2.5">
        {[0, 1, 2, 3].map((i) => (
          <Bloque key={i} className="h-28 rounded-2xl" />
        ))}
      </div>
    </main>
  );
}
