"use client";

import { AppShell } from "@/components/layout/app-shell";
import { DocumentGrid } from "@/components/documents/document-grid";
import { useDocuments } from "@/hooks/use-documents";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { FileText, HardDrive, Upload, ArrowRight, Clock, Plus, Eye, Trash2, Edit } from "lucide-react";
import Link from "next/link";
import { Skeleton } from "@/components/ui/skeleton";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";

interface AuditLog {
  id: string;
  action: string;
  user_email?: string;
  username?: string;
  resource_type?: string;
  resource_id?: string;
  details?: string;
  created_at: string;
}

interface AuditLogResponse {
  items: AuditLog[];
  total: number;
}

function useActivityTimeline() {
  return useQuery<AuditLogResponse>({
    queryKey: ["audit-logs-timeline"],
    queryFn: async () => {
      try {
        return await api<AuditLogResponse>("/api/admin/audit-logs?page_size=10");
      } catch {
        return { items: [], total: 0 };
      }
    },
  });
}

const actionConfig: Record<string, { icon: typeof Plus; color: string; bg: string; label: string }> = {
  create: { icon: Plus, color: "text-emerald-600", bg: "bg-emerald-100 dark:bg-emerald-900/30", label: "Erstellt" },
  upload: { icon: Upload, color: "text-sky-600", bg: "bg-sky-100 dark:bg-sky-900/30", label: "Hochgeladen" },
  view: { icon: Eye, color: "text-violet-600", bg: "bg-violet-100 dark:bg-violet-900/30", label: "Angesehen" },
  delete: { icon: Trash2, color: "text-red-600", bg: "bg-red-100 dark:bg-red-900/30", label: "Geloescht" },
  update: { icon: Edit, color: "text-amber-600", bg: "bg-amber-100 dark:bg-amber-900/30", label: "Bearbeitet" },
};

function getActionConfig(action: string) {
  const key = Object.keys(actionConfig).find((k) => action.toLowerCase().includes(k));
  return actionConfig[key || "create"] || actionConfig.create;
}

