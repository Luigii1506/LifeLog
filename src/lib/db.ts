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

function crearCliente(): PrismaClient {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error(
      "Falta DATABASE_URL. En local va en .env; en Vercel, en las variables de entorno del proyecto.",
    );
  }
  return new PrismaClient({
    adapter: new PrismaNeon({ connectionString }),
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
