/**
 * Sesión firmada con HMAC (ADR-113).
 *
 * Un solo usuario, así que no hay tabla de usuarios ni proveedor de identidad:
 * una frase que solo tú sabes y una cookie firmada que dura meses.
 *
 * Se usa Web Crypto y no `crypto` de Node porque el middleware corre en el
 * runtime de edge, donde el módulo de Node no existe.
 */

const COOKIE = "lifelog_sesion";
const DURACION_DIAS = 90;

function claveSecreta(): string {
  const secreto = process.env.AUTH_SECRET ?? process.env.AUTH_PASSPHRASE;
  if (!secreto) throw new Error("Falta AUTH_PASSPHRASE en las variables de entorno");
  return secreto;
}

async function firmar(datos: string): Promise<string> {
  const clave = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(claveSecreta()),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const firma = await crypto.subtle.sign(
    "HMAC",
    clave,
    new TextEncoder().encode(datos),
  );
  return Array.from(new Uint8Array(firma))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

/** Comparación en tiempo constante: comparar con === filtra el secreto. */
function igualSeguro(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diferencia = 0;
  for (let i = 0; i < a.length; i++) diferencia |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diferencia === 0;
}

export async function crearCookie(): Promise<{
  name: string;
  value: string;
  options: {
    httpOnly: true;
    secure: boolean;
    sameSite: "lax";
    path: string;
    maxAge: number;
  };
}> {
  const expira = Date.now() + DURACION_DIAS * 86_400_000;
  const carga = String(expira);
  return {
    name: COOKIE,
    value: `${carga}.${await firmar(carga)}`,
    options: {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: DURACION_DIAS * 86_400,
    },
  };
}

export async function cookieValida(valor: string | undefined): Promise<boolean> {
  if (!valor) return false;
  const [carga, firma] = valor.split(".");
  if (!carga || !firma) return false;

  const expira = Number(carga);
  if (!Number.isFinite(expira) || expira < Date.now()) return false;

  return igualSeguro(firma, await firmar(carga));
}

export function passphraseCorrecta(intento: string): boolean {
  const esperada = process.env.AUTH_PASSPHRASE;
  if (!esperada) return false;
  return igualSeguro(intento.trim(), esperada);
}

export const NOMBRE_COOKIE = COOKIE;
