"use client";

import { useState } from "react";
import DOMPurify from "dompurify";
import { AppShell } from "@/components/layout/app-shell";
import { useSearch, type SearchFilters } from "@/hooks/use-search";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Search, FileText, Sparkles, SlidersHorizontal } from "lucide-react";
import { TagFilter } from "@/components/tags/tag-manager";
import { useCorrespondents } from "@/hooks/use-correspondents";
import { useDocumentTypes } from "@/hooks/use-document-types";
import Link from "next/link";

function formatSize(bytes: number): string {
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

const FILE_TYPE_OPTIONS = [
  { label: "Alle", value: "" },
  { label: "PDF", value: "application/pdf" },
  { label: "Bilder", value: "image/" },
  { label: "Office", value: "application/vnd." },
];

export default function SearchPage() {
  const [query, setQuery] = useState("");
  const [searchTerm, setSearchTerm] = useState("");
  const [filterTagIds, setFilterTagIds] = useState<string[]>([]);
  const [showFilters, setShowFilters] = useState(false);
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [fileType, setFileType] = useState("");
  const [filterCorrespondentId, setFilterCorrespondentId] = useState("");
  const [filterDocumentTypeId, setFilterDocumentTypeId] = useState("");
  const { data: correspondents } = useCorrespondents();
  const { data: documentTypes } = useDocumentTypes();

  const filters: SearchFilters = {
    mimeType: fileType || undefined,
    dateFrom: dateFrom || undefined,
    dateTo: dateTo || undefined,
  };

  const { data, isLoading } = useSearch(searchTerm, filters);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    setSearchTerm(query);
  };

  return (
    <AppShell>
      <div className="max-w-4xl mx-auto space-y-6">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Suche</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Volltextsuche ueber alle Dokumente inkl. OCR-erkanntem Text
          </p>
        </div>

        <form onSubmit={handleSearch}>
          <div className="relative">
            <Search className="absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Suchbegriff eingeben..."
              className="h-14 pl-12 pr-28 text-base border-0 shadow-lg shadow-sky-900/5 bg-white dark:bg-card rounded-2xl"
            />
            <Button
              type="submit"
              disabled={!query}
              className="absolute right-2 top-1/2 -translate-y-1/2 h-10 bg-sky-600 hover:bg-sky-700 rounded-xl shadow-md shadow-sky-600/25 font-semibold"
            >
              <Sparkles className="mr-1.5 h-4 w-4" />
              Suchen
            </Button>
          </div>
        </form>

        {/* Filter toggle */}
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowFilters(!showFilters)}
            className={showFilters ? "bg-sky-50 dark:bg-sky-900/20 border-sky-300 text-sky-700 dark:text-sky-300" : ""}
          >
            <SlidersHorizontal className="mr-1.5 h-4 w-4" />
            Filter
          </Button>
          {(dateFrom || dateTo || fileType || filterCorrespondentId || filterDocumentTypeId) && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => { setDateFrom(""); setDateTo(""); setFileType(""); setFilterCorrespondentId(""); setFilterDocumentTypeId(""); }}
              className="text-muted-foreground text-xs"
            >
              Filter zuruecksetzen
            </Button>
          )}
        </div>

        {/* Filter panel */}
        {showFilters && (
          <Card className="border-0 shadow-md bg-white dark:bg-card">
            <CardContent className="p-5">
              <div className="grid gap-4 sm:grid-cols-3">
                <div>
                  <label className="text-xs font-medium text-muted-foreground mb-1.5 block">Dateityp</label>
                  <select
                    value={fileType}
                    onChange={(e) => setFileType(e.target.value)}
                    className="w-full h-10 rounded-lg border border-border bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                  >
                    {FILE_TYPE_OPTIONS.map((opt) => (
                      <option key={opt.value} value={opt.value}>{opt.label}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="text-xs font-medium text-muted-foreground mb-1.5 block">Datum von</label>
                  <Input
                    type="date"
                    value={dateFrom}
                    onChange={(e) => setDateFrom(e.target.value)}
                    className="h-10"
                  />
                </div>
                <div>
                  <label className="text-xs font-medium text-muted-foreground mb-1.5 block">Datum bis</label>
                  <Input
                    type="date"
                    value={dateTo}
                    onChange={(e) => setDateTo(e.target.value)}
                    className="h-10"
                  />
                </div>
              </div>
              <div className="grid gap-4 sm:grid-cols-2 mt-4">
                <div>
                  <label className="text-xs font-medium text-muted-foreground mb-1.5 block">Korrespondent</label>
                  <select
                    value={filterCorrespondentId}
                    onChange={(e) => setFilterCorrespondentId(e.target.value)}
                    className="w-full h-10 rounded-lg border border-border bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                  >
                    <option value="">Alle</option>
                    {correspondents?.map((c) => (
                      <option key={c.id} value={c.id}>{c.name}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="text-xs font-medium text-muted-foreground mb-1.5 block">Dokumenttyp</label>
                  <select
                    value={filterDocumentTypeId}
                    onChange={(e) => setFilterDocumentTypeId(e.target.value)}
                    className="w-full h-10 rounded-lg border border-border bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                  >
                    <option value="">Alle</option>
                    {documentTypes?.map((dt) => (
                      <option key={dt.id} value={dt.id}>{dt.name}</option>
                    ))}
                  </select>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Tag filter */}
        <TagFilter selectedIds={filterTagIds} onChange={setFilterTagIds} />

        {data && (
          <p className="text-sm font-medium">
            <span className="text-sky-600">{data.total}</span> Ergebnis(se) fuer <span className="font-semibold">&ldquo;{data.query}&rdquo;</span>
          </p>
        )}

        <div className="space-y-3">
          {data?.items.map((item) => (
            <Link key={item.id} href={`/documents/${item.id}`}>
              <Card className="cursor-pointer border-0 shadow-sm hover:shadow-lg hover:-translate-y-0.5 transition-all duration-200 bg-white dark:bg-card mb-3">
                <CardContent className="p-5">
                  <div className="flex items-start gap-4">
                    <div className="rounded-xl bg-sky-50 dark:bg-sky-900/20 p-2.5 mt-0.5">
                      <FileText className="h-5 w-5 text-sky-600" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-3">
                        <h3 className="font-semibold text-[15px]">{item.title}</h3>
                        <Badge className="bg-sky-50 text-sky-700 border-sky-200 shrink-0 text-xs font-semibold">
                          {(item.rank * 100).toFixed(0)}%
                        </Badge>
                      </div>
                      <p className="text-xs text-muted-foreground mt-1">
                        {item.filename} · {formatSize(item.file_size)} · {new Date(item.created_at).toLocaleDateString("de-DE")}
                      </p>
                      {item.snippet && (
                        <div
                          className="text-sm text-muted-foreground mt-2.5 line-clamp-2 [&_mark]:bg-sky-200 [&_mark]:text-sky-900 [&_mark]:px-0.5 [&_mark]:rounded"
                          dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(item.snippet) }}
                        />
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            </Link>
          ))}

          {data && data.items.length === 0 && (
            <div className="text-center py-16">
              <div className="mx-auto w-16 h-16 rounded-3xl bg-slate-100 dark:bg-muted flex items-center justify-center mb-4">
                <Search className="h-8 w-8 text-slate-400" />
              </div>
              <p className="text-lg font-semibold">Keine Ergebnisse</p>
              <p className="text-sm text-muted-foreground mt-1">Versuche einen anderen Suchbegriff</p>
            </div>
          )}

          {!data && !isLoading && (
            <div className="text-center py-16">
              <div className="mx-auto w-16 h-16 rounded-3xl bg-sky-50 dark:bg-sky-900/20 flex items-center justify-center mb-4">
                <Search className="h-8 w-8 text-sky-400" />
              </div>
              <p className="text-lg font-semibold">Durchsuche deine Dokumente</p>
              <p className="text-sm text-muted-foreground mt-1">Gib einen Suchbegriff ein um zu starten</p>
            </div>
          )}
        </div>
      </div>
    </AppShell>
  );
}
