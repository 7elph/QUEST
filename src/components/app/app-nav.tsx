"use client";

import Link from "next/link";
import Image from "next/image";
import { signOut, useSession } from "next-auth/react";
import { usePathname } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { NotificationBell } from "@/components/app/notification-bell";
import { navLinkIcons } from "@/lib/quest-icons";

const links = [
  { href: "/home", label: "Home" },
  { href: "/profile", label: "Perfil" },
  { href: "/ranking", label: "Ranking" },
  { href: "/founders", label: "Loja" },
  { href: "/enterprise", label: "Enterprise" },
];

export function AppNav() {
  const { data } = useSession();
  const pathname = usePathname();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  useEffect(() => {
    setMobileMenuOpen(false);
  }, [pathname]);

  const roleLinks = useMemo(() => {
    const extra: Array<{ href: string; label: string }> = [];
    if (data?.user?.role === "PATRON") {
      extra.push({ href: "/create-mission", label: "Criar Missao" });
    }
    if (data?.user?.role === "ADMIN") {
      extra.push({ href: "/admin", label: "Admin" });
    }
    return extra;
  }, [data?.user?.role]);

  const allLinks = [...links, ...roleLinks];

  return (
    <header className="sticky top-0 z-30 border-b border-amber-200/20 bg-slate-950/80 backdrop-blur">
      <div className="mx-auto flex max-w-6xl items-center justify-between px-3 py-2.5 md:px-4 md:py-3">
        <Link href="/home" className="text-base font-semibold tracking-wide text-amber-300 md:text-lg">
          QUEST™
        </Link>

        <nav className="mx-6 hidden flex-1 items-center gap-4 whitespace-nowrap text-sm md:flex">
          {allLinks.map((link) => (
            <Link key={link.href} href={link.href} className="inline-flex items-center gap-1.5 text-amber-50/80 hover:text-amber-200">
              <Image
                src={navLinkIcons[link.href]}
                alt=""
                aria-hidden
                width={14}
                height={14}
                className="h-3.5 w-3.5 object-contain opacity-90"
              />
              {link.label}
            </Link>
          ))}
        </nav>

        <div className="flex items-center gap-2">
          {data?.user ? (
            <>
              <NotificationBell />
              <span className="hidden text-xs text-amber-100/80 xl:inline">
                {data.user.email} ({data.user.role})
              </span>
              <Button variant="ghost" className="hidden md:inline-flex" onClick={() => signOut({ callbackUrl: "/" })}>
                Sair
              </Button>
            </>
          ) : (
            <div className="hidden items-center gap-3 md:flex">
              <Link href="/login" className="text-sm text-amber-200">
                Login
              </Link>
              <Link href="/register" className="text-sm text-amber-200">
                Cadastro
              </Link>
            </div>
          )}

          <button
            type="button"
            className="inline-flex h-9 w-9 items-center justify-center rounded-md border border-amber-200/25 bg-black/25 md:hidden"
            onClick={() => setMobileMenuOpen((prev) => !prev)}
            aria-label="Abrir menu"
            aria-expanded={mobileMenuOpen}
          >
            <span className="sr-only">Menu</span>
            <span className="flex w-4 flex-col gap-1">
              <span className="h-0.5 rounded bg-amber-100" />
              <span className="h-0.5 rounded bg-amber-100" />
              <span className="h-0.5 rounded bg-amber-100" />
            </span>
          </button>
        </div>
      </div>

      {mobileMenuOpen && (
        <div className="border-t border-amber-200/15 bg-slate-950/95 md:hidden">
          <div className="mx-auto max-w-6xl px-3 py-3">
            {data?.user && (
              <p className="mb-3 text-xs text-amber-100/80">
                {data.user.email} ({data.user.role})
              </p>
            )}

            <nav className="grid grid-cols-2 gap-2">
              {allLinks.map((link) => (
                <Link
                  key={`mobile-${link.href}`}
                  href={link.href}
                  className="inline-flex items-center gap-2 rounded-md border border-amber-200/20 bg-black/30 px-3 py-2 text-sm text-amber-100"
                >
                  <Image
                    src={navLinkIcons[link.href]}
                    alt=""
                    aria-hidden
                    width={16}
                    height={16}
                    className="h-4 w-4 object-contain"
                  />
                  {link.label}
                </Link>
              ))}
            </nav>

            {data?.user ? (
              <Button variant="ghost" className="mt-3 w-full" onClick={() => signOut({ callbackUrl: "/" })}>
                Sair
              </Button>
            ) : (
              <div className="mt-3 grid grid-cols-2 gap-2">
                <Link href="/login" className="rounded-md border border-amber-200/20 bg-black/30 px-3 py-2 text-center text-sm text-amber-100">
                  Login
                </Link>
                <Link href="/register" className="rounded-md border border-amber-200/20 bg-black/30 px-3 py-2 text-center text-sm text-amber-100">
                  Cadastro
                </Link>
              </div>
            )}
          </div>
        </div>
      )}
    </header>
  );
}
