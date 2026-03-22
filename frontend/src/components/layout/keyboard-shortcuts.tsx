"use client";

import { useEffect, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

const SHORTCUTS = [
  { keys: ["?"], description: "Tastenkuerzel anzeigen" },
  { keys: ["Esc"], description: "Dialog / Lightbox schliessen" },
  { keys: ["\u2318", "K"], description: "Suche oeffnen" },
  { keys: ["\u2190", "\u2192"], description: "Dokumentliste navigieren" },
  { keys: ["F"], description: "Favorit umschalten (fokussiertes Dokument)" },
  { keys: ["Del"], description: "Ausgewaehlte loeschen (Auswahlmodus)" },
];

interface KeyboardShortcutsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function KeyboardShortcutsDialog({ open, onOpenChange }: KeyboardShortcutsDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>Tastenkuerzel</DialogTitle>
        </DialogHeader>
        <div className="space-y-2 py-2">
          {SHORTCUTS.map((s, i) => (
            <div key={i} className="flex items-center justify-between py-1.5">
              <span className="text-sm text-muted-foreground">{s.description}</span>
              <div className="flex items-center gap-1">
                {s.keys.map((key, j) => (
                  <kbd
                    key={j}
                    className="inline-flex h-6 min-w-6 items-center justify-center rounded border border-border bg-muted px-1.5 text-xs font-medium text-muted-foreground"
                  >
                    {key}
                  </kbd>
                ))}
              </div>
            </div>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  );
}

export function useKeyboardShortcuts() {
  const [showHelp, setShowHelp] = useState(false);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      const isInput =
        target.tagName === "INPUT" ||
        target.tagName === "TEXTAREA" ||
        target.tagName === "SELECT" ||
        target.isContentEditable;

      // ? key to show help (not in inputs)
      if (e.key === "?" && !isInput) {
        e.preventDefault();
        setShowHelp(true);
        return;
      }

      // Escape to close any dialog (handled by dialogs themselves, but we ensure help closes)
      if (e.key === "Escape") {
        setShowHelp(false);
        return;
      }
    };

    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);

  return { showHelp, setShowHelp };
}
