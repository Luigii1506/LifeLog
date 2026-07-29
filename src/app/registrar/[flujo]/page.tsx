import Link from "next/link";
import { notFound } from "next/navigation";
import { QuickFlowRunner } from "@/components/quick/quick-flow-runner";
import { buildQuickFlow, type QuickFlowId } from "@/lib/quick/flows";

export const dynamic = "force-dynamic";

export default async function RegistrarPage({
  params,
}: {
  params: Promise<{ flujo: string }>;
}) {
  const { flujo } = await params;
  const spec = await buildQuickFlow(flujo as QuickFlowId);
  if (!spec) notFound();

  return (
    <main className="mx-auto min-h-screen w-full max-w-2xl px-5 py-8">
      <header className="mb-4 flex items-baseline justify-between">
        <span className="text-sm font-medium tracking-[0.12em] text-muted uppercase">
          {spec.icon} {spec.label}
        </span>
        <Link href="/" className="text-sm text-muted hover:text-foreground">
          Cancelar
        </Link>
      </header>

      <QuickFlowRunner
        flowId={spec.id}
        label={spec.label}
        icon={spec.icon}
        done={spec.done}
        steps={spec.steps}
      />
    </main>
  );
}
