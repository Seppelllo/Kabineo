"use client";

import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogClose,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import {
  useRotatePage,
  useReorderPages,
  useDeletePage,
  useExtractPage,
} from "@/hooks/use-documents";
import { apiBlob } from "@/lib/api";
import { toast } from "sonner";
import {
  RotateCw,
  RotateCcw,
  Trash2,
  ArrowUp,
  ArrowDown,
  ExternalLink,
  Save,
  Loader2,
  FileText,
} from "lucide-react";

interface PageManagerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  docId: string;
  pageCount: number;
}

export function PageManager({ open, onOpenChange, docId, pageCount }: PageManagerProps) {
  const [pages, setPages] = useState<number[]>([]);
  const [thumbs, setThumbs] = useState<Record<number, string>>({});
  const [loadingThumbs, setLoadingThumbs] = useState(true);

  const rotatePage = useRotatePage();
  const reorderPages = useReorderPages();
  const deletePage = useDeletePage();
  const extractPage = useExtractPage();

  // Initialize pages order
  useEffect(() => {
    if (open && pageCount > 0) {
      setPages(Array.from({ length: pageCount }, (_, i) => i + 1));
      setLoadingThumbs(true);
      // Load thumbnails
      const loadThumbs = async () => {
        const newThumbs: Record<number, string> = {};
        for (let i = 1; i <= pageCount; i++) {
          try {
            const blob = await apiBlob(`/api/documents/${docId}/pages/${i}`);
            newThumbs[i] = URL.createObjectURL(blob);
          } catch {
            newThumbs[i] = "";
          }
        }
        setThumbs(newThumbs);
        setLoadingThumbs(false);
      };
      loadThumbs();
    }
    return () => {
      Object.values(thumbs).forEach((url) => url && URL.revokeObjectURL(url));
    };
  }, [open, pageCount, docId]);

  const moveUp = (idx: number) => {
    if (idx <= 0) return;
    const newPages = [...pages];
    [newPages[idx - 1], newPages[idx]] = [newPages[idx], newPages[idx - 1]];
    setPages(newPages);
  };

  const moveDown = (idx: number) => {
    if (idx >= pages.length - 1) return;
    const newPages = [...pages];
    [newPages[idx], newPages[idx + 1]] = [newPages[idx + 1], newPages[idx]];
    setPages(newPages);
  };

  const handleRotate = async (pageNum: number, direction: "cw" | "ccw") => {
    try {
      await rotatePage.mutateAsync({ docId, pageNum, direction });
      // Reload this thumbnail
      try {
        const blob = await apiBlob(`/api/documents/${docId}/pages/${pageNum}`);
        const url = URL.createObjectURL(blob);
        setThumbs((prev) => {
          if (prev[pageNum]) URL.revokeObjectURL(prev[pageNum]);
          return { ...prev, [pageNum]: url };
        });
      } catch {}
      toast.success(`Seite ${pageNum} rotiert`);
    } catch {
      toast.error("Rotation fehlgeschlagen");
    }
  };

  const handleDelete = async (pageNum: number) => {
    if (pages.length <= 1) {
      toast.error("Letzte Seite kann nicht geloescht werden");
      return;
    }
    try {
      await deletePage.mutateAsync({ docId, pageNum });
      setPages((prev) => prev.filter((p) => p !== pageNum));
      toast.success(`Seite ${pageNum} geloescht`);
    } catch {
      toast.error("Loeschen fehlgeschlagen");
    }
  };

  const handleExtract = async (pageNum: number) => {
    try {
      const newDoc = await extractPage.mutateAsync({ docId, pageNum });
      toast.success(`Seite ${pageNum} als neues Dokument extrahiert`);
    } catch {
      toast.error("Extraktion fehlgeschlagen");
    }
  };

  const handleSaveOrder = async () => {
    try {
      await reorderPages.mutateAsync({ docId, order: pages });
      toast.success("Seitenreihenfolge gespeichert");
      onOpenChange(false);
    } catch {
      toast.error("Speichern fehlgeschlagen");
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[80vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle>Seiten verwalten</DialogTitle>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto py-2">
          {loadingThumbs ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-6 w-6 animate-spin text-sky-500" />
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
              {pages.map((pageNum, idx) => (
                <div
                  key={`${pageNum}-${idx}`}
                  className="group relative rounded-xl border border-border bg-slate-50 dark:bg-muted/30 overflow-hidden"
                >
                  {/* Thumbnail */}
                  <div className="aspect-[3/4] flex items-center justify-center bg-white dark:bg-card p-1">
                    {thumbs[pageNum] ? (
                      <img
                        src={thumbs[pageNum]}
                        alt={`Seite ${pageNum}`}
                        className="max-h-full max-w-full object-contain rounded"
                      />
                    ) : (
                      <FileText className="h-10 w-10 text-muted-foreground/30" />
                    )}
                  </div>

                  {/* Page number badge */}
                  <div className="absolute top-2 left-2 flex h-6 min-w-6 items-center justify-center rounded-md bg-sky-600 text-white text-xs font-bold px-1.5 shadow">
                    {pageNum}
                  </div>

                  {/* Controls */}
                  <div className="flex items-center justify-between gap-1 p-2 border-t border-border/50">
                    <div className="flex items-center gap-0.5">
                      <button
                        onClick={() => handleRotate(pageNum, "ccw")}
                        disabled={rotatePage.isPending}
                        className="p-1.5 rounded-lg hover:bg-muted transition-colors cursor-pointer disabled:opacity-50"
                        title="Gegen Uhrzeigersinn"
                      >
                        <RotateCcw className="h-3.5 w-3.5 text-muted-foreground" />
                      </button>
                      <button
                        onClick={() => handleRotate(pageNum, "cw")}
                        disabled={rotatePage.isPending}
                        className="p-1.5 rounded-lg hover:bg-muted transition-colors cursor-pointer disabled:opacity-50"
                        title="Im Uhrzeigersinn"
                      >
                        <RotateCw className="h-3.5 w-3.5 text-muted-foreground" />
                      </button>
                      <button
                        onClick={() => handleExtract(pageNum)}
                        disabled={extractPage.isPending}
                        className="p-1.5 rounded-lg hover:bg-muted transition-colors cursor-pointer disabled:opacity-50"
                        title="Als neues Dokument extrahieren"
                      >
                        <ExternalLink className="h-3.5 w-3.5 text-muted-foreground" />
                      </button>
                    </div>
                    <div className="flex items-center gap-0.5">
                      <button
                        onClick={() => moveUp(idx)}
                        disabled={idx === 0}
                        className="p-1.5 rounded-lg hover:bg-muted transition-colors cursor-pointer disabled:opacity-30"
                        title="Nach oben"
                      >
                        <ArrowUp className="h-3.5 w-3.5 text-muted-foreground" />
                      </button>
                      <button
                        onClick={() => moveDown(idx)}
                        disabled={idx === pages.length - 1}
                        className="p-1.5 rounded-lg hover:bg-muted transition-colors cursor-pointer disabled:opacity-30"
                        title="Nach unten"
                      >
                        <ArrowDown className="h-3.5 w-3.5 text-muted-foreground" />
                      </button>
                      <button
                        onClick={() => handleDelete(pageNum)}
                        disabled={deletePage.isPending || pages.length <= 1}
                        className="p-1.5 rounded-lg text-destructive hover:bg-destructive/10 transition-colors cursor-pointer disabled:opacity-30"
                        title="Seite loeschen"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <DialogFooter>
          <DialogClose className="inline-flex items-center justify-center rounded-lg border border-border bg-background px-4 h-9 text-sm font-medium hover:bg-muted transition-colors cursor-pointer">
            Abbrechen
          </DialogClose>
          <Button
            onClick={handleSaveOrder}
            disabled={reorderPages.isPending}
            className="bg-sky-600 hover:bg-sky-700"
          >
            {reorderPages.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            <Save className="mr-2 h-4 w-4" />
            Speichern
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
