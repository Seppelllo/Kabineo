"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useAuth } from "@/hooks/use-auth";
import {
  FileText,
  Home,
  Search,
  Settings,
  Shield,
  Upload,
  FolderOpen,
  Star,
  Trash2,
  X,
  Users,
  FileType,
  Wand2,
  HelpCircle,
  BookOpen,
} from "lucide-react";
import { cn } from "@/lib/utils";

const navItems = [
  { href: "/dashboard", label: "Dashboard", icon: Home },
  { href: "/documents", label: "Dokumente", icon: FolderOpen },
  { href: "/documents?favorites=true", label: "Favoriten", icon: Star },
  { href: "/documents/upload", label: "Upload", icon: Upload },
  { href: "/search", label: "Suche", icon: Search },
  { href: "/trash", label: "Papierkorb", icon: Trash2 },
];

const manageItems = [
  { href: "/correspondents", label: "Korrespondenten", icon: Users },
  { href: "/document-types", label: "Dokumenttypen", icon: FileType },
  { href: "/rules", label: "Regeln", icon: Wand2 },
  { href: "/groups", label: "Gruppen", icon: Users },
];

const bottomItems = [
  { href: "/help", label: "Hilfe", icon: HelpCircle },
  { href: "/api-docs", label: "API-Doku", icon: BookOpen },
  { href: "/settings", label: "Einstellungen", icon: Settings },
  { href: "/admin", label: "Administration", icon: Shield, adminOnly: true },
];

interface SidebarProps {
  mobileOpen?: boolean;
  onMobileClose?: () => void;
}

export function Sidebar({ mobileOpen, onMobileClose }: SidebarProps) {
  const pathname = usePathname();
  const { user } = useAuth();
  const isAdmin = user?.role === "admin" || user?.role === "UserRole.admin";

  const isActive = (href: string) => {
    if (href === "/documents?favorites=true") {
      return pathname === "/documents" && typeof window !== "undefined" && window.location.search.includes("favorites=true");
    }
    if (href === "/documents") {
      return pathname === "/documents" && (typeof window === "undefined" || !window.location.search.includes("favorites=true"));
    }
    if (href === "/trash") return pathname === "/trash";
    return pathname === href ||
      (href !== "/documents" && href !== "/dashboard" && pathname.startsWith(href + "/"));
  };

  const sidebarContent = (
    <>
      {/* Logo */}
      <div className="flex h-16 items-center justify-between px-6">
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-sky-400/20 backdrop-blur">
            <FileText className="h-5 w-5 text-sky-300" />
          </div>
          <div>
            <span className="text-[15px] font-bold text-white tracking-tight">Kabineo</span>
            <p className="text-[10px] text-sky-300/70 -mt-0.5">Aktenkabinett</p>
          </div>
        </div>
        {/* Close button for mobile */}
        {onMobileClose && (
          <button
            onClick={onMobileClose}
            className="md:hidden flex h-8 w-8 items-center justify-center rounded-lg hover:bg-sky-500/20 transition-colors cursor-pointer"
          >
            <X className="h-5 w-5 text-sky-200" />
          </button>
        )}
      </div>

      {/* Main nav */}
      <nav className="flex-1 px-3 pt-4 space-y-1">
        <p className="text-[10px] font-semibold uppercase tracking-wider text-sky-300/50 px-3 mb-2">Navigation</p>
        {navItems.map((item) => {
          const active = isActive(item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              onClick={onMobileClose}
              className={cn(
                "flex items-center gap-3 rounded-xl px-3 py-2.5 text-[13px] font-medium transition-all duration-200",
                active
                  ? "bg-sky-500/20 text-white shadow-lg shadow-sky-900/20"
                  : "text-sky-200/70 hover:bg-sky-500/10 hover:text-white",
              )}
            >
              <item.icon className={cn("h-[18px] w-[18px]", active ? "text-sky-300" : "text-sky-300/50")} />
              {item.label}
            </Link>
          );
        })}

        <p className="text-[10px] font-semibold uppercase tracking-wider text-sky-300/50 px-3 mb-2 mt-6">Verwalten</p>
        {manageItems.map((item) => {
          const active = isActive(item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              onClick={onMobileClose}
              className={cn(
                "flex items-center gap-3 rounded-xl px-3 py-2.5 text-[13px] font-medium transition-all duration-200",
                active
                  ? "bg-sky-500/20 text-white shadow-lg shadow-sky-900/20"
                  : "text-sky-200/70 hover:bg-sky-500/10 hover:text-white",
              )}
            >
              <item.icon className={cn("h-[18px] w-[18px]", active ? "text-sky-300" : "text-sky-300/50")} />
              {item.label}
            </Link>
          );
        })}
      </nav>

      {/* Bottom nav */}
      <div className="px-3 pb-4 space-y-1">
        <div className="border-t border-sky-500/20 mb-3" />
        {bottomItems.filter((item) => !(item as any).adminOnly || isAdmin).map((item) => {
          const active = pathname.startsWith(item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              onClick={onMobileClose}
              className={cn(
                "flex items-center gap-3 rounded-xl px-3 py-2.5 text-[13px] font-medium transition-all duration-200",
                active
                  ? "bg-sky-500/20 text-white"
                  : "text-sky-200/70 hover:bg-sky-500/10 hover:text-white",
              )}
            >
              <item.icon className={cn("h-[18px] w-[18px]", active ? "text-sky-300" : "text-sky-300/50")} />
              {item.label}
            </Link>
          );
        })}
        <div className="mt-3 rounded-xl bg-sky-500/10 p-3">
          <p className="text-[11px] text-sky-300/60">Kabineo v0.1.0</p>
          <p className="text-[10px] text-sky-300/40 mt-0.5">Self-Hosted Edition</p>
        </div>
      </div>
    </>
  );

  return (
    <>
      {/* Desktop sidebar */}
      <aside className="hidden md:flex w-[260px] flex-col bg-[#0c4a6e] dark:bg-[#0b1120] text-sky-100">
        {sidebarContent}
      </aside>

      {/* Mobile overlay */}
      {mobileOpen && (
        <>
          <div
            className="fixed inset-0 z-40 bg-black/50 md:hidden"
            onClick={onMobileClose}
          />
          <aside className="fixed inset-y-0 left-0 z-50 w-[260px] flex flex-col bg-[#0c4a6e] dark:bg-[#0b1120] text-sky-100 md:hidden shadow-2xl">
            {sidebarContent}
          </aside>
        </>
      )}
    </>
  );
}
