import { notFound } from "next/navigation";
import { QuickFlowRunner } from "@/components/quick/quick-flow-runner";
import { buildQuickFlow, type QuickFlowId } from "@/lib/quick/flows";
import { todayEntry } from "@/lib/quick/today-entry";

export const dynamic = "force-dynamic";

export default async function RegistrarPage({
  params,
}: {
  params: Promise<{ flujo: string }>;
}) {
  const { flujo } = await params;
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
