import type { Metadata } from "next";
import localFont from "next/font/local";
import "./globals.css";
import { Providers } from "@/components/app/providers";
import { AppNav } from "@/components/app/app-nav";
import { RouteFrame } from "@/components/app/route-frame";

const geistSans = localFont({
  src: "./fonts/GeistVF.woff",
  variable: "--font-geist-sans",
  weight: "100 900",
});
const geistMono = localFont({
  src: "./fonts/GeistMonoVF.woff",
  variable: "--font-geist-mono",
  weight: "100 900",
});

export const metadata: Metadata = {
  title: "QUEST™",
  description: "iFood dos trabalhos em modo RPG",
  icons: {
    icon: [
      { url: "/assets/quest_icon.png", type: "image/png", sizes: "512x512" },
      { url: "/favicon.ico", sizes: "any" },
    ],
    shortcut: "/assets/quest_icon.png",
    apple: "/assets/quest_icon.png",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="pt-BR">
      <body
        className={`${geistSans.variable} ${geistMono.variable} bg-[radial-gradient(circle_at_top,_#3d2d14_0,_#0b1220_45%,_#06090f_100%)] text-amber-50 antialiased`}
      >
        <Providers>
          <AppNav />
          <main className="mx-auto min-h-[calc(100vh-56px)] w-full max-w-6xl px-3 py-4 md:min-h-[calc(100vh-64px)] md:px-4 md:py-8">
            <RouteFrame>{children}</RouteFrame>
          </main>
        </Providers>
      </body>
    </html>
  );
}
