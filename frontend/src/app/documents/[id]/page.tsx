"use client";

import { useParams, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { AppShell } from "@/components/layout/app-shell";
import { useDocument, useDeleteDocument, useUpdateDocument, useToggleFavorite, useDocumentComments, useAddComment, useDocumentVersions, useUploadVersion } from "@/hooks/use-documents";
import { useCorrespondents } from "@/hooks/use-correspondents";
import { useDocumentTypes } from "@/hooks/use-document-types";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger, DialogClose } from "@/components/ui/dialog";
import { TagSelector } from "@/components/tags/tag-manager";
import { DocumentShareCard } from "@/components/documents/document-share-card";
import { ArrowLeft, Download, FileText, Trash2, FileImage, AlertTriangle, Pencil, Star, Send, MessageCircle, X, History, Upload, Check, RefreshCw, Layers } from "lucide-react";
import { api, apiBlob } from "@/lib/api";
import { toast } from "sonner";
import { PageManager } from "@/components/documents/page-manager";

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

function useDocumentPages(docId: string) {
  const [pageUrls, setPageUrls] = useState<string[]>([]);
  const [pageCount, setPageCount] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!docId) return;
    let urls: string[] = [];

    (async () => {
      try {
        // Get page info
        const info = await api<{ page_count: number; pages: number[] }>(`/api/documents/${docId}/pages`);
        setPageCount(info.page_count);

        // Load all pages
        const loaded: string[] = [];
        for (const pageNum of info.pages) {
          try {
            const blob = await apiBlob(`/api/documents/${docId}/pages/${pageNum}`);
            const url = URL.createObjectURL(blob);
            loaded.push(url);
            urls.push(url);
          } catch {
            loaded.push("");
          }
        }
        setPageUrls(loaded);
      } catch {
        // Fallback: try single download
        try {
          const blob = await apiBlob(`/api/documents/${docId}/download`);
          const url = URL.createObjectURL(blob);
          urls.push(url);
          setPageUrls([url]);
          setPageCount(1);
        } catch {}
      }
      setLoading(false);
    })();

    return () => { urls.forEach((u) => u && URL.revokeObjectURL(u)); };
  }, [docId]);

  return { pageUrls, pageCount, loading };
}

