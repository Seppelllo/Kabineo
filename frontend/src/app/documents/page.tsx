"use client";

import { useState, useMemo } from "react";
import { useSearchParams } from "next/navigation";
import { AppShell } from "@/components/layout/app-shell";
import { DocumentGrid } from "@/components/documents/document-grid";
import { DocumentTable } from "@/components/documents/document-table";
import { useDocuments, useUpdateDocument, useBulkAction } from "@/hooks/use-documents";
import { useFolders, useCreateFolder, useDeleteFolder, useBreadcrumb } from "@/hooks/use-folders";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Card, CardContent } from "@/components/ui/card";
import { TagFilter, TagSelector } from "@/components/tags/tag-manager";
import { FolderCard } from "@/components/folders/folder-card";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogClose,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  FolderOpen,
  FolderPlus,
  Grid3X3,
  List,
  Upload,
  ChevronRight,
  Home,
  MoreVertical,
  Trash2,
  ArrowRight,
  Loader2,
  CheckSquare,
  X,
  Star,
  Tag,
  FolderInput,
  Download,
  Share2,
  UserPlus,
} from "lucide-react";
import Link from "next/link";
import { toast } from "sonner";
import { api, apiBlob } from "@/lib/api";

export default function DocumentsPage() {
  const searchParams = useSearchParams();
  const favoritesOnly = searchParams.get("favorites") === "true";

  const [viewMode, setViewMode] = useState<"grid" | "table">("grid");
  const [currentFolder, setCurrentFolder] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [showNewFolder, setShowNewFolder] = useState(false);
  const [newFolderName, setNewFolderName] = useState("");
  const [moveDocId, setMoveDocId] = useState<string | null>(null);
  const [filterTagIds, setFilterTagIds] = useState<string[]>([]);

  // Confirm dialogs
  const [confirmDialog, setConfirmDialog] = useState<{
    title: string; description: string; action: () => Promise<void>; destructive?: boolean;
  } | null>(null);

  // Bulk selection
  const [selectionMode, setSelectionMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [bulkTagDialogOpen, setBulkTagDialogOpen] = useState(false);
  const [bulkTagIds, setBulkTagIds] = useState<string[]>([]);
  const [bulkMoveDialogOpen, setBulkMoveDialogOpen] = useState(false);

  // Share dialog
  const [shareDialogOpen, setShareDialogOpen] = useState(false);
  const [shareTab, setShareTab] = useState<"user" | "group">("user");
  const [sharePerms, setSharePerms] = useState<Array<{ id: string; user_id: string | null; group_id: string | null; username: string | null; email: string | null; group_name: string | null; permission: string }>>([]);
  const [shareUsers, setShareUsers] = useState<Array<{ id: string; username: string; email: string }>>([]);
  const [shareGroups, setShareGroups] = useState<Array<{ id: string; name: string; member_count: number }>>([]);
  const [shareUserId, setShareUserId] = useState("");
  const [shareGroupId, setShareGroupId] = useState("");
  const [sharePermLevel, setSharePermLevel] = useState("read");
  const [shareLoading, setShareLoading] = useState(false);

  const loadShareData = async (folderId: string) => {
    setShareLoading(true);
    try {
      const perms = await api<Array<{ id: string; user_id: string | null; group_id: string | null; username: string | null; email: string | null; group_name: string | null; permission: string }>>(`/api/folders/${folderId}/permissions`);
      setSharePerms(perms);
    } catch { setSharePerms([]); }
    try {
      const users = await api<Array<{ id: string; username: string; email: string }>>("/api/admin/users");
      setShareUsers(users);
    } catch { setShareUsers([]); }
    try {
      const groups = await api<Array<{ id: string; name: string; member_count: number }>>("/api/groups");
      setShareGroups(groups);
    } catch { setShareGroups([]); }
    setShareLoading(false);
  };

  const handleGrantPermission = async () => {
    if (!currentFolder) return;
    const body: Record<string, string> = { permission: sharePermLevel };
    if (shareTab === "user") {
      if (!shareUserId) return;
      body.user_id = shareUserId;
    } else {
      if (!shareGroupId) return;
      body.group_id = shareGroupId;
    }
    try {
      await api(`/api/folders/${currentFolder}/permissions`, {
        method: "POST",
        body,
      });
      toast.success("Berechtigung erteilt");
      setShareUserId(""); setShareGroupId("");
      await loadShareData(currentFolder);
    } catch {
      toast.error("Berechtigung konnte nicht erteilt werden");
    }
  };

  const handleRevokePermission = async (permId: string) => {
    if (!currentFolder) return;
    try {
      await api(`/api/folders/${currentFolder}/permissions/${permId}`, { method: "DELETE" });
      toast.success("Berechtigung entfernt");
      await loadShareData(currentFolder);
    } catch {
      toast.error("Berechtigung konnte nicht entfernt werden");
    }
  };

  const { data: docs, isLoading } = useDocuments(
    favoritesOnly
      ? { favoritesOnly: true, page }
      : { folderId: currentFolder, page, rootOnly: !currentFolder }
  );
  const { data: folders } = useFolders(currentFolder);
  const { data: breadcrumb } = useBreadcrumb(currentFolder);
  const createFolder = useCreateFolder();
  const deleteFolder = useDeleteFolder();
  const updateDoc = useUpdateDocument();
  const bulkAction = useBulkAction();

  const handleCreateFolder = async () => {
    if (!newFolderName.trim()) return;
    try {
      await createFolder.mutateAsync({ name: newFolderName.trim(), parent_id: currentFolder });
      setNewFolderName("");
      setShowNewFolder(false);
      toast.success(`Ordner "${newFolderName}" erstellt`);
    } catch {
      toast.error("Ordner konnte nicht erstellt werden");
    }
  };

  const handleDeleteFolder = (folderId: string, name: string) => {
    setConfirmDialog({
      title: "Ordner löschen?",
      description: `"${name}" wird gelöscht. Enthaltene Dokumente werden ins Stammverzeichnis verschoben.`,
      destructive: true,
      action: async () => {
        try {
          await deleteFolder.mutateAsync(folderId);
          toast.success(`Ordner "${name}" gelöscht`);
        } catch {
          toast.error("Ordner konnte nicht gelöscht werden (evtl. nicht leer)");
        }
      },
    });
  };

  const handleMoveDoc = async (targetFolderId: string | null) => {
    if (!moveDocId) return;
    try {
      if (targetFolderId) {
        await updateDoc.mutateAsync({ id: moveDocId, data: { folder_id: targetFolderId } });
      } else {
        await updateDoc.mutateAsync({ id: moveDocId, data: { clear_folder: true } as any });
      }
      setMoveDocId(null);
      toast.success("Dokument verschoben");
    } catch {
      toast.error("Verschieben fehlgeschlagen");
    }
  };

  const handleSelect = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleBulkDelete = () => {
    const count = selectedIds.size;
    setConfirmDialog({
      title: `${count} Dokument(e) löschen?`,
      description: `${count} ausgewählte Dokumente werden in den Papierkorb verschoben.`,
      destructive: true,
      action: async () => {
        try {
          await bulkAction.mutateAsync({ document_ids: Array.from(selectedIds), action: "delete" });
          toast.success(`${count} Dokument(e) gelöscht`);
          setSelectedIds(new Set());
          setSelectionMode(false);
        } catch {
          toast.error("Massenoperation fehlgeschlagen");
        }
      },
    });
  };

  const handleBulkFavorite = async () => {
    try {
      await bulkAction.mutateAsync({ document_ids: Array.from(selectedIds), action: "favorite" });
      toast.success("Favoriten aktualisiert");
      setSelectedIds(new Set());
      setSelectionMode(false);
    } catch {
      toast.error("Massenoperation fehlgeschlagen");
    }
  };

  const handleBulkTag = async () => {
    try {
      await bulkAction.mutateAsync({ document_ids: Array.from(selectedIds), action: "tag", tag_ids: bulkTagIds });
      toast.success("Tags aktualisiert");
      setBulkTagDialogOpen(false);
      setSelectedIds(new Set());
      setSelectionMode(false);
    } catch {
      toast.error("Massenoperation fehlgeschlagen");
    }
  };

  const handleBulkMove = async (folderId: string | null) => {
    try {
      await bulkAction.mutateAsync({ document_ids: Array.from(selectedIds), action: "move", folder_id: folderId || undefined });
      toast.success("Dokumente verschoben");
      setBulkMoveDialogOpen(false);
      setSelectedIds(new Set());
      setSelectionMode(false);
    } catch {
      toast.error("Massenoperation fehlgeschlagen");
    }
  };

  const exitSelectionMode = () => {
    setSelectionMode(false);
    setSelectedIds(new Set());
  };

  // All root folders for move dialog
  const { data: rootFolders } = useFolders(null);

  return (
    <AppShell>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">
              {favoritesOnly ? "Favoriten" : "Dokumente"}
            </h1>
            <p className="text-sm text-muted-foreground mt-1">
              {docs?.total ?? 0} Dokument(e){currentFolder ? " in diesem Ordner" : favoritesOnly ? " als Favorit markiert" : " gesamt"}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant={selectionMode ? "default" : "outline"}
              size="sm"
              onClick={() => selectionMode ? exitSelectionMode() : setSelectionMode(true)}
              className={selectionMode ? "bg-sky-600 hover:bg-sky-700" : ""}
            >
              {selectionMode ? <X className="mr-1 h-4 w-4" /> : <CheckSquare className="mr-1 h-4 w-4" />}
              {selectionMode ? "Abbrechen" : "Auswaehlen"}
            </Button>
            <Button variant="outline" size="icon" onClick={() => setViewMode(viewMode === "grid" ? "table" : "grid")}>
              {viewMode === "grid" ? <List className="h-4 w-4" /> : <Grid3X3 className="h-4 w-4" />}
            </Button>
            {!favoritesOnly && (
              <>
                <Button variant="outline" onClick={() => setShowNewFolder(true)}>
                  <FolderPlus className="mr-2 h-4 w-4" />
                  Neuer Ordner
                </Button>
                {currentFolder && (
                  <Button
                    variant="outline"
                    onClick={() => {
                      setShareDialogOpen(true);
                      loadShareData(currentFolder);
                    }}
                  >
                    <Share2 className="mr-2 h-4 w-4" />
                    Freigabe
                  </Button>
                )}
              </>
            )}
            <Button
              variant="outline"
              onClick={async () => {
                try {
                  const blob = await apiBlob("/api/export");
                  const url = URL.createObjectURL(blob);
                  const a = document.createElement("a");
                  a.href = url;
                  a.download = "dokumente-export.zip";
                  a.click();
                  URL.revokeObjectURL(url);
                  toast.success("Export gestartet");
                } catch {
                  toast.error("Export fehlgeschlagen");
                }
              }}
            >
              <Download className="mr-2 h-4 w-4" />
              Export
            </Button>
            <Link href="/documents/upload">
              <Button className="bg-sky-600 hover:bg-sky-700 shadow-md shadow-sky-600/25">
                <Upload className="mr-2 h-4 w-4" />
                Hochladen
              </Button>
            </Link>
          </div>
        </div>

        {/* Breadcrumb */}
        {!favoritesOnly && (
          <div className="flex items-center gap-1 text-sm">
            <button
              onClick={() => setCurrentFolder(null)}
              className={`flex items-center gap-1 px-2 py-1 rounded-md transition-colors ${!currentFolder ? "text-foreground font-semibold" : "text-muted-foreground hover:text-foreground hover:bg-muted"}`}
            >
              <Home className="h-3.5 w-3.5" />
              Alle Dokumente
            </button>
            {breadcrumb?.map((folder) => (
              <span key={folder.id} className="flex items-center gap-1">
                <ChevronRight className="h-3.5 w-3.5 text-muted-foreground/50" />
                <button
                  onClick={() => setCurrentFolder(folder.id)}
                  className={`px-2 py-1 rounded-md transition-colors ${currentFolder === folder.id ? "text-foreground font-semibold" : "text-muted-foreground hover:text-foreground hover:bg-muted"}`}
                >
                  {folder.name}
                </button>
              </span>
            ))}
          </div>
        )}

        {/* Tag filter */}
        <TagFilter selectedIds={filterTagIds} onChange={setFilterTagIds} />

        {/* Folders — drop targets for drag & drop */}
        {!favoritesOnly && folders && folders.length > 0 && (
          <div className="grid gap-4 grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6">
            {folders.map((folder) => (
              <FolderCard
                key={folder.id}
                folder={folder}
                onOpen={() => { setCurrentFolder(folder.id); setPage(1); }}
                onDelete={() => handleDeleteFolder(folder.id, folder.name)}
                onDropDocument={async (docId) => {
                  try {
                    await updateDoc.mutateAsync({ id: docId, data: { folder_id: folder.id } });
                    toast.success(`In "${folder.name}" verschoben`);
                  } catch {
                    toast.error("Verschieben fehlgeschlagen");
                  }
                }}
              />
            ))}
          </div>
        )}

        {/* Documents */}
        {(() => {
          const items = (docs?.items ?? []).filter((doc) =>
            filterTagIds.length === 0 || doc.tags.some((t) => filterTagIds.includes(t.id))
          );
          if (isLoading) return (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              {Array.from({ length: 8 }).map((_, i) => (
                <Skeleton key={i} className="h-24 rounded-xl" />
              ))}
            </div>
          );
          return viewMode === "grid"
            ? <DocumentGrid documents={items} onMoveDocument={selectionMode ? undefined : setMoveDocId} selectable={selectionMode} selectedIds={selectedIds} onSelect={handleSelect} />
            : <DocumentTable documents={items} onMoveDocument={selectionMode ? undefined : setMoveDocId} selectable={selectionMode} selectedIds={selectedIds} onSelect={handleSelect} />;
        })()}

        {/* Pagination */}
        {docs && docs.total > docs.page_size && (
          <div className="flex items-center justify-center gap-2">
            <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>
              Zurueck
            </Button>
            <span className="text-sm text-muted-foreground">
              Seite {page} von {Math.ceil(docs.total / docs.page_size)}
            </span>
            <Button variant="outline" size="sm" disabled={page >= Math.ceil(docs.total / docs.page_size)} onClick={() => setPage((p) => p + 1)}>
              Weiter
            </Button>
          </div>
        )}
      </div>

      {/* Bulk action bar */}
      {selectionMode && selectedIds.size > 0 && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 flex items-center gap-2 rounded-2xl bg-slate-900 dark:bg-slate-800 text-white px-5 py-3 shadow-2xl">
          <span className="text-sm font-medium mr-2">{selectedIds.size} ausgewaehlt</span>
          <Button size="sm" variant="ghost" className="text-white hover:bg-slate-700" onClick={handleBulkDelete}>
            <Trash2 className="mr-1 h-4 w-4" />
            Loeschen
          </Button>
          <Button size="sm" variant="ghost" className="text-white hover:bg-slate-700" onClick={() => setBulkMoveDialogOpen(true)}>
            <FolderInput className="mr-1 h-4 w-4" />
            Verschieben
          </Button>
          <Button size="sm" variant="ghost" className="text-white hover:bg-slate-700" onClick={handleBulkFavorite}>
            <Star className="mr-1 h-4 w-4" />
            Favorit
          </Button>
          <Button size="sm" variant="ghost" className="text-white hover:bg-slate-700" onClick={() => { setBulkTagIds([]); setBulkTagDialogOpen(true); }}>
            <Tag className="mr-1 h-4 w-4" />
            Taggen
          </Button>
        </div>
      )}

      {/* New Folder Dialog */}
      <Dialog open={showNewFolder} onOpenChange={setShowNewFolder}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Neuer Ordner</DialogTitle>
          </DialogHeader>
          <div className="py-2">
            <Input
              placeholder="Ordnername"
              value={newFolderName}
              onChange={(e) => setNewFolderName(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleCreateFolder()}
              className="h-11"
              autoFocus
            />
            {currentFolder && breadcrumb && (
              <p className="text-xs text-muted-foreground mt-2">
                Wird erstellt in: {breadcrumb.map((f) => f.name).join(" / ")}
              </p>
            )}
          </div>
          <DialogFooter>
            <DialogClose className="inline-flex items-center justify-center rounded-lg border border-border bg-background px-4 h-9 text-sm font-medium hover:bg-muted transition-colors cursor-pointer">
              Abbrechen
            </DialogClose>
            <Button onClick={handleCreateFolder} disabled={!newFolderName.trim() || createFolder.isPending} className="bg-sky-600 hover:bg-sky-700">
              {createFolder.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Erstellen
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Move Document Dialog */}
      <Dialog open={!!moveDocId} onOpenChange={(open) => !open && setMoveDocId(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Dokument verschieben</DialogTitle>
          </DialogHeader>
          <div className="space-y-1 py-2 max-h-64 overflow-auto">
            <button
              onClick={() => handleMoveDoc(null)}
              className="flex items-center gap-3 w-full rounded-lg px-3 py-2.5 text-sm hover:bg-muted transition-colors text-left"
            >
              <Home className="h-4 w-4 text-muted-foreground" />
              <span className="font-medium">Stammverzeichnis</span>
            </button>
            {rootFolders?.map((folder) => (
              <button
                key={folder.id}
                onClick={() => handleMoveDoc(folder.id)}
                className="flex items-center gap-3 w-full rounded-lg px-3 py-2.5 text-sm hover:bg-muted transition-colors text-left"
              >
                <FolderOpen className="h-4 w-4 text-amber-600" />
                <span className="font-medium">{folder.name}</span>
                <ArrowRight className="ml-auto h-3.5 w-3.5 text-muted-foreground" />
              </button>
            ))}
            {(!rootFolders || rootFolders.length === 0) && (
              <p className="text-sm text-muted-foreground text-center py-4">Keine Ordner vorhanden. Erstelle zuerst einen Ordner.</p>
            )}
          </div>
          <DialogFooter>
            <DialogClose className="inline-flex items-center justify-center rounded-lg border border-border bg-background px-4 h-9 text-sm font-medium hover:bg-muted transition-colors cursor-pointer">
              Abbrechen
            </DialogClose>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Bulk Tag Dialog */}
      <Dialog open={bulkTagDialogOpen} onOpenChange={setBulkTagDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Tags zuweisen</DialogTitle>
          </DialogHeader>
          <div className="py-2">
            <TagSelector selectedIds={bulkTagIds} onChange={setBulkTagIds} />
          </div>
          <DialogFooter>
            <DialogClose className="inline-flex items-center justify-center rounded-lg border border-border bg-background px-4 h-9 text-sm font-medium hover:bg-muted transition-colors cursor-pointer">
              Abbrechen
            </DialogClose>
            <Button onClick={handleBulkTag} disabled={bulkAction.isPending} className="bg-sky-600 hover:bg-sky-700">
              {bulkAction.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Tags zuweisen
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Bulk Move Dialog */}
      <Dialog open={bulkMoveDialogOpen} onOpenChange={setBulkMoveDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Dokumente verschieben</DialogTitle>
          </DialogHeader>
          <div className="space-y-1 py-2 max-h-64 overflow-auto">
            <button
              onClick={() => handleBulkMove(null)}
              className="flex items-center gap-3 w-full rounded-lg px-3 py-2.5 text-sm hover:bg-muted transition-colors text-left"
            >
              <Home className="h-4 w-4 text-muted-foreground" />
              <span className="font-medium">Stammverzeichnis</span>
            </button>
            {rootFolders?.map((folder) => (
              <button
                key={folder.id}
                onClick={() => handleBulkMove(folder.id)}
                className="flex items-center gap-3 w-full rounded-lg px-3 py-2.5 text-sm hover:bg-muted transition-colors text-left"
              >
                <FolderOpen className="h-4 w-4 text-amber-600" />
                <span className="font-medium">{folder.name}</span>
                <ArrowRight className="ml-auto h-3.5 w-3.5 text-muted-foreground" />
              </button>
            ))}
          </div>
          <DialogFooter>
            <DialogClose className="inline-flex items-center justify-center rounded-lg border border-border bg-background px-4 h-9 text-sm font-medium hover:bg-muted transition-colors cursor-pointer">
              Abbrechen
            </DialogClose>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Share (Freigabe) Dialog */}
      <Dialog open={shareDialogOpen} onOpenChange={setShareDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Ordner-Freigabe</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            {shareLoading ? (
              <div className="flex justify-center py-4">
                <Loader2 className="h-5 w-5 animate-spin text-sky-500" />
              </div>
            ) : (
              <>
                {/* Current permissions */}
                {sharePerms.length > 0 ? (
                  <div className="space-y-2">
                    <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Berechtigungen</p>
                    {sharePerms.map((p) => (
                      <div key={p.id} className="flex items-center justify-between rounded-lg border border-border px-3 py-2">
                        <div>
                          <p className="text-sm font-medium">
                            {p.group_name ? `Gruppe: ${p.group_name}` : (p.username || p.email)}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {p.permission === "read" ? "Lesen" : p.permission === "write" ? "Schreiben" : "Admin"}
                          </p>
                        </div>
                        <button
                          onClick={() => handleRevokePermission(p.id)}
                          className="p-1.5 rounded-lg text-destructive hover:bg-destructive/10 transition-colors cursor-pointer"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground text-center py-2">Noch keine Freigaben</p>
                )}

                {/* Tab toggle */}
                <div className="border-t border-border pt-4">
                  <div className="flex rounded-lg border border-border overflow-hidden mb-3">
                    <button
                      onClick={() => setShareTab("user")}
                      className={`flex-1 px-3 py-2 text-sm font-medium transition-colors cursor-pointer ${shareTab === "user" ? "bg-sky-600 text-white" : "hover:bg-muted"}`}
                    >
                      Benutzer
                    </button>
                    <button
                      onClick={() => setShareTab("group")}
                      className={`flex-1 px-3 py-2 text-sm font-medium transition-colors cursor-pointer ${shareTab === "group" ? "bg-sky-600 text-white" : "hover:bg-muted"}`}
                    >
                      Gruppe
                    </button>
                  </div>

                  <div className="space-y-3">
                    {shareTab === "user" ? (
                      <select
                        value={shareUserId}
                        onChange={(e) => setShareUserId(e.target.value)}
                        className="w-full h-10 rounded-lg border border-border bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                      >
                        <option value="">Benutzer waehlen...</option>
                        {shareUsers
                          .filter((u) => !sharePerms.some((p) => p.user_id === u.id))
                          .map((u) => (
                            <option key={u.id} value={u.id}>
                              {u.username} ({u.email})
                            </option>
                          ))}
                      </select>
                    ) : (
                      <select
                        value={shareGroupId}
                        onChange={(e) => setShareGroupId(e.target.value)}
                        className="w-full h-10 rounded-lg border border-border bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                      >
                        <option value="">Gruppe waehlen...</option>
                        {shareGroups
                          .filter((g) => !sharePerms.some((p) => p.group_id === g.id))
                          .map((g) => (
                            <option key={g.id} value={g.id}>
                              {g.name} ({g.member_count} Mitglieder)
                            </option>
                          ))}
                      </select>
                    )}
                    <select
                      value={sharePermLevel}
                      onChange={(e) => setSharePermLevel(e.target.value)}
                      className="w-full h-10 rounded-lg border border-border bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                    >
                      <option value="read">Lesen</option>
                      <option value="write">Schreiben</option>
                      <option value="admin">Admin</option>
                    </select>
                    <Button
                      onClick={handleGrantPermission}
                      disabled={shareTab === "user" ? !shareUserId : !shareGroupId}
                      className="bg-sky-600 hover:bg-sky-700 w-full"
                    >
                      <UserPlus className="mr-2 h-4 w-4" />
                      Berechtigung erteilen
                    </Button>
                  </div>
                </div>
              </>
            )}
          </div>
          <DialogFooter>
            <DialogClose className="inline-flex items-center justify-center rounded-lg border border-border bg-background px-4 h-9 text-sm font-medium hover:bg-muted transition-colors cursor-pointer">
              Schliessen
            </DialogClose>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Confirm Dialog */}
      <Dialog open={!!confirmDialog} onOpenChange={(open) => !open && setConfirmDialog(null)}>
        <DialogContent>
          <DialogHeader>
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-destructive/10 mb-2">
              <Trash2 className="h-6 w-6 text-destructive" />
            </div>
            <DialogTitle className="text-center">{confirmDialog?.title}</DialogTitle>
            <p className="text-sm text-muted-foreground text-center">{confirmDialog?.description}</p>
          </DialogHeader>
          <DialogFooter>
            <DialogClose className="inline-flex items-center justify-center rounded-lg border border-border bg-background px-4 h-9 text-sm font-medium hover:bg-muted transition-colors cursor-pointer">
              Abbrechen
            </DialogClose>
            <Button
              variant={confirmDialog?.destructive ? "destructive" : "default"}
              onClick={async () => {
                await confirmDialog?.action();
                setConfirmDialog(null);
              }}
            >
              Bestätigen
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AppShell>
  );
}
