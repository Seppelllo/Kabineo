"use client";

import { AppShell } from "@/components/layout/app-shell";
import { UploadDropzone } from "@/components/documents/upload-dropzone";

export default function UploadPage() {
  return (
    <AppShell>
      <div className="max-w-3xl mx-auto space-y-6">
        <div>
          <h1 className="text-2xl font-bold">Dokumente hochladen</h1>
          <p className="text-muted-foreground">
            Ziehe Dateien in den Bereich oder klicke zum Auswählen
          </p>
        </div>
        <UploadDropzone />
      </div>
    </AppShell>
  );
}