export default function DashboardPage() {
  const { data, isLoading } = useDocuments(undefined, 1);
  const { data: timeline, isLoading: timelineLoading } = useActivityTimeline();
  const totalSize = data?.items ? data.items.reduce((sum, d) => sum + d.file_size, 0) : 0;

  return (
    <AppShell>
      <div className="space-y-8">
        <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-sky-600 via-blue-600 to-indigo-700 p-8 text-white shadow-xl shadow-sky-900/20">
          <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNjAiIGhlaWdodD0iNjAiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+PGRlZnM+PHBhdHRlcm4gaWQ9ImdyaWQiIHdpZHRoPSI2MCIgaGVpZ2h0PSI2MCIgcGF0dGVyblVuaXRzPSJ1c2VyU3BhY2VPblVzZSI+PHBhdGggZD0iTSA2MCAwIEwgMCAwIDAgNjAiIGZpbGw9Im5vbmUiIHN0cm9rZT0icmdiYSgyNTUsMjU1LDI1NSwwLjA1KSIgc3Ryb2tlLXdpZHRoPSIxIi8+PC9wYXR0ZXJuPjwvZGVmcz48cmVjdCBmaWxsPSJ1cmwoI2dyaWQpIiB3aWR0aD0iMTAwJSIgaGVpZ2h0PSIxMDAlIi8+PC9zdmc+')] opacity-50" />
          <div className="relative flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold tracking-tight">Dashboard</h1>
              <p className="text-sky-100/80 mt-1 max-w-md">Verwalte deine Dokumente, durchsuche Inhalte und teile Dateien sicher.</p>
            </div>
            <Link href="/documents/upload"><Button size="lg" className="bg-white text-sky-700 hover:bg-sky-50 shadow-lg font-semibold"><Upload className="mr-2 h-4 w-4" />Hochladen</Button></Link>
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-3">
          <Card className="border-0 shadow-md shadow-sky-900/5 bg-white dark:bg-card"><CardContent className="p-5"><div className="flex items-center gap-4"><div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-sky-50 dark:bg-sky-900/20"><FileText className="h-6 w-6 text-sky-600" /></div><div><p className="text-2xl font-bold text-sky-700 dark:text-sky-400">{data?.total ?? "0"}</p><p className="text-xs font-medium text-muted-foreground">Dokumente gesamt</p></div></div></CardContent></Card>
          <Card className="border-0 shadow-md shadow-sky-900/5 bg-white dark:bg-card"><CardContent className="p-5"><div className="flex items-center gap-4"><div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-emerald-50 dark:bg-emerald-900/20"><HardDrive className="h-6 w-6 text-emerald-600" /></div><div><p className="text-2xl font-bold text-emerald-700 dark:text-emerald-400">{totalSize > 0 ? (totalSize / 1024 / 1024).toFixed(1) + " MB" : "0 MB"}</p><p className="text-xs font-medium text-muted-foreground">Speicher belegt</p></div></div></CardContent></Card>
          <Card className="border-0 shadow-md shadow-sky-900/5 bg-white dark:bg-card"><CardContent className="p-5"><div className="flex items-center gap-4"><div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-violet-50 dark:bg-violet-900/20"><Clock className="h-6 w-6 text-violet-600" /></div><div><p className="text-2xl font-bold text-violet-700 dark:text-violet-400">{timeline?.total ?? data?.items.length ?? "0"}</p><p className="text-xs font-medium text-muted-foreground">Letzte Aktivitaeten</p></div></div></CardContent></Card>
        </div>

        {/* Activity Timeline */}
        {timeline && timeline.items.length > 0 && (
          <div>
            <div className="flex items-center justify-between mb-5">
              <div><h2 className="text-lg font-bold tracking-tight">Aktivitaeten</h2><p className="text-sm text-muted-foreground">Letzte Aenderungen im System</p></div>
            </div>
            <Card className="border-0 shadow-md bg-white dark:bg-card">
              <CardContent className="p-5">
                <div className="relative">
                  <div className="absolute left-[15px] top-2 bottom-2 w-0.5 bg-slate-200 dark:bg-slate-700" />
                  <div className="space-y-4">
                    {timeline.items.map((log) => {
                      const cfg = getActionConfig(log.action);
                      const Icon = cfg.icon;
                      return (
                        <div key={log.id} className="flex gap-4 relative">
                          <div className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full ${cfg.bg} z-10`}>
                            <Icon className={`h-4 w-4 ${cfg.color}`} />
                          </div>
                          <div className="flex-1 min-w-0 pt-0.5">
                            <p className="text-sm"><span className="font-semibold">{log.username || log.user_email || "System"}</span>{" "}<span className="text-muted-foreground">{cfg.label}</span>{log.details && <span className="text-muted-foreground"> - {typeof log.details === "string" ? log.details : (log.details as any)?.filename || Object.values(log.details as Record<string, unknown>).filter(v => typeof v === "string").join(", ") || ""}</span>}</p>
                            <p className="text-[11px] text-muted-foreground mt-0.5">{new Date(log.created_at).toLocaleString("de-DE", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" })}</p>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Charts Section */}
        {data && data.items.length > 0 && (
          <div className="grid gap-4 sm:grid-cols-2">
            {/* Storage by Type */}
            <Card className="border-0 shadow-md bg-white dark:bg-card">
              <CardContent className="p-5">
                <h3 className="text-sm font-semibold mb-4">Speicher nach Typ</h3>
                {(() => {
                  const docs = data.items;
                  const pdfSize = docs.filter((d) => d.mime_type.includes("pdf")).reduce((s, d) => s + d.file_size, 0);
                  const imgSize = docs.filter((d) => d.mime_type.startsWith("image/")).reduce((s, d) => s + d.file_size, 0);
                  const otherSize = docs.filter((d) => !d.mime_type.includes("pdf") && !d.mime_type.startsWith("image/")).reduce((s, d) => s + d.file_size, 0);
                  const total = pdfSize + imgSize + otherSize || 1;
                  const items = [
                    { label: "PDF", size: pdfSize, color: "bg-red-500", pct: Math.round((pdfSize / total) * 100) },
                    { label: "Bilder", size: imgSize, color: "bg-violet-500", pct: Math.round((imgSize / total) * 100) },
                    { label: "Andere", size: otherSize, color: "bg-slate-400", pct: Math.round((otherSize / total) * 100) },
                  ];
                  return (
                    <div className="space-y-3">
                      <div className="flex h-4 rounded-full overflow-hidden bg-slate-100 dark:bg-muted">
                        {items.map((item) => item.pct > 0 && (
                          <div key={item.label} className={`${item.color} transition-all`} style={{ width: `${item.pct}%` }} />
                        ))}
                      </div>
                      <div className="flex gap-4">
                        {items.map((item) => (
                          <div key={item.label} className="flex items-center gap-1.5">
                            <div className={`h-2.5 w-2.5 rounded-full ${item.color}`} />
                            <span className="text-xs text-muted-foreground">{item.label} ({item.pct}%)</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  );
                })()}
              </CardContent>
            </Card>

            {/* Upload Activity - last 7 days */}
            <Card className="border-0 shadow-md bg-white dark:bg-card">
              <CardContent className="p-5">
                <h3 className="text-sm font-semibold mb-4">Upload-Aktivitaet (7 Tage)</h3>
                {(() => {
                  const now = new Date();
                  const days: { label: string; count: number }[] = [];
                  for (let i = 6; i >= 0; i--) {
                    const d = new Date(now);
                    d.setDate(d.getDate() - i);
                    const dateStr = d.toISOString().slice(0, 10);
                    const count = data.items.filter((doc) => doc.created_at.slice(0, 10) === dateStr).length;
                    days.push({
                      label: d.toLocaleDateString("de-DE", { weekday: "short" }),
                      count,
                    });
                  }
                  const maxCount = Math.max(...days.map((d) => d.count), 1);
                  return (
                    <div className="flex items-end gap-2 h-24">
                      {days.map((day, i) => (
                        <div key={i} className="flex-1 flex flex-col items-center gap-1">
                          <div
                            className="w-full rounded-t-md bg-sky-500 dark:bg-sky-600 transition-all min-h-[2px]"
                            style={{ height: `${Math.max((day.count / maxCount) * 100, 3)}%` }}
                          />
                          <span className="text-[10px] text-muted-foreground">{day.label}</span>
                        </div>
                      ))}
                    </div>
                  );
                })()}
              </CardContent>
            </Card>
          </div>
        )}

        <div>
          <div className="flex items-center justify-between mb-5">
            <div><h2 className="text-lg font-bold tracking-tight">Letzte Dokumente</h2><p className="text-sm text-muted-foreground">Kuerzlich hochgeladene Dateien</p></div>
            <Link href="/documents"><Button variant="outline" size="sm">Alle anzeigen<ArrowRight className="ml-1.5 h-3.5 w-3.5" /></Button></Link>
          </div>
          {isLoading ? (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">{Array.from({ length: 8 }).map((_, i) => (<Skeleton key={i} className="h-28 rounded-xl" />))}</div>
          ) : (<DocumentGrid documents={data?.items ?? []} />)}
        </div>
      </div>
    </AppShell>
  );
}
