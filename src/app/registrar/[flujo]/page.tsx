import { notFound, redirect } from "next/navigation";
import { QuickFlowRunner } from "@/components/quick/quick-flow-runner";
import { buildQuickFlow, type QuickFlowId } from "@/lib/quick/flows";
import { todayEntry } from "@/lib/quick/today-entry";
import { QUICK_FLOWS } from "@/lib/quick/catalog";

export const dynamic = "force-dynamic";

export default async function RegistrarPage({
  params,
}: {
  params: Promise<{ flujo: string }>;
}) {
  const { flujo } = await params;

  // Lo que tiene pantalla propia no pasa por aquí. La ruta vieja sigue viva
  // porque puede estar en un marcador o en el historial, y dejarla escribiría
  // eventos sin nombre real.
  const propia = QUICK_FLOWS.find((f) => f.id === flujo)?.href;
  if (propia) redirect(propia);

  const spec = await buildQuickFlow(flujo as QuickFlowId);
  if (!spec) notFound();

  // Lo ya registrado hoy, si este flujo es de los de una vez al día. Entrar a
  // «Desperté» cuando ya despertaste debe enseñar la hora, no pedirla otra vez.
  const yaHecho = await todayEntry(spec.id, new Date());

  return (
    <main className="py-4">
      <QuickFlowRunner
        flowId={spec.id}
        icon={spec.icon}
        label={spec.label}
        done={spec.done}
        steps={spec.steps}
        existing={yaHecho}
      />
    </main>
  );
}
