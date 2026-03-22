"use client";

import { AppShell } from "@/components/layout/app-shell";
import { useDocuments, useRestoreDocument, usePermanentDeleteDocument } from "@/hooks/use-documents";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogClose,
} from "@/components/ui/dialog";
import { Trash2, RotateCcw, AlertTriangle, FileText } from "lucide-react";
import { toast } from "sonner";
import { useState } from "react";

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

export default function TrashPage() {
  const [page, setPage] = useState(1);
  const { data, isLoading } = useDocuments({ trash: true, page });
  const restoreDoc = useRestoreDocument();
  const permanentDelete = usePermanentDeleteDocument();
  const [deleteTarget, setDeleteTarget] = useState<{ id: string; title: string } | null>(null);

  const handleRestore = async (id: string, title: string) => {
    try {
      await restoreDoc.mutateAsync(id);
      toast.success(`"${title}" wiederhergestellt`);
    } catch {
      toast.error("Wiederherstellen fehlgeschlagen");
    }
  };

  const handlePermanentDelete = async () => {
    if (!deleteTarget) return;
    try {
      await permanentDelete.mutateAsync(deleteTarget.id);
      toast.success(`"${deleteTarget.title}" endgültig gelöscht`);
    } catch {
      toast.error("Löschen fehlgeschlagen");
    }
    setDeleteTarget(null);
  };

  return (
    <AppShell>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
            <Trash2 className="h-6 w-6 text-muted-foreground" />
            Papierkorb
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            {data?.total ?? 0} Dokument(e) im Papierkorb
          </p>
        </div>

        {isLoading ? (
          <div className="space-y-3">
            {Array.from({ length: 5 }).map((_, i) => (
              <Skeleton key={i} className="h-20 rounded-xl" />
            ))}
          </div>
        ) : data?.items && data.items.length > 0 ? (
          <div className="space-y-3">
            {data.items.map((doc) => (
              <Card key={doc.id} className="border-0 shadow-sm bg-white dark:bg-card">
                <CardContent className="p-4">
                  <div className="flex items-center gap-4">
                    <div className="rounded-xl bg-red-50 dark:bg-red-900/20 p-2.5">
                      <FileText className="h-5 w-5 text-red-500" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <h3 className="font-semibold text-sm truncate">{doc.title}</h3>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        {doc.filename} · {formatSize(doc.file_size)} · Gelöscht am {doc.deleted_at ? new Date(doc.deleted_at).toLocaleDateString("de-DE") : new Date(doc.updated_at).toLocaleDateString("de-DE")}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleRestore(doc.id, doc.title)}
                        disabled={restoreDoc.isPending}
                      >
                        <RotateCcw className="mr-1 h-3.5 w-3.5" />
                        Wiederherstellen
                      </Button>
                      <Button
                        variant="destructive"
                        size="sm"
                        onClick={() => setDeleteTarget({ id: doc.id, title: doc.title })}
                        disabled={permanentDelete.isPending}
                      >
                        <Trash2 className="mr-1 h-3.5 w-3.5" />
                        Endgültig löschen
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <div className="rounded-2xl bg-slate-100 dark:bg-muted p-5 mb-5">
              <Trash2 className="h-10 w-10 text-slate-400" />
            </div>
            <p className="text-lg font-medium">Papierkorb ist leer</p>
            <p className="text-sm text-muted-foreground mt-1">Gelöschte Dokumente werden hier angezeigt</p>
          </div>
        )}

        {data && data.total > data.page_size && (
          <div className="flex items-center justify-center gap-2">
            <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>
              Zurück
            </Button>
            <span className="text-sm text-muted-foreground">
              Seite {page} von {Math.ceil(data.total / data.page_size)}
            </span>
            <Button variant="outline" size="sm" disabled={page >= Math.ceil(data.total / data.page_size)} onClick={() => setPage((p) => p + 1)}>
              Weiter
            </Button>
          </div>
        )}
      </div>

      {/* Confirm permanent delete */}
      <Dialog open={!!deleteTarget} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <DialogContent>
          <DialogHeader>
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-destructive/10 mb-2">
              <AlertTriangle className="h-6 w-6 text-destructive" />
            </div>
            <DialogTitle className="text-center">Endgültig löschen?</DialogTitle>
            <DialogDescription className="text-center">
              <span className="font-semibold text-foreground">&ldquo;{deleteTarget?.title}&rdquo;</span> wird unwiderruflich gelöscht. Diese Aktion kann nicht rückgängig gemacht werden.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <DialogClose className="inline-flex items-center justify-center rounded-lg border border-border bg-background px-4 h-9 text-sm font-medium hover:bg-muted transition-colors cursor-pointer">
              Abbrechen
            </DialogClose>
            <Button variant="destructive" onClick={handlePermanentDelete} disabled={permanentDelete.isPending}>
              {permanentDelete.isPending ? "Löscht..." : "Endgültig löschen"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AppShell>
  );
}
