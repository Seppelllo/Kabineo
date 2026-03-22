"use client";

import { DocumentCard } from "./document-card";
import type { Document } from "@/hooks/use-documents";
import { FileText, Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import Link from "next/link";

interface Props {
  documents: Document[];
  onMoveDocument?: (id: string) => void;
  selectable?: boolean;
  selectedIds?: Set<string>;
  onSelect?: (id: string) => void;
}

export function DocumentGrid({ documents, onMoveDocument, selectable, selectedIds, onSelect }: Props) {
  if (documents.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center">
        <div className="rounded-2xl bg-slate-100 p-5 mb-5">
          <FileText className="h-10 w-10 text-slate-400" />
        </div>
        <p className="text-lg font-medium">Keine Dokumente</p>
        <p className="text-sm text-muted-foreground mt-1 max-w-sm">
          Lade dein erstes Dokument hoch, um loszulegen
        </p>
        <Link href="/documents/upload" className="mt-4">
          <Button className="bg-sky-600 hover:bg-sky-700">
            <Upload className="mr-2 h-4 w-4" />
            Dokument hochladen
          </Button>
        </Link>
      </div>
    );
  }

  return (
    <div className="grid gap-4 grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6">
      {documents.map((doc) => (
        <DocumentCard
          key={doc.id}
          doc={doc}
          onMove={onMoveDocument}
          selectable={selectable}
          selected={selectedIds?.has(doc.id)}
          onSelect={onSelect}
        />
      ))}
    </div>
  );
}
