import { entrar } from "./actions";

export const dynamic = "force-dynamic";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ destino?: string; error?: string }>;
}) {
  const { destino = "/", error } = await searchParams;

  return (
    <main className="flex min-h-screen flex-col items-center justify-center py-10">
      <div className="w-full max-w-sm space-y-6">
        <div className="text-center">
          <div className="text-5xl">🌅</div>
          <h1 className="mt-3 text-2xl font-semibold tracking-tight">LifeLog</h1>
        </div>

        <form action={entrar.bind(null, destino)} className="space-y-3">
          <input
            autoFocus
            name="passphrase"
            type="password"
            autoComplete="current-password"
            placeholder="Frase de acceso"
            className="w-full rounded-xl border border-line bg-background px-4 py-4 text-lg outline-none focus:border-accent"
          />
          <button
            type="submit"
            className="w-full rounded-xl bg-accent py-4 font-medium text-white transition active:scale-[0.98]"
          >
            Entrar
          </button>
        </form>

        {error && (
          <p role="status" className="text-center text-sm text-accent">
            Frase incorrecta
          </p>
        )}
      </div>
    </main>
  );
}
