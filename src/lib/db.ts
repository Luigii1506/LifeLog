import { PrismaNeon } from "@prisma/adapter-neon";
import { PrismaClient } from "@/generated/prisma/client";

/**
 * Conexión a Postgres en Neon (ADR-112).
 *
 * Se usa el adaptador serverless de Neon y no `pg` a propósito: en Vercel cada
 * petición puede levantar una instancia nueva, y un pool tradicional agota las
 * conexiones de la base en cuanto hay algo de tráfico. El driver de Neon habla
 * por HTTP y no mantiene conexión abierta.
 */
// Singleton: Next.js recarga módulos en desarrollo y cada recarga crearía un
// cliente nuevo.
const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

/**
 * La integración de Vercel con Neon inyecta la cadena con distintos nombres
 * según la versión. Se aceptan todos: fallar por el nombre de una variable
 * cuando la base está ahí es la peor forma de perder una tarde.
 */
export function connectionString(): string | undefined {
  return (
    process.env.DATABASE_URL ||
    process.env.POSTGRES_URL ||
    process.env.POSTGRES_PRISMA_URL ||
    undefined
  );
}

/**
 * Pista sobre la causa más probable cuando la variable «está» pero no vale.
 *
 * `vercel env pull` escribe `.env.local` con las variables marcadas como
 * Sensitive **en blanco**, y Next carga `.env.local` con más prioridad que
 * `.env`. El resultado es que editas `.env`, ves la variable ahí, y la app
 * insiste en que falta. Sin este aviso el fallo apunta al archivo equivocado.
 */
function pistaSobreEnvLocal(): string {
  if (process.env.NODE_ENV === "production") return "";
  const vacias = ["DATABASE_URL", "POSTGRES_URL", "POSTGRES_PRISMA_URL"].filter(
    (k) => process.env[k] === "",
  );
  if (vacias.length === 0) return "";
  return (
    `\n\nEstá definida pero vacía: ${vacias.join(", ")}. ` +
    "Suele ser `.env.local` de un `vercel env pull`, que devuelve en blanco las " +
    "variables Sensitive y tapa a `.env`. Borra ese archivo o esas líneas."
  );
}

function crearCliente(): PrismaClient {
  const url = connectionString();
  if (!url) {
    throw new Error(
      "Falta DATABASE_URL. En local va en .env; en Vercel, en las variables de entorno del proyecto." +
        pistaSobreEnvLocal(),
    );
  }
  return new PrismaClient({
    adapter: new PrismaNeon({ connectionString: url }),
    log: process.env.NODE_ENV === "development" ? ["warn", "error"] : ["error"],
  });
}

/**
 * El cliente se construye al USARLO, no al importar el módulo.
 *
 * Con construcción en la importación, cualquier archivo que estuviera en la
 * misma cadena de imports explotaba sin DATABASE_URL aunque no tocara la base
 * — pasó con un test de iconos, que es presentación pura.
 */
export const db = new Proxy({} as PrismaClient, {
  get(_objetivo, propiedad, receptor) {
    const cliente =
      globalForPrisma.prisma ??
      (process.env.NODE_ENV === "production"
        ? crearCliente()
        : (globalForPrisma.prisma = crearCliente()));
    const valor = Reflect.get(cliente, propiedad, receptor);
    return typeof valor === "function" ? valor.bind(cliente) : valor;
  },
});
