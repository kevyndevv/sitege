"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const LINKS = [
  { href: "/admin", label: "Painel", exact: true },
  { href: "/admin/pedidos", label: "Pedidos" },
  { href: "/admin/produtos", label: "Produtos" },
  { href: "/admin/configuracoes", label: "Configurações" },
];

export function AdminNav() {
  const pathname = usePathname();
  return (
    <nav aria-label="Painel" className="-mx-4 overflow-x-auto px-4 sm:mx-0 sm:px-0">
      <ul className="flex w-max gap-1">
        {LINKS.map((link) => {
          const active = link.exact ? pathname === link.href : pathname.startsWith(link.href);
          return (
            <li key={link.href}>
              <Link
                href={link.href}
                aria-current={active ? "page" : undefined}
                className={`inline-flex h-11 items-center rounded-full px-4 font-bold transition-colors ${
                  active ? "bg-white text-[#5b4a53]" : "text-white/90 hover:bg-white/10"
                }`}
              >
                {link.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
