import { NextResponse, type NextRequest } from "next/server";
import { cookieValida, NOMBRE_COOKIE } from "@/lib/auth/session";

/**
 * Puerta de entrada (ADR-113).
 *
 * Se llama `proxy` y no `middleware`: Next 16 renombró el convenio.
 *
 * Bloquea todo salvo el propio login y los recursos estáticos. Una URL pública
 * que registra peso, gastos, medicación y ubicación no puede estar abierta ni
 * un día — y un despliegue de Vercel es público desde el segundo uno.
 */
export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (pathname.startsWith("/login") || pathname.startsWith("/api/auth")) {
    return NextResponse.next();
  }

  const cookie = request.cookies.get(NOMBRE_COOKIE)?.value;
  if (await cookieValida(cookie)) return NextResponse.next();

  const destino = request.nextUrl.clone();
  destino.pathname = "/login";
  // Se recuerda adónde ibas: tras entrar, sigues donde querías estar.
  destino.searchParams.set("destino", pathname);
  return NextResponse.redirect(destino);
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|manifest.webmanifest|icon).*)"],
};
