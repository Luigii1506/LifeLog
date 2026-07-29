"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { crearCookie, passphraseCorrecta } from "@/lib/auth/session";

export async function entrar(destino: string, formData: FormData) {
  const intento = String(formData.get("passphrase") ?? "");

  if (!passphraseCorrecta(intento)) {
    // Sin detalle de por qué falló: decir «la frase es correcta pero…» o
    // distinguir vacío de incorrecto solo ayuda a quien está probando.
    redirect(`/login?error=1&destino=${encodeURIComponent(destino)}`);
  }

  const cookie = await crearCookie();
  (await cookies()).set(cookie.name, cookie.value, cookie.options);
  redirect(destino.startsWith("/") ? destino : "/");
}
