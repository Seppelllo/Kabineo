"use client";

import { useState } from "react";
import { useTags, useCreateTag } from "@/hooks/use-tags";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { X, Plus, Tag, Loader2 } from "lucide-react";
import { toast } from "sonner";

const TAG_COLORS = [
  "#0ea5e9", "#8b5cf6", "#10b981", "#f59e0b", "#ef4444",
  "#ec4899", "#06b6d4", "#84cc16", "#f97316", "#6366f1",
  "#14b8a6", "#a855f7", "#e11d48", "#0284c7", "#65a30d",
  "#d946ef", "#0891b2", "#ca8a04", "#dc2626", "#7c3aed",
];

function pickColor(existingColors: string[]): string {
  const unused = TAG_COLORS.filter((c) => !existingColors.includes(c));
  if (unused.length > 0) return unused[Math.floor(Math.random() * unused.length)];
  // All used — generate a random hue
  const hue = Math.floor(Math.random() * 360);
  return `hsl(${hue}, 70%, 50%)`;
}

interface TagSelectorProps {
  selectedIds: string[];
  onChange: (ids: string[]) => void;
}

export function TagSelector({ selectedIds, onChange }: TagSelectorProps) {
  const { data: tags } = useTags();
  const createTag = useCreateTag();
  const [showCreate, setShowCreate] = useState(false);
  const [newName, setNewName] = useState("");

  const toggle = (id: string) => {
    onChange(
      selectedIds.includes(id)
        ? selectedIds.filter((t) => t !== id)
        : [...selectedIds, id],
    );
  };

  const handleCreate = async () => {
    if (!newName.trim()) return;
    const existingColors = tags?.map((t) => t.color) ?? [];
    const color = pickColor(existingColors);
    try {
      const tag = await createTag.mutateAsync({ name: newName.trim(), color });
      onChange([...selectedIds, tag.id]);
      setNewName("");
      setShowCreate(false);
      toast.success(`Tag "${tag.name}" erstellt`);
    } catch {
      toast.error("Tag existiert bereits oder konnte nicht erstellt werden");
    }
  };

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-1.5">
        {tags?.map((tag) => {
          const selected = selectedIds.includes(tag.id);
          return (
            <button
              key={tag.id}
              type="button"
              onClick={() => toggle(tag.id)}
              className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-medium border transition-all cursor-pointer ${
                selected
                  ? "ring-2 ring-offset-1 shadow-sm"
                  : "opacity-60 hover:opacity-100"
              }`}
              style={{
                backgroundColor: tag.color + (selected ? "20" : "10"),
                color: tag.color,
                borderColor: tag.color + (selected ? "50" : "20"),
              }}
            >
              {tag.name}
              {selected && <X className="h-3 w-3" />}
            </button>
          );
        })}
      </div>

      {showCreate ? (
        <div className="flex items-center gap-2">
          <Input
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            placeholder="Tag-Name eingeben..."
            className="h-9 text-sm flex-1"
            onKeyDown={(e) => {
              if (e.key === "Enter") { e.preventDefault(); handleCreate(); }
              if (e.key === "Escape") setShowCreate(false);
            }}
            autoFocus
          />
          <Button
            type="button"
            size="sm"
            onClick={handleCreate}
            disabled={!newName.trim() || createTag.isPending}
            className="h-9 bg-sky-600 hover:bg-sky-700 shrink-0"
          >
            {createTag.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : "Hinzufügen"}
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => { setShowCreate(false); setNewName(""); }}
            className="h-9 shrink-0"
          >
            Abbrechen
          </Button>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => setShowCreate(true)}
          className="inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-medium border border-dashed border-muted-foreground/30 text-muted-foreground hover:border-sky-400 hover:text-sky-600 transition-colors cursor-pointer"
        >
          <Plus className="h-3 w-3" />
          Neuer Tag
        </button>
      )}
    </div>
  );
}

interface TagFilterProps {
  selectedIds: string[];
  onChange: (ids: string[]) => void;
}

export function TagFilter({ selectedIds, onChange }: TagFilterProps) {
  const { data: tags } = useTags();

  if (!tags || tags.length === 0) return null;

  const toggle = (id: string) => {
    onChange(
      selectedIds.includes(id)
        ? selectedIds.filter((t) => t !== id)
        : [...selectedIds, id],
    );
  };

  return (
    <div className="flex items-center gap-2 flex-wrap">
      <Tag className="h-3.5 w-3.5 text-muted-foreground" />
      {tags.map((tag) => {
        const selected = selectedIds.includes(tag.id);
        return (
          <button
            key={tag.id}
            type="button"
            onClick={() => toggle(tag.id)}
            className={`inline-flex items-center rounded-full px-2.5 py-1 text-[11px] font-medium border transition-all cursor-pointer ${
              selected ? "shadow-sm" : "opacity-50 hover:opacity-80"
            }`}
            style={{
              backgroundColor: tag.color + (selected ? "20" : "08"),
              color: tag.color,
              borderColor: tag.color + (selected ? "40" : "15"),
            }}
          >
            {tag.name}
          </button>
        );
      })}
      {selectedIds.length > 0 && (
        <button
          type="button"
          onClick={() => onChange([])}
          className="text-[11px] text-muted-foreground hover:text-foreground cursor-pointer"
        >
          Zurücksetzen
        </button>
      )}
    </div>
  );
}
