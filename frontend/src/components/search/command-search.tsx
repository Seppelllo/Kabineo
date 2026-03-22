"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { Search, FileText, FolderOpen, Tag, X, Loader2 } from "lucide-react";
import { api } from "@/lib/api";
import { useRouter } from "next/navigation";

interface SearchResult {
  id: string;
  title: string;
  mime_type: string;
  created_at: string;
}

interface SearchResponse {
  items: SearchResult[];
  total: number;
}

export function CommandSearch() {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const router = useRouter();
  const debounceRef = useRef<ReturnType<typeof setTimeout>>(undefined);

  // Keyboard shortcut
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        setOpen((prev) => !prev);
      }
      if (e.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);

  useEffect(() => {
    if (open) {
      setTimeout(() => inputRef.current?.focus(), 50);
    } else {
      setQuery("");
      setResults([]);
    }
  }, [open]);

  const doSearch = useCallback(async (q: string) => {
    if (!q.trim()) { setResults([]); return; }
    setLoading(true);
    try {
      const data = await api<SearchResponse>(`/api/search?q=${encodeURIComponent(q)}`);
      setResults(data.items ?? []);
    } catch {
      try {
        const data = await api<SearchResponse>(`/api/documents?page_size=10&q=${encodeURIComponent(q)}`);
        setResults(data.items ?? []);
      } catch {
        setResults([]);
      }
    }
    setLoading(false);
  }, []);

  const handleInput = (val: string) => {
    setQuery(val);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => doSearch(val), 300);
  };

  const handleSelect = (id: string) => {
    setOpen(false);
    router.push(`/documents/${id}`);
  };

  const getTypeIcon = (mime: string) => {
    if (mime.startsWith("image/")) return <FileText className="h-4 w-4 text-violet-500" />;
    if (mime.includes("pdf")) return <FileText className="h-4 w-4 text-red-500" />;
    return <FileText className="h-4 w-4 text-sky-500" />;
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-[15vh]" onClick={() => setOpen(false)}>
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
          {loading && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />}
          <button
            onClick={() => setOpen(false)}
            className="flex h-6 items-center rounded border border-border px-1.5 text-[10px] font-medium text-muted-foreground hover:bg-muted transition-colors cursor-pointer"
          >
            ESC
          </button>
        </div>

        {results.length > 0 && (
          <div className="max-h-80 overflow-auto p-2">
            {results.map((r) => (
              <button
                key={r.id}
                onClick={() => handleSelect(r.id)}
                className="flex items-center gap-3 w-full rounded-lg px-3 py-2.5 text-left text-sm hover:bg-muted transition-colors cursor-pointer"
              >
                {getTypeIcon(r.mime_type)}
                <div className="flex-1 min-w-0">
                  <p className="font-medium truncate">{r.title}</p>
                  <p className="text-[11px] text-muted-foreground">
                    {new Date(r.created_at).toLocaleDateString("de-DE")}
                  </p>
                </div>
              </button>
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
            <p className="text-xs text-muted-foreground">Tippe um Dokumente, Ordner oder Tags zu suchen</p>
          </div>
        )}
      </div>
    </div>
  );
}

export function SearchTrigger({ onClick }: { onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="flex h-9 items-center gap-2 rounded-xl px-3 hover:bg-muted transition-colors cursor-pointer"
      title="Suche (Cmd+K)"
    >
      <Search className="h-[18px] w-[18px] text-muted-foreground" />
      <span className="hidden sm:inline text-sm text-muted-foreground">Suche</span>
      <kbd className="hidden sm:inline-flex h-5 items-center rounded border border-border px-1.5 text-[10px] font-medium text-muted-foreground">
        {"\u2318"}K
      </kbd>
    </button>
  );
}
