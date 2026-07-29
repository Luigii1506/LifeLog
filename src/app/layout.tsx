import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { BottomNav } from "@/components/shell/bottom-nav";
import { TopBar } from "@/components/shell/top-bar";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "LifeLog",
  description: "Capa de captura de LifeOS",
  appleWebApp: { capable: true, title: "LifeLog", statusBarStyle: "default" },
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#fbfaf8" },
    { media: "(prefers-color-scheme: dark)", color: "#14130f" },
  ],
  // Sin zoom: los campos numéricos no deben provocar el zoom de iOS al enfocar.
  maximumScale: 1,
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="es"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="flex min-h-full flex-col">
        {/* La barra inferior es fija: se reserva su alto para que nunca tape
            el último elemento de la página. */}
        <div className="mx-auto w-full max-w-2xl flex-1 px-5 pb-24">
          <TopBar />
          {children}
        </div>
        <BottomNav />
      </body>
    </html>
  );
}
