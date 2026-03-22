"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { FileText, FileImage, FileSpreadsheet, File, FileArchive, FolderInput, MoreVertical, Star, Download, Eye } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useToggleFavorite, type Document } from "@/hooks/use-documents";
import { apiBlob } from "@/lib/api";
import { toast } from "sonner";

function getFileConfig(mimeType: string) {
  if (mimeType.startsWith("image/")) return { icon: FileImage, color: "text-pink-600", bg: "bg-pink-100 dark:bg-pink-900/30" };
  if (mimeType.includes("pdf")) return { icon: FileText, color: "text-red-600", bg: "bg-red-100 dark:bg-red-900/30" };
  if (mimeType.includes("spreadsheet") || mimeType.includes("excel")) return { icon: FileSpreadsheet, color: "text-emerald-600", bg: "bg-emerald-100 dark:bg-emerald-900/30" };
  if (mimeType.includes("zip") || mimeType.includes("archive")) return { icon: FileArchive, color: "text-amber-600", bg: "bg-amber-100 dark:bg-amber-900/30" };
  return { icon: File, color: "text-sky-600", bg: "bg-sky-100 dark:bg-sky-900/30" };
}

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString("de-DE", { day: "2-digit", month: "2-digit", year: "numeric" });
}

function useThumbnail(docId: string) {
  const [url, setUrl] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let objectUrl: string | null = null;
    let retryTimeout: ReturnType<typeof setTimeout>;

    const load = (attempt = 0) => {
      apiBlob(`/api/documents/${docId}/thumbnail`)
        .then((blob) => {
          if (blob.size > 0) {
            objectUrl = URL.createObjectURL(blob);
            setUrl(objectUrl);
          } else {
            throw new Error("empty");
          }
        })
        .catch(() => {
          // Retry once after 3 seconds (thumbnail might still be generating)
          if (attempt < 1) {
            retryTimeout = setTimeout(() => load(attempt + 1), 3000);
          } else {
            setFailed(true);
          }
        });
    };

    load();
    return () => {
      if (objectUrl) URL.revokeObjectURL(objectUrl);
      clearTimeout(retryTimeout);
    };
  }, [docId]);

  return { url, failed };
}

interface Props {
  doc: Document;
  onMove?: (id: string) => void;
  selectable?: boolean;
  selected?: boolean;
  onSelect?: (id: string) => void;
}

export function DocumentCard({ doc, onMove, selectable, selected, onSelect }: Props) {
  const { icon: Icon, color, bg } = getFileConfig(doc.mime_type);
  const toggleFavorite = useToggleFavorite();
  const { url: thumbUrl, failed: thumbFailed } = useThumbnail(doc.id);

  const handleFavorite = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    try {
      await toggleFavorite.mutateAsync({ id: doc.id, is_favorite: !doc.is_favorite });
    } catch {
      toast.error("Fehler");
    }
  };

  return (
    <Card
      draggable
      onDragStart={(e) => {
        e.dataTransfer.setData("text/plain", doc.id);
        e.dataTransfer.effectAllowed = "move";
        (e.currentTarget as HTMLElement).style.opacity = "0.5";
      }}
      onDragEnd={(e) => {
        (e.currentTarget as HTMLElement).style.opacity = "1";
      }}
      className={`group cursor-grab active:cursor-grabbing border-0 shadow-sm hover:shadow-xl hover:-translate-y-1 transition-all duration-200 bg-white dark:bg-card overflow-hidden relative ${selected ? "ring-2 ring-sky-500" : ""}`}
    >
      {/* Selection checkbox */}
      {selectable && (
        <div className="absolute top-2 left-2 z-10">
          <input
            type="checkbox"
            checked={selected}
            onChange={() => onSelect?.(doc.id)}
            className="h-4 w-4 rounded border-white/80 text-sky-600 focus:ring-sky-500 cursor-pointer shadow"
            onClick={(e) => e.stopPropagation()}
          />
        </div>
      )}

      {/* Favorite star */}
      <button
        onClick={handleFavorite}
        className="absolute top-2 right-2 z-10 p-1 rounded-lg bg-black/20 hover:bg-black/40 backdrop-blur-sm transition-colors cursor-pointer"
      >
        <Star className={`h-3.5 w-3.5 ${doc.is_favorite ? "fill-amber-400 text-amber-400" : "text-white/80"}`} />
      </button>

      <Link href={`/documents/${doc.id}`}>
        {/* Thumbnail area */}
        <div className="aspect-[3/4] bg-slate-100 dark:bg-muted relative overflow-hidden">
          {thumbUrl ? (
            <img
              src={thumbUrl}
              alt={doc.title}
              className="w-full h-full object-cover"
            />
          ) : thumbFailed ? (
            <div className={`w-full h-full flex items-center justify-center ${bg}`}>
              <Icon className={`h-16 w-16 ${color} opacity-40`} />
            </div>
          ) : (
            <div className="w-full h-full flex items-center justify-center">
              <div className="h-6 w-6 animate-spin rounded-full border-2 border-sky-500 border-t-transparent" />
            </div>
          )}

          {/* Hover overlay */}
          <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-colors flex items-center justify-center">
            <Eye className="h-8 w-8 text-white opacity-0 group-hover:opacity-100 transition-opacity drop-shadow-lg" />
          </div>
        </div>

        {/* Info area */}
        <div className="p-3">
          <h3 className="font-semibold text-sm truncate group-hover:text-sky-700 dark:group-hover:text-sky-400 transition-colors">
            {doc.title}
          </h3>
          <div className="flex items-center gap-1.5 mt-1 text-[11px] text-muted-foreground">
            <span>{formatDate(doc.created_at)}</span>
          </div>
          {doc.correspondent_name && (
            <p className="text-[11px] text-muted-foreground mt-0.5 truncate">{doc.correspondent_name}</p>
          )}
          {doc.tags.length > 0 && (
            <div className="flex flex-wrap gap-1 mt-2">
              {doc.tags.slice(0, 3).map((tag) => (
                <Badge key={tag.id} variant="secondary" className="text-[10px] px-1.5 py-0 h-[18px] font-medium border"
                  style={{ backgroundColor: tag.color + "12", color: tag.color, borderColor: tag.color + "25" }}>
                  {tag.name}
                </Badge>
              ))}
            </div>
          )}
        </div>
      </Link>

      {/* Action buttons — visible on hover */}
      {onMove && (
        <div className="absolute bottom-12 right-2 opacity-0 group-hover:opacity-100 transition-opacity">
          <DropdownMenu>
            <DropdownMenuTrigger className="p-1.5 rounded-lg bg-white/90 dark:bg-card/90 shadow-md hover:bg-white dark:hover:bg-card cursor-pointer outline-none">
              <MoreVertical className="h-4 w-4 text-muted-foreground" />
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => onMove(doc.id)}>
                <FolderInput className="h-4 w-4 mr-2" />
                Verschieben
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      )}
    </Card>
  );
}
