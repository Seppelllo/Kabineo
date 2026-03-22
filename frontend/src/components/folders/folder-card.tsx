"use client";

import { useState, useRef, useEffect } from "react";
import { FolderOpen, MoreVertical, Trash2, Pencil } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useUpdateFolder, type Folder } from "@/hooks/use-folders";
import { toast } from "sonner";

interface Props {
  folder: Folder;
  onOpen: () => void;
  onDelete: () => void;
  onDropDocument: (docId: string) => void;
}

export function FolderCard({ folder, onOpen, onDelete, onDropDocument }: Props) {
  const [dragOver, setDragOver] = useState(false);
  const [renaming, setRenaming] = useState(false);
  const [renameValue, setRenameValue] = useState(folder.name);
  const inputRef = useRef<HTMLInputElement>(null);
  const updateFolder = useUpdateFolder();

  useEffect(() => {
    if (renaming) {
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [renaming]);

  const handleRename = async () => {
    const trimmed = renameValue.trim();
    if (!trimmed || trimmed === folder.name) {
      setRenaming(false);
      setRenameValue(folder.name);
      return;
    }
    try {
      await updateFolder.mutateAsync({ id: folder.id, name: trimmed });
      toast.success(`Ordner umbenannt zu "${trimmed}"`);
      setRenaming(false);
    } catch {
      toast.error("Umbenennen fehlgeschlagen");
      setRenameValue(folder.name);
      setRenaming(false);
    }
  };

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={renaming ? undefined : onOpen}
      onKeyDown={(e) => { if (e.key === "Enter" && !renaming) onOpen(); }}
      className="group text-left cursor-pointer"
      onDragOver={(e) => {
        e.preventDefault();
        e.dataTransfer.dropEffect = "move";
        setDragOver(true);
      }}
      onDragEnter={(e) => {
        e.preventDefault();
        setDragOver(true);
      }}
      onDragLeave={() => setDragOver(false)}
      onDrop={(e) => {
        e.preventDefault();
        setDragOver(false);
        const docId = e.dataTransfer.getData("text/plain");
        if (docId) onDropDocument(docId);
      }}
    >
      <div className="relative">
        <div className={`relative rounded-xl pt-3 pb-8 px-4 shadow-sm transition-all duration-200 ${
          dragOver
            ? "bg-gradient-to-b from-sky-400 to-sky-500 shadow-lg shadow-sky-500/30 scale-105 ring-2 ring-sky-400 ring-offset-2"
            : "bg-gradient-to-b from-amber-400 to-amber-500 dark:from-amber-500 dark:to-amber-600 group-hover:shadow-lg group-hover:-translate-y-1"
        }`}>
          <div className={`absolute -top-2 left-3 w-12 h-4 rounded-t-lg transition-colors ${
            dragOver ? "bg-sky-400" : "bg-amber-400 dark:bg-amber-500"
          }`} />
          <div className={`rounded-lg p-4 min-h-[60px] flex items-center justify-center transition-colors ${
            dragOver ? "bg-sky-50 dark:bg-sky-100" : "bg-amber-50 dark:bg-amber-100"
          }`}>
            {dragOver ? (
              <p className="text-sm font-semibold text-sky-600">Hier ablegen</p>
            ) : (
              <FolderOpen className="h-8 w-8 text-amber-500/50" />
            )}
          </div>
        </div>
        <DropdownMenu>
          <DropdownMenuTrigger
            className="absolute top-1 right-1 opacity-0 group-hover:opacity-100 transition-opacity p-1 rounded-lg bg-black/20 hover:bg-black/40 cursor-pointer outline-none"
            onClick={(e) => e.stopPropagation()}
          >
            <MoreVertical className="h-3.5 w-3.5 text-white" />
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem
              onClick={(e) => {
                e.stopPropagation();
                setRenameValue(folder.name);
                setRenaming(true);
              }}
            >
              <Pencil className="h-4 w-4 mr-2" />
              Umbenennen
            </DropdownMenuItem>
            <DropdownMenuItem
              onClick={(e) => { e.stopPropagation(); onDelete(); }}
              className="text-destructive"
            >
              <Trash2 className="h-4 w-4 mr-2" />
              Loeschen
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
      {renaming ? (
        <div className="mt-2" onClick={(e) => e.stopPropagation()}>
          <input
            ref={inputRef}
            value={renameValue}
            onChange={(e) => setRenameValue(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") handleRename();
              if (e.key === "Escape") { setRenaming(false); setRenameValue(folder.name); }
            }}
            onBlur={handleRename}
            className="w-full text-sm font-medium text-center bg-transparent border-b-2 border-sky-500 outline-none px-1 py-0.5"
          />
        </div>
      ) : (
        <p className={`mt-2 text-sm font-medium truncate text-center transition-colors ${
          dragOver ? "text-sky-600" : "group-hover:text-sky-700 dark:group-hover:text-sky-400"
        }`}>
          {folder.name}
        </p>
      )}
    </div>
  );
}