export default function DocumentDetailPage() {
  const params = useParams();
  const router = useRouter();
  const id = params.id as string;
  const { data: doc, isLoading } = useDocument(id);
  const deleteDoc = useDeleteDocument();
  const updateDoc = useUpdateDocument();
  const toggleFav = useToggleFavorite();
  const { pageUrls, pageCount, loading: pagesLoading } = useDocumentPages(id);
  const [currentPage, setCurrentPage] = useState(1);
  const [editingTags, setEditingTags] = useState(false);
  const [selectedTagIds, setSelectedTagIds] = useState<string[]>([]);
  const [editingTitle, setEditingTitle] = useState(false);
  const [titleValue, setTitleValue] = useState("");
  const { data: commentsData } = useDocumentComments(id);
  const addComment = useAddComment();
  const [commentText, setCommentText] = useState("");
  const [lightbox, setLightbox] = useState(false);
  const { data: versions } = useDocumentVersions(id);
  const uploadVersion = useUploadVersion();
  const [showVersionUpload, setShowVersionUpload] = useState(false);
  const [versionComment, setVersionComment] = useState("");
  const { data: correspondents } = useCorrespondents();
  const { data: documentTypes } = useDocumentTypes();
  const [editingDesc, setEditingDesc] = useState(false);
  const [descValue, setDescValue] = useState("");
  const [thumbnailError, setThumbnailError] = useState(false);
  const [regenLoading, setRegenLoading] = useState(false);
  const [pageManagerOpen, setPageManagerOpen] = useState(false);

  const handleDownload = async () => {
    if (!doc) return;
    try {
      const blob = await apiBlob(`/api/documents/${doc.id}/download`);
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a"); a.href = url; a.download = doc.filename; a.click();
      URL.revokeObjectURL(url);
    } catch { toast.error("Download fehlgeschlagen"); }
  };

  const handleDelete = async () => {
    if (!doc) return;
    try { await deleteDoc.mutateAsync(doc.id); toast.success("Dokument geloescht"); router.push("/documents"); }
    catch { toast.error("Loeschen fehlgeschlagen"); }
  };

  const handleToggleFav = async () => {
    if (!doc) return;
    try { await toggleFav.mutateAsync({ id: doc.id, is_favorite: !doc.is_favorite }); }
    catch { toast.error("Fehler"); }
  };

  const handleAddComment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!commentText.trim()) return;
    try { await addComment.mutateAsync({ documentId: id, text: commentText.trim() }); setCommentText(""); }
    catch { toast.error("Kommentar konnte nicht gespeichert werden"); }
  };

  if (isLoading) return (<AppShell><div className="space-y-6"><Skeleton className="h-10 w-64" /><div className="grid gap-6 lg:grid-cols-3"><Skeleton className="lg:col-span-2 h-96 rounded-xl" /><Skeleton className="h-96 rounded-xl" /></div></div></AppShell>);

  if (!doc) return (<AppShell><div className="flex flex-col items-center justify-center py-20"><div className="rounded-2xl bg-muted p-5 mb-4"><FileText className="h-10 w-10 text-muted-foreground" /></div><p className="text-lg font-medium">Dokument nicht gefunden</p></div></AppShell>);

  const isImage = doc.mime_type.startsWith("image/");
  const isPdf = doc.mime_type.includes("pdf");
  const isMultiPage = pageCount > 1;
  const currentPageUrl = pageUrls[currentPage - 1] || null;

  return (
    <>
    <AppShell>
      <div className="space-y-6">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => router.back()}><ArrowLeft className="h-4 w-4" /></Button>
          <div className="flex-1 min-w-0">
            {editingTitle ? (
              <form onSubmit={async (e) => {
                e.preventDefault();
                if (!titleValue.trim()) return;
                try {
                  await updateDoc.mutateAsync({ id: doc.id, data: { title: titleValue.trim() } });
                  setEditingTitle(false);
                  toast.success("Titel aktualisiert");
                } catch { toast.error("Titel konnte nicht gespeichert werden"); }
              }} className="flex items-center gap-2">
                <Input
                  value={titleValue}
                  onChange={(e) => setTitleValue(e.target.value)}
                  className="h-9 text-lg font-bold"
                  autoFocus
                  onKeyDown={(e) => { if (e.key === "Escape") setEditingTitle(false); }}
                />
                <Button type="submit" size="sm" className="bg-sky-600 hover:bg-sky-700 shrink-0" disabled={updateDoc.isPending}>Speichern</Button>
                <Button type="button" variant="ghost" size="sm" onClick={() => setEditingTitle(false)}>Abbrechen</Button>
              </form>
            ) : (
              <button
                onClick={() => { setTitleValue(doc.title); setEditingTitle(true); }}
                className="text-left group/title cursor-pointer"
                title="Klicken zum Umbenennen"
              >
                <h1 className="text-xl font-bold tracking-tight truncate group-hover/title:text-sky-700 transition-colors">{doc.title}<Pencil className="inline ml-2 h-3.5 w-3.5 text-muted-foreground/0 group-hover/title:text-muted-foreground transition-colors" /></h1>
                <p className="text-sm text-muted-foreground">{doc.filename}</p>
              </button>
            )}
          </div>
          <div className="flex gap-2 items-center">
            <button onClick={handleToggleFav} className="flex h-8 w-8 items-center justify-center rounded-lg hover:bg-muted transition-colors cursor-pointer">
              <Star className={`h-5 w-5 ${doc.is_favorite ? "fill-amber-400 text-amber-400" : "text-muted-foreground"}`} />
            </button>
            <Button onClick={handleDownload} className="bg-sky-600 hover:bg-sky-700 shadow-md shadow-sky-600/25"><Download className="mr-2 h-4 w-4" />Download</Button>
            <Dialog>
              <DialogTrigger className="inline-flex items-center justify-center rounded-lg h-8 w-8 bg-destructive/10 text-destructive hover:bg-destructive/20 transition-colors cursor-pointer"><Trash2 className="h-4 w-4" /></DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-destructive/10 mb-2"><AlertTriangle className="h-6 w-6 text-destructive" /></div>
                  <DialogTitle className="text-center">Dokument loeschen?</DialogTitle>
                  <DialogDescription className="text-center"><span className="font-semibold text-foreground">&ldquo;{doc.title}&rdquo;</span> wird in den Papierkorb verschoben.</DialogDescription>
                </DialogHeader>
                <DialogFooter>
                  <DialogClose className="inline-flex items-center justify-center rounded-lg border border-border bg-background px-4 h-9 text-sm font-medium hover:bg-muted transition-colors cursor-pointer">Abbrechen</DialogClose>
                  <Button variant="destructive" onClick={handleDelete} disabled={deleteDoc.isPending}>{deleteDoc.isPending ? "Loescht..." : "Loeschen"}</Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </div>
        </div>

        <div className="grid gap-6 lg:grid-cols-3">
          <div className="lg:col-span-2 space-y-6">
            <Card className="border-0 shadow-md bg-white dark:bg-card overflow-hidden">
              <CardContent className="p-0">
                {pagesLoading ? (
                  <div className="flex items-center justify-center min-h-[400px] bg-slate-50 dark:bg-muted">
                    <div className="h-8 w-8 animate-spin rounded-full border-2 border-sky-500 border-t-transparent" />
                  </div>
                ) : currentPageUrl && isPdf ? (
                  <iframe src={currentPageUrl} className="w-full min-h-[600px] border-0" title={doc.title} />
                ) : currentPageUrl && (isImage || isMultiPage) ? (
                  <div className="flex items-center justify-center bg-slate-50 dark:bg-muted min-h-[400px] p-4 cursor-zoom-in" onClick={() => setLightbox(true)}>
                    <img src={currentPageUrl} alt={`${doc.title} - Seite ${currentPage}`} className="max-h-[600px] max-w-full object-contain rounded-lg" />
                  </div>
                ) : currentPageUrl ? (
                  <iframe src={currentPageUrl} className="w-full min-h-[600px] border-0" title={doc.title} />
                ) : (
                  <div className="flex flex-col items-center justify-center min-h-[400px] bg-gradient-to-br from-slate-50 to-slate-100 dark:from-muted dark:to-muted">
                    <div className="rounded-2xl bg-white dark:bg-card p-6 shadow-sm mb-4"><FileImage className="h-16 w-16 text-slate-400" /></div>
                    <p className="text-sm font-medium text-muted-foreground mb-3">{doc.mime_type.split("/")[1]?.toUpperCase()} Dokument</p>
                    <Button variant="outline" onClick={handleDownload}><Download className="mr-2 h-4 w-4" />Herunterladen</Button>
                  </div>
                )}
              </CardContent>
              {/* Page navigation for multi-page documents */}
              {isMultiPage && (
                <div className="flex items-center justify-center gap-3 p-3 border-t border-border/50 bg-slate-50/50 dark:bg-muted/30">
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={currentPage <= 1}
                    onClick={() => setCurrentPage((p) => p - 1)}
                  >
                    Zurück
                  </Button>
                  <div className="flex items-center gap-1.5">
                    {Array.from({ length: pageCount }, (_, i) => i + 1).map((p) => (
                      <button
                        key={p}
                        onClick={() => setCurrentPage(p)}
                        className={`h-8 w-8 rounded-lg text-xs font-medium transition-colors cursor-pointer ${
                          p === currentPage
                            ? "bg-sky-600 text-white shadow-sm"
                            : "hover:bg-muted text-muted-foreground"
                        }`}
                      >
                        {p}
                      </button>
                    ))}
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={currentPage >= pageCount}
                    onClick={() => setCurrentPage((p) => p + 1)}
                  >
                    Weiter
                  </Button>
                  <span className="text-xs text-muted-foreground ml-2">
                    Seite {currentPage} von {pageCount}
                  </span>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setPageManagerOpen(true)}
                    className="ml-3"
                  >
                    <Layers className="mr-1 h-3.5 w-3.5" />
                    Seiten verwalten
                  </Button>
                </div>
              )}
            </Card>

            <Card className="border-0 shadow-md bg-white dark:bg-card">
              <CardHeader className="pb-3"><CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2"><MessageCircle className="h-4 w-4" />Kommentare{commentsData && commentsData.length > 0 && <Badge variant="secondary" className="ml-1 text-[10px]">{commentsData.length}</Badge>}</CardTitle></CardHeader>
              <CardContent className="space-y-4">
                {commentsData && commentsData.length > 0 ? (
                  <div className="space-y-3 max-h-80 overflow-auto">{commentsData.map((c) => (
                    <div key={c.id} className="flex gap-3">
                      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-sky-100 dark:bg-sky-900/30 text-xs font-bold text-sky-700 dark:text-sky-300">{c.username?.[0]?.toUpperCase() || "?"}</div>
                      <div className="flex-1 min-w-0"><div className="flex items-baseline gap-2"><span className="text-sm font-semibold">{c.username}</span><span className="text-[11px] text-muted-foreground">{new Date(c.created_at).toLocaleString("de-DE",{day:"2-digit",month:"2-digit",year:"numeric",hour:"2-digit",minute:"2-digit"})}</span></div><p className="text-sm text-foreground/80 mt-0.5">{c.text}</p></div>
                    </div>))}</div>
                ) : <p className="text-xs text-muted-foreground">Noch keine Kommentare.</p>}
                <form onSubmit={handleAddComment} className="flex gap-2">
                  <Input value={commentText} onChange={(e) => setCommentText(e.target.value)} placeholder="Kommentar schreiben..." className="h-10 flex-1" />
                  <Button type="submit" size="icon" disabled={!commentText.trim() || addComment.isPending} className="bg-sky-600 hover:bg-sky-700 h-10 w-10"><Send className="h-4 w-4" /></Button>
                </form>
              </CardContent>
            </Card>

            {/* Versions */}
            <Card className="border-0 shadow-md bg-white dark:bg-card">
              <CardHeader className="pb-3 flex flex-row items-center justify-between">
                <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                  <History className="h-4 w-4" />
                  Versionen
                  {versions && versions.length > 0 && <Badge variant="secondary" className="ml-1 text-[10px]">{versions.length}</Badge>}
                </CardTitle>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-7 text-xs text-muted-foreground"
                  onClick={() => setShowVersionUpload(!showVersionUpload)}
                >
                  <Upload className="h-3 w-3 mr-1" />
                  {showVersionUpload ? "Abbrechen" : "Neue Version"}
                </Button>
              </CardHeader>
              <CardContent className="space-y-3">
                {/* Upload new version */}
                {showVersionUpload && (
                  <form
                    onSubmit={async (e) => {
                      e.preventDefault();
                      const form = e.currentTarget;
                      const fileInput = form.querySelector('input[type="file"]') as HTMLInputElement;
                      if (!fileInput?.files?.[0]) return;
                      const formData = new FormData();
                      formData.append("file", fileInput.files[0]);
                      if (versionComment.trim()) formData.append("comment", versionComment.trim());
                      try {
                        await uploadVersion.mutateAsync({ documentId: id, formData });
                        setShowVersionUpload(false);
                        setVersionComment("");
                        toast.success("Neue Version hochgeladen");
                      } catch {
                        toast.error("Upload fehlgeschlagen");
                      }
                    }}
                    className="space-y-2 p-3 rounded-lg bg-sky-50 dark:bg-sky-900/10 border border-sky-200 dark:border-sky-800"
                  >
                    <input
                      type="file"
                      className="block w-full text-sm text-muted-foreground file:mr-3 file:py-1.5 file:px-3 file:rounded-lg file:border-0 file:text-sm file:font-medium file:bg-sky-600 file:text-white hover:file:bg-sky-700 file:cursor-pointer cursor-pointer"
                      required
                    />
                    <Input
                      value={versionComment}
                      onChange={(e) => setVersionComment(e.target.value)}
                      placeholder="Kommentar zur Version (optional)"
                      className="h-9 text-sm"
                    />
                    <Button type="submit" size="sm" className="bg-sky-600 hover:bg-sky-700" disabled={uploadVersion.isPending}>
                      {uploadVersion.isPending ? "Lädt..." : "Version hochladen"}
                    </Button>
                  </form>
                )}

                {/* Version list */}
                {versions && versions.length > 0 ? (
                  <div className="space-y-2">
                    {versions.map((v) => {
                      const isCurrent = v.version_number === doc.current_version;
                      return (
                        <div
                          key={v.id}
                          className={`flex items-center gap-3 p-2.5 rounded-lg text-sm transition-colors ${
                            isCurrent ? "bg-sky-50 dark:bg-sky-900/20 border border-sky-200 dark:border-sky-800" : "hover:bg-muted/50"
                          }`}
                        >
                          <div className={`flex h-8 w-8 items-center justify-center rounded-lg text-xs font-bold ${
                            isCurrent ? "bg-sky-600 text-white" : "bg-muted text-muted-foreground"
                          }`}>
                            v{v.version_number}
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                              <span className="font-medium text-xs">
                                {new Date(v.created_at).toLocaleString("de-DE", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" })}
                              </span>
                              {isCurrent && <Badge variant="secondary" className="text-[9px] bg-sky-100 text-sky-700 dark:bg-sky-900/30 dark:text-sky-300">Aktuell</Badge>}
                            </div>
                            {v.comment && <p className="text-[11px] text-muted-foreground mt-0.5 truncate">{v.comment}</p>}
                            <p className="text-[11px] text-muted-foreground">{formatSize(v.file_size)}</p>
                          </div>
                          {!isCurrent && (
                            <button
                              onClick={async () => {
                                try {
                                  const blob = await apiBlob(`/api/documents/${id}/versions/${v.version_number}/download`);
                                  const url = URL.createObjectURL(blob);
                                  const a = document.createElement("a");
                                  a.href = url;
                                  a.download = `v${v.version_number}_${doc.filename}`;
                                  a.click();
                                  URL.revokeObjectURL(url);
                                } catch {
                                  toast.error("Download fehlgeschlagen");
                                }
                              }}
                              className="p-1.5 rounded-lg hover:bg-muted transition-colors cursor-pointer"
                              title="Diese Version herunterladen"
                            >
                              <Download className="h-3.5 w-3.5 text-muted-foreground" />
                            </button>
                          )}
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <p className="text-xs text-muted-foreground">Keine Versionshistorie verfügbar.</p>
                )}
              </CardContent>
            </Card>
          </div>

          <div className="space-y-4">
            <Card className="border-0 shadow-md bg-white dark:bg-card">
              <CardHeader className="pb-3"><CardTitle className="text-sm font-medium text-muted-foreground">Details</CardTitle></CardHeader>
              <CardContent className="space-y-3">
                <div className="flex items-center justify-between text-sm"><span className="text-muted-foreground">Typ</span><span className="font-medium">{doc.mime_type.split("/")[1]?.toUpperCase()}</span></div><Separator />
                <div className="flex items-center justify-between text-sm"><span className="text-muted-foreground">Groesse</span><span className="font-medium">{formatSize(doc.file_size)}</span></div><Separator />
                <div className="flex items-center justify-between text-sm"><span className="text-muted-foreground">Version</span><span className="font-medium">v{doc.current_version}</span></div><Separator />
                <div className="flex items-center justify-between text-sm"><span className="text-muted-foreground">Erstellt</span><span className="font-medium">{new Date(doc.created_at).toLocaleDateString("de-DE")}</span></div><Separator />
                <div className="flex items-center justify-between text-sm"><span className="text-muted-foreground">OCR</span><Badge variant="secondary" className={doc.ocr_status==="completed"?"bg-emerald-50 text-emerald-700 border-emerald-200":doc.ocr_status==="processing"?"bg-sky-50 text-sky-700 border-sky-200":"bg-slate-50 text-slate-600 border-slate-200"}>{doc.ocr_status==="completed"?"Fertig":doc.ocr_status==="processing"?"Laeuft...":doc.ocr_status}</Badge></div><Separator />
                <div className="space-y-1">
                  <span className="text-xs text-muted-foreground">Korrespondent</span>
                  <select
                    value={doc.correspondent_id ?? ""}
                    onChange={async (e) => {
                      try {
                        await updateDoc.mutateAsync({ id: doc.id, data: { correspondent_id: e.target.value || null } });
                        toast.success("Korrespondent aktualisiert");
                      } catch { toast.error("Fehler beim Speichern"); }
                    }}
                    className="w-full h-9 rounded-lg border border-border bg-background px-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                  >
                    <option value="">Kein Korrespondent</option>
                    {correspondents?.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                  </select>
                </div><Separator />
                <div className="space-y-1">
                  <span className="text-xs text-muted-foreground">Dokumenttyp</span>
                  <select
                    value={doc.document_type_id ?? ""}
                    onChange={async (e) => {
                      try {
                        await updateDoc.mutateAsync({ id: doc.id, data: { document_type_id: e.target.value || null } });
                        toast.success("Dokumenttyp aktualisiert");
                      } catch { toast.error("Fehler beim Speichern"); }
                    }}
                    className="w-full h-9 rounded-lg border border-border bg-background px-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                  >
                    <option value="">Kein Typ</option>
                    {documentTypes?.map((dt) => <option key={dt.id} value={dt.id}>{dt.name}</option>)}
                  </select>
                </div><Separator />
                <div className="space-y-1">
                  <span className="text-xs text-muted-foreground">Dokumentdatum</span>
                  <Input
                    type="date"
                    value={doc.document_date ?? ""}
                    onChange={async (e) => {
                      try {
                        await updateDoc.mutateAsync({ id: doc.id, data: { document_date: e.target.value || null } });
                        toast.success("Datum aktualisiert");
                      } catch { toast.error("Fehler beim Speichern"); }
                    }}
                    className="h-9"
                  />
                </div><Separator />
                <div className="space-y-1">
                  <span className="text-xs text-muted-foreground">ASN</span>
                  <Input
                    defaultValue={doc.asn ?? ""}
                    onBlur={async (e) => {
                      const val = e.target.value.trim();
                      if (val === (doc.asn ?? "")) return;
                      try {
                        await updateDoc.mutateAsync({ id: doc.id, data: { asn: val || null } });
                        toast.success("ASN aktualisiert");
                      } catch { toast.error("Fehler beim Speichern"); }
                    }}
                    placeholder="Archiv-Seriennummer"
                    className="h-9"
                  />
                </div><Separator />
                <div className="space-y-1">
                  <span className="text-xs text-muted-foreground">Aufbewahrung bis</span>
                  <Input
                    type="date"
                    value={doc.retention_date ?? ""}
                    onChange={async (e) => {
                      try {
                        await updateDoc.mutateAsync({ id: doc.id, data: { retention_date: e.target.value || null } });
                        toast.success("Aufbewahrungsfrist aktualisiert");
                      } catch { toast.error("Fehler beim Speichern"); }
                    }}
                    className="h-9"
                  />
                </div>
              </CardContent>
            </Card>

            <Card className="border-0 shadow-md bg-white dark:bg-card">
              <CardHeader className="pb-3 flex flex-row items-center justify-between"><CardTitle className="text-sm font-medium text-muted-foreground">Tags</CardTitle><Button variant="ghost" size="sm" className="h-7 text-xs text-muted-foreground" onClick={()=>{if(!editingTags)setSelectedTagIds(doc.tags.map(t=>t.id));setEditingTags(!editingTags);}}><Pencil className="h-3 w-3 mr-1" />{editingTags?"Abbrechen":"Bearbeiten"}</Button></CardHeader>
              <CardContent>
                {editingTags?(<div className="space-y-3"><TagSelector selectedIds={selectedTagIds} onChange={setSelectedTagIds} /><Button size="sm" className="bg-sky-600 hover:bg-sky-700" onClick={async()=>{try{await updateDoc.mutateAsync({id:doc.id,data:{tag_ids:selectedTagIds}});setEditingTags(false);toast.success("Tags aktualisiert");}catch{toast.error("Tags konnten nicht gespeichert werden");}}} disabled={updateDoc.isPending}>{updateDoc.isPending?"Speichert...":"Tags speichern"}</Button></div>
                ):doc.tags.length>0?(<div className="flex flex-wrap gap-1.5">{doc.tags.map(tag=>(<Badge key={tag.id} variant="secondary" style={{backgroundColor:tag.color+"15",color:tag.color,borderColor:tag.color+"30"}}>{tag.name}</Badge>))}</div>
                ):(<p className="text-xs text-muted-foreground">Keine Tags.</p>)}
              </CardContent>
            </Card>

            {/* Editable Description */}
            <Card className="border-0 shadow-md bg-white dark:bg-card">
              <CardHeader className="pb-3 flex flex-row items-center justify-between">
                <CardTitle className="text-sm font-medium text-muted-foreground">Beschreibung</CardTitle>
                {!editingDesc && (
                  <button
                    onClick={() => { setDescValue(doc.description ?? ""); setEditingDesc(true); }}
                    className="p-1 rounded-lg hover:bg-muted transition-colors cursor-pointer"
                  >
                    <Pencil className="h-3 w-3 text-muted-foreground" />
                  </button>
                )}
              </CardHeader>
              <CardContent>
                {editingDesc ? (
                  <div className="space-y-2">
                    <textarea
                      value={descValue}
                      onChange={(e) => setDescValue(e.target.value)}
                      className="w-full min-h-[80px] rounded-lg border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring resize-y"
                      autoFocus
                      onKeyDown={(e) => { if (e.key === "Escape") setEditingDesc(false); }}
                    />
                    <div className="flex gap-2">
                      <button
                        onClick={async () => {
                          try {
                            await updateDoc.mutateAsync({ id: doc.id, data: { description: descValue } });
                            setEditingDesc(false);
                            toast.success("Beschreibung aktualisiert");
                          } catch { toast.error("Fehler beim Speichern"); }
                        }}
                        className="inline-flex items-center justify-center rounded-lg bg-sky-600 hover:bg-sky-700 px-3 h-8 text-xs font-medium text-white transition-colors cursor-pointer"
                      >
                        Speichern
                      </button>
                      <button
                        onClick={() => setEditingDesc(false)}
                        className="inline-flex items-center justify-center rounded-lg border border-border px-3 h-8 text-xs font-medium hover:bg-muted transition-colors cursor-pointer"
                      >
                        Abbrechen
                      </button>
                    </div>
                  </div>
                ) : doc.description ? (
                  <p className="text-sm leading-relaxed cursor-pointer hover:text-sky-700 dark:hover:text-sky-400 transition-colors" onClick={() => { setDescValue(doc.description ?? ""); setEditingDesc(true); }}>
                    {doc.description}
                  </p>
                ) : (
                  <p className="text-xs text-muted-foreground italic cursor-pointer hover:text-sky-700 transition-colors" onClick={() => { setDescValue(""); setEditingDesc(true); }}>
                    Klicken um Beschreibung hinzuzufuegen
                  </p>
                )}
              </CardContent>
            </Card>

            {/* Document Sharing */}
            <DocumentShareCard docId={doc.id} />

            {/* Thumbnail Regenerate */}
            <Card className="border-0 shadow-md bg-white dark:bg-card">
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-medium text-muted-foreground">Vorschau</CardTitle>
              </CardHeader>
              <CardContent>
                {!thumbnailError ? (
                  <img
                    src={`${process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000"}/api/documents/${doc.id}/thumbnail`}
                    alt="Vorschau"
                    className="w-full rounded-lg"
                    onError={() => setThumbnailError(true)}
                  />
                ) : (
                  <div className="text-center py-4">
                    <FileImage className="h-10 w-10 text-muted-foreground/30 mx-auto mb-2" />
                    <p className="text-xs text-muted-foreground mb-3">Keine Vorschau verfuegbar</p>
                    <button
                      onClick={async () => {
                        setRegenLoading(true);
                        try {
                          await api(`/api/documents/${doc.id}/regenerate-thumbnail`, { method: "POST" });
                          toast.success("Thumbnail wird neu generiert");
                          setThumbnailError(false);
                        } catch { toast.error("Fehler beim Regenerieren"); }
                        setRegenLoading(false);
                      }}
                      disabled={regenLoading}
                      className="inline-flex items-center gap-1.5 rounded-lg border border-border px-3 h-8 text-xs font-medium hover:bg-muted transition-colors cursor-pointer disabled:opacity-50"
                    >
                      <RefreshCw className={`h-3 w-3 ${regenLoading ? "animate-spin" : ""}`} />
                      Thumbnail neu generieren
                    </button>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      </div>

      {/* Page Manager */}
      {isMultiPage && (
        <PageManager
          open={pageManagerOpen}
          onOpenChange={setPageManagerOpen}
          docId={id}
          pageCount={pageCount}
        />
      )}

    </AppShell>

    {/* Lightbox — rendered OUTSIDE AppShell to cover entire viewport */}
    {lightbox && currentPageUrl && (
      <div
        className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/95"
        onClick={() => setLightbox(false)}
      >
        <button
          onClick={(e) => { e.stopPropagation(); setLightbox(false); }}
          className="fixed top-5 right-5 flex h-10 w-10 items-center justify-center rounded-full bg-white/20 text-white hover:bg-white/40 transition-colors cursor-pointer"
        >
          <X className="h-5 w-5" />
        </button>
        <p className="fixed top-5 left-5 text-white/70 text-sm">{doc.title}{isMultiPage ? ` — Seite ${currentPage}/${pageCount}` : ""}</p>
        {isMultiPage && (
          <>
            <button
              onClick={(e) => { e.stopPropagation(); setCurrentPage((p) => Math.max(1, p - 1)); }}
              disabled={currentPage <= 1}
              className="fixed left-5 top-1/2 -translate-y-1/2 flex h-10 w-10 items-center justify-center rounded-full bg-white/15 text-white hover:bg-white/30 disabled:opacity-20 cursor-pointer"
            >
              <ArrowLeft className="h-5 w-5" />
            </button>
            <button
              onClick={(e) => { e.stopPropagation(); setCurrentPage((p) => Math.min(pageCount, p + 1)); }}
              disabled={currentPage >= pageCount}
              className="fixed right-5 top-1/2 -translate-y-1/2 flex h-10 w-10 items-center justify-center rounded-full bg-white/15 text-white hover:bg-white/30 disabled:opacity-20 cursor-pointer"
            >
              <ArrowLeft className="h-5 w-5 rotate-180" />
            </button>
          </>
        )}
        <img
          src={currentPageUrl}
          alt={doc.title}
          className="max-h-[80vh] max-w-[80vw] object-contain"
          onClick={(e) => e.stopPropagation()}
        />
      </div>
    )}
    </>
  );
}
