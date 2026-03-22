"use client";

import Link from "next/link";
import { FileText, FileImage, File, FolderInput, Star } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useToggleFavorite, type Document } from "@/hooks/use-documents";
import { toast } from "sonner";

function getFileIcon(mimeType: string) {
  if (mimeType.startsWith("image/")) return FileImage;
  if (mimeType.includes("pdf") || mimeType.includes("text")) return FileText;
  return File;
}

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

interface Props {
  documents: Document[];
  onMoveDocument?: (id: string) => void;
  selectable?: boolean;
  selectedIds?: Set<string>;
  onSelect?: (id: string) => void;
}

export function DocumentTable({ documents, onMoveDocument, selectable, selectedIds, onSelect }: Props) {
  const toggleFavorite = useToggleFavorite();

  const handleFavorite = async (id: string, currentFav: boolean) => {
    try {
      await toggleFavorite.mutateAsync({ id, is_favorite: !currentFav });
      toast.success(currentFav ? "Aus Favoriten entfernt" : "Zu Favoriten hinzugefuegt");
    } catch {
      toast.error("Fehler beim Aktualisieren");
    }
  };

  return (
    <div className="rounded-xl border-0 shadow-sm bg-white dark:bg-card overflow-hidden">
      <Table>
        <TableHeader>
          <TableRow className="bg-slate-50/80 dark:bg-muted/50">
            {selectable && <TableHead className="w-10" />}
            <TableHead>Name</TableHead>
            <TableHead>Typ</TableHead>
            <TableHead>Groesse</TableHead>
            <TableHead>Tags</TableHead>
            <TableHead>Datum</TableHead>
            <TableHead className="w-10" />
            {onMoveDocument && <TableHead className="w-10" />}
          </TableRow>
        </TableHeader>
        <TableBody>
          {documents.map((doc) => {
            const Icon = getFileIcon(doc.mime_type);
            return (
              <TableRow key={doc.id} className={`cursor-pointer hover:bg-sky-50/50 dark:hover:bg-muted/30 ${selectedIds?.has(doc.id) ? "bg-sky-50 dark:bg-sky-900/20" : ""}`}>
                {selectable && (
                  <TableCell>
                    <input
                      type="checkbox"
                      checked={selectedIds?.has(doc.id) || false}
                      onChange={() => onSelect?.(doc.id)}
                      className="h-4 w-4 rounded border-slate-300 text-sky-600 focus:ring-sky-500 cursor-pointer"
                    />
                  </TableCell>
                )}
                <TableCell>
                  <Link href={`/documents/${doc.id}`} className="flex items-center gap-2 hover:text-sky-700">
                    <Icon className="h-4 w-4 text-muted-foreground" />
                    <span className="font-medium text-sm">{doc.title}</span>
                  </Link>
                </TableCell>
                <TableCell className="text-muted-foreground text-sm">
                  {doc.mime_type.split("/")[1]?.toUpperCase()}
                </TableCell>
                <TableCell className="text-muted-foreground text-sm">
                  {formatSize(doc.file_size)}
                </TableCell>
                <TableCell>
                  <div className="flex gap-1">
                    {doc.tags.map((tag) => (
                      <Badge key={tag.id} variant="secondary" className="text-[10px] px-1.5 py-0 h-[18px] border"
                        style={{ backgroundColor: tag.color + "12", color: tag.color, borderColor: tag.color + "25" }}>
                        {tag.name}
                      </Badge>
                    ))}
                  </div>
                </TableCell>
                <TableCell className="text-muted-foreground text-sm">
                  {new Date(doc.created_at).toLocaleDateString("de-DE")}
                </TableCell>
                <TableCell>
                  <button
                    onClick={() => handleFavorite(doc.id, !!doc.is_favorite)}
                    className="p-1 rounded hover:bg-muted transition-colors cursor-pointer"
                  >
                    <Star className={`h-3.5 w-3.5 ${doc.is_favorite ? "fill-amber-400 text-amber-400" : "text-muted-foreground/30"}`} />
                  </button>
                </TableCell>
                {onMoveDocument && (
                  <TableCell>
                    <Button variant="ghost" size="icon" onClick={() => onMoveDocument(doc.id)} className="h-7 w-7">
                      <FolderInput className="h-3.5 w-3.5 text-muted-foreground" />
                    </Button>
                  </TableCell>
                )}
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </div>
  );
}
