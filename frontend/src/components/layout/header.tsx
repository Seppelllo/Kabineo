"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { useAuth } from "@/hooks/use-auth";
import { useTheme } from "@/hooks/use-theme";
import { useUnreadCount, useNotifications, useMarkRead, useMarkAllRead, type Notification } from "@/hooks/use-notifications";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { LogOut, Settings, ChevronDown, Bell, Sun, Moon, Menu, Search, FileText, Keyboard, Users, UserPlus, UserMinus, CheckCircle, XCircle, Mail } from "lucide-react";
import type { User } from "@/lib/auth";
import Link from "next/link";
import { api } from "@/lib/api";

interface HeaderProps {
  user: User;
  onMenuToggle?: () => void;
  onShowShortcuts?: () => void;
}

interface DocItem {
  id: string;
  title: string;
  created_at: string;
}

interface DocListResponse {
  items: DocItem[];
  total: number;
}

const notifIcons: Record<string, typeof Users> = {
  group_added: UserPlus,
  group_removed: UserMinus,
  join_request: Mail,
  join_approved: CheckCircle,
  join_denied: XCircle,
};

export function Header({ user, onMenuToggle, onShowShortcuts }: HeaderProps) {
  const { logout } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const [searchOpen, setSearchOpen] = useState(false);

  // Notification state
  const [notifOpen, setNotifOpen] = useState(false);
  const notifRef = useRef<HTMLDivElement>(null);

  const { data: unreadData } = useUnreadCount();
  const { data: notifications, refetch: refetchNotifs } = useNotifications();
  const markRead = useMarkRead();
  const markAllRead = useMarkAllRead();

  const unreadCount = unreadData?.count ?? 0;

  // Close notif dropdown on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (notifRef.current && !notifRef.current.contains(e.target as Node)) {
        setNotifOpen(false);
      }
    };
    if (notifOpen) document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [notifOpen]);

  // Open search with Cmd+K
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        setSearchOpen(true);
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);

  const initials = user.full_name
    ? user.full_name.split(" ").map((n) => n[0]).join("").toUpperCase()
    : user.username[0].toUpperCase();

  return (
    <>
      <header className="flex h-16 items-center justify-between border-b border-border/50 bg-white/80 dark:bg-card/80 backdrop-blur-md px-6 relative z-[60]">
        <div className="flex items-center gap-3">
          {/* Mobile hamburger */}
          {onMenuToggle && (
            <button
              onClick={onMenuToggle}
              className="flex md:hidden h-9 w-9 items-center justify-center rounded-xl hover:bg-muted transition-colors cursor-pointer"
            >
              <Menu className="h-5 w-5 text-foreground" />
            </button>
          )}
          <h2 className="text-sm font-medium text-muted-foreground">
            Willkommen, <span className="text-foreground font-semibold">{user.full_name || user.username}</span>
          </h2>
        </div>
        <div className="flex items-center gap-3">
          {/* Search trigger */}
          <button
            onClick={() => setSearchOpen(true)}
            className="flex h-9 items-center gap-2 rounded-xl px-3 hover:bg-muted transition-colors cursor-pointer"
            title="Suche (Cmd+K)"
          >
            <Search className="h-[18px] w-[18px] text-muted-foreground" />
            <span className="hidden sm:inline text-sm text-muted-foreground">Suche</span>
            <kbd className="hidden sm:inline-flex h-5 items-center rounded border border-border px-1.5 text-[10px] font-medium text-muted-foreground">
              {"\u2318"}K
            </kbd>
          </button>

          {/* Dark mode toggle */}
          <button
            onClick={toggleTheme}
            className="flex h-9 w-9 items-center justify-center rounded-xl hover:bg-muted transition-colors cursor-pointer"
            title={theme === "dark" ? "Hellmodus" : "Dunkelmodus"}
          >
            {theme === "dark" ? (
              <Sun className="h-[18px] w-[18px] text-muted-foreground" />
            ) : (
              <Moon className="h-[18px] w-[18px] text-muted-foreground" />
            )}
          </button>

          {/* Keyboard shortcuts */}
          <button
            onClick={onShowShortcuts}
            className="flex h-9 w-9 items-center justify-center rounded-xl hover:bg-muted transition-colors cursor-pointer"
            title="Tastenkuerzel (?)"
          >
            <Keyboard className="h-[18px] w-[18px] text-muted-foreground" />
          </button>

          {/* Notification bell */}
          <div className="relative" ref={notifRef}>
            <button
              onClick={() => { if (!notifOpen) refetchNotifs(); setNotifOpen(!notifOpen); }}
              className="flex h-9 w-9 items-center justify-center rounded-xl hover:bg-muted transition-colors cursor-pointer relative"
            >
              <Bell className="h-[18px] w-[18px] text-muted-foreground" />
              {unreadCount > 0 && (
                <span className="absolute -top-0.5 -right-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-bold text-white ring-2 ring-white dark:ring-card">
                  {unreadCount > 99 ? "99+" : unreadCount}
                </span>
              )}
            </button>
            {notifOpen && (
              <div className="absolute right-0 top-full mt-2 w-80 rounded-xl border border-border bg-white dark:bg-slate-900 shadow-xl z-[100] overflow-hidden">
                <div className="px-4 py-3 border-b border-border/50 flex items-center justify-between">
                  <p className="text-sm font-semibold">Benachrichtigungen</p>
                  {unreadCount > 0 && (
                    <button
                      onClick={() => markAllRead.mutate()}
                      className="text-[11px] text-sky-600 hover:text-sky-700 font-medium cursor-pointer"
                    >
                      Alle als gelesen markieren
                    </button>
                  )}
                </div>
                <div className="max-h-72 overflow-auto">
                  {Array.isArray(notifications) && notifications.length > 0 ? notifications.map((n) => {
                    const Icon = notifIcons[n.type] || Bell;
                    return (
                      <button
                        key={n.id}
                        onClick={() => {
                          if (!n.read) markRead.mutate(n.id);
                          if (n.link) window.location.href = n.link;
                          setNotifOpen(false);
                        }}
                        className={`flex items-start gap-3 px-4 py-2.5 hover:bg-muted transition-colors text-left w-full ${!n.read ? "bg-sky-50/50 dark:bg-sky-900/10" : ""}`}
                      >
                        <Icon className={`h-4 w-4 shrink-0 mt-0.5 ${!n.read ? "text-sky-500" : "text-muted-foreground"}`} />
                        <div className="flex-1 min-w-0">
                          <p className={`text-sm truncate ${!n.read ? "font-semibold" : "font-medium"}`}>{n.title}</p>
                          <p className="text-xs text-muted-foreground truncate">{n.message}</p>
                          <p className="text-[10px] text-muted-foreground mt-0.5">
                            {new Date(n.created_at).toLocaleString("de-DE", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" })}
                          </p>
                        </div>
                        {!n.read && <span className="h-2 w-2 rounded-full bg-sky-500 shrink-0 mt-1.5" />}
                      </button>
                    );
                  }) : (
                    <div className="px-4 py-6 text-center">
                      <Bell className="h-6 w-6 text-muted-foreground/30 mx-auto mb-2" />
                      <p className="text-sm text-muted-foreground">Keine Benachrichtigungen</p>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>

          <DropdownMenu>
            <DropdownMenuTrigger className="flex items-center gap-2.5 rounded-xl px-2 py-1.5 hover:bg-muted transition-colors outline-none cursor-pointer">
              <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-gradient-to-br from-sky-500 to-blue-600 text-white text-xs font-bold shadow-md shadow-sky-500/25">
                {initials}
              </div>
              <div className="hidden sm:block text-left">
                <p className="text-sm font-medium leading-tight">{user.full_name || user.username}</p>
                <p className="text-[11px] text-muted-foreground leading-tight">{user.role}</p>
              </div>
              <ChevronDown className="h-3.5 w-3.5 text-muted-foreground hidden sm:block" />
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" sideOffset={8}>
              <div className="px-3 py-2.5">
                <p className="text-sm font-semibold">{user.full_name || user.username}</p>
                <p className="text-xs text-muted-foreground">{user.email}</p>
              </div>
              <DropdownMenuSeparator />
              <DropdownMenuItem>
                <Link href="/settings" className="flex items-center gap-2 w-full">
                  <Settings className="h-4 w-4" />
                  Einstellungen
                </Link>
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={logout} className="text-destructive">
                <LogOut className="h-4 w-4" />
                Abmelden
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </header>

      {/* Global command search overlay */}
      {searchOpen && <CommandSearchOverlay onClose={() => setSearchOpen(false)} />}
    </>
  );
}

function CommandSearchOverlay({ onClose }: { onClose: () => void }) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<DocItem[]>([]);
  const [loading, setLoading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout>>(undefined);

  useEffect(() => {
    setTimeout(() => inputRef.current?.focus(), 50);
    const handler = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [onClose]);

  const doSearch = useCallback(async (q: string) => {
    if (!q.trim()) { setResults([]); return; }
    setLoading(true);
    try {
      const data = await api<DocListResponse>(`/api/search?q=${encodeURIComponent(q)}`);
      setResults(data.items ?? []);
    } catch {
      try {
        const data = await api<DocListResponse>(`/api/documents?page_size=10&q=${encodeURIComponent(q)}`);
        setResults(data.items ?? []);
      } catch { setResults([]); }
    }
    setLoading(false);
  }, []);

  const handleInput = (val: string) => {
    setQuery(val);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => doSearch(val), 300);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-[15vh]" onClick={onClose}>
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" />
      <div
        className="relative w-full max-w-lg rounded-2xl bg-white dark:bg-slate-900 shadow-2xl border border-border/50 overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center gap-3 px-4 py-3 border-b border-border/50">
          <Search className="h-5 w-5 text-muted-foreground shrink-0" />
          <input
            ref={inputRef}
            value={query}
            onChange={(e) => handleInput(e.target.value)}
            placeholder="Dokumente suchen..."
            className="flex-1 bg-transparent outline-none text-sm placeholder:text-muted-foreground"
          />
          {loading && <div className="h-4 w-4 animate-spin rounded-full border-2 border-sky-500 border-t-transparent" />}
          <button
            onClick={onClose}
            className="flex h-6 items-center rounded border border-border px-1.5 text-[10px] font-medium text-muted-foreground hover:bg-muted transition-colors cursor-pointer"
          >
            ESC
          </button>
        </div>
        {results.length > 0 && (
          <div className="max-h-80 overflow-auto p-2">
            {results.map((r) => (
              <Link
                key={r.id}
                href={`/documents/${r.id}`}
                onClick={onClose}
                className="flex items-center gap-3 w-full rounded-lg px-3 py-2.5 text-left text-sm hover:bg-muted transition-colors"
              >
                <FileText className="h-4 w-4 text-sky-500 shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="font-medium truncate">{r.title}</p>
                  <p className="text-[11px] text-muted-foreground">
                    {new Date(r.created_at).toLocaleDateString("de-DE")}
                  </p>
                </div>
              </Link>
            ))}
          </div>
        )}
        {query && !loading && results.length === 0 && (
          <div className="p-8 text-center">
            <Search className="h-8 w-8 text-muted-foreground/50 mx-auto mb-2" />
            <p className="text-sm text-muted-foreground">Keine Ergebnisse gefunden</p>
          </div>
        )}
        {!query && (
          <div className="p-6 text-center">
            <p className="text-xs text-muted-foreground">Tippe um Dokumente zu suchen</p>
          </div>
        )}
      </div>
    </div>
  );
}
