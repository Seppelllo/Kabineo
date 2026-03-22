"use client";

import { useCallback, useState } from "react";
import { useDropzone } from "react-dropzone";
import { Upload, X, FileText, Loader2, CloudUpload } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { useUploadDocument, useMultiUpload } from "@/hooks/use-documents";
import { toast } from "sonner";

export function UploadDropzone() {
  const [files, setFiles] = useState<{ file: File; title: string; description: string }[]>([]);
  const [multiMode, setMultiMode] = useState(false);
  const [multiTitle, setMultiTitle] = useState("");
  const upload = useUploadDocument();
  const multiUpload = useMultiUpload();

  const onDrop = useCallback((acceptedFiles: File[]) => {
    setFiles((prev) => [
      ...prev,
      ...acceptedFiles.map((file) => ({
        file,
        title: file.name.replace(/\.[^/.]+$/, ""),
        description: "",
      })),
    ]);
  }, []);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({ onDrop, multiple: true });

  const removeFile = (index: number) => setFiles((prev) => prev.filter((_, i) => i !== index));
  const updateFile = (index: number, field: "title" | "description", value: string) => {
    setFiles((prev) => prev.map((f, i) => (i === index ? { ...f, [field]: value } : f)));
  };

  const handleUpload = async () => {
    if (multiMode && files.length > 1) {
      const formData = new FormData();
      for (const item of files) formData.append("files", item.file);
      formData.append("title", multiTitle || files[0].title);
      try {
        await multiUpload.mutateAsync(formData);
        toast.success("Mehrseitiges Dokument hochgeladen");
        setFiles([]);
        setMultiTitle("");
      } catch {
        toast.error("Upload fehlgeschlagen");
      }
    } else {
      for (const item of files) {
        const formData = new FormData();
        formData.append("file", item.file);
        formData.append("title", item.title);
        if (item.description) formData.append("description", item.description);
        try {
          const result = await upload.mutateAsync(formData);
          const dupOf = (result as any)?._duplicate_of;
          if (dupOf) {
            toast.warning(`"${item.title}" hochgeladen — Duplikat von "${dupOf.title}" erkannt`, { duration: 8000 });
          } else {
            toast.success(`"${item.title}" hochgeladen`);
          }
        } catch {
          toast.error(`Fehler beim Upload von "${item.title}"`);
        }
      }
      setFiles([]);
    }
  };

  const isPending = upload.isPending || multiUpload.isPending;

  return (
    <div className="space-y-6">
      <div
        {...getRootProps()}
        className={`relative overflow-hidden border-2 border-dashed rounded-2xl p-16 text-center cursor-pointer transition-all duration-300 ${
          isDragActive ? "border-sky-500 bg-sky-50 dark:bg-sky-900/20 scale-[1.01]" : "border-slate-200 dark:border-slate-700 hover:border-sky-400 hover:bg-sky-50/50 dark:hover:bg-sky-900/10"
        }`}
      >
        <input {...getInputProps()} />
        <div className={`mx-auto w-20 h-20 rounded-3xl flex items-center justify-center mb-5 transition-colors ${isDragActive ? "bg-sky-100 dark:bg-sky-900/30" : "bg-slate-100 dark:bg-muted"}`}>
          <CloudUpload className={`h-10 w-10 transition-colors ${isDragActive ? "text-sky-600" : "text-slate-400"}`} />
        </div>
        <p className="text-lg font-semibold">{isDragActive ? "Dateien hier ablegen..." : "Dateien hierher ziehen"}</p>
        <p className="mt-2 text-sm text-muted-foreground">oder <span className="text-sky-600 font-medium">klicken zum Auswaehlen</span></p>
        <p className="mt-1 text-xs text-muted-foreground/60">PDF, Bilder, Office-Dokumente, Archive</p>
      </div>

      {files.length > 0 && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="font-semibold">{files.length} Datei(en) bereit</h3>
            <Button variant="ghost" size="sm" onClick={() => setFiles([])} className="text-muted-foreground">Alle entfernen</Button>
          </div>

          {/* Multi-mode toggle */}
          {files.length > 1 && (
            <Card className="border-0 shadow-sm bg-sky-50 dark:bg-sky-900/20">
              <CardContent className="p-4">
                <label className="flex items-center gap-3 cursor-pointer">
                  <input type="checkbox" checked={multiMode} onChange={(e) => setMultiMode(e.target.checked)} className="h-4 w-4 rounded border-sky-300 text-sky-600 focus:ring-sky-500" />
                  <div>
                    <span className="text-sm font-medium">Als einzelnes Dokument (mehrseitig)</span>
                    <p className="text-xs text-muted-foreground mt-0.5">Alle Dateien werden zu einem Dokument zusammengefasst</p>
                  </div>
                </label>
                {multiMode && (
                  <div className="mt-3">
                    <Label className="text-xs text-muted-foreground">Titel des Dokuments</Label>
                    <Input value={multiTitle} onChange={(e) => setMultiTitle(e.target.value)} placeholder="Dokumenttitel" className="mt-1 h-10" />
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          {!multiMode && files.map((item, index) => (
            <Card key={index} className="border-0 shadow-md bg-white dark:bg-card">
              <CardContent className="p-4">
                <div className="flex items-start gap-4">
                  <div className="rounded-xl bg-sky-50 dark:bg-sky-900/20 p-2.5 mt-1"><FileText className="h-5 w-5 text-sky-600" /></div>
                  <div className="flex-1 space-y-3">
                    <div><Label className="text-xs text-muted-foreground">Titel</Label><Input value={item.title} onChange={(e) => updateFile(index, "title", e.target.value)} className="mt-1 h-10" /></div>
                    <div><Label className="text-xs text-muted-foreground">Beschreibung</Label><Input value={item.description} onChange={(e) => updateFile(index, "description", e.target.value)} placeholder="Optional" className="mt-1 h-10" /></div>
                    <p className="text-xs text-muted-foreground">{item.file.name} · {(item.file.size / 1024 / 1024).toFixed(2)} MB</p>
                  </div>
                  <Button variant="ghost" size="icon" onClick={() => removeFile(index)} className="text-muted-foreground hover:text-destructive"><X className="h-4 w-4" /></Button>
                </div>
              </CardContent>
            </Card>
          ))}

          {multiMode && (
            <div className="space-y-2">
              {files.map((item, index) => (
                <div key={index} className="flex items-center gap-3 rounded-xl bg-white dark:bg-card px-4 py-3 shadow-sm">
                  <FileText className="h-4 w-4 text-sky-600" />
                  <span className="text-sm flex-1 truncate">{item.file.name}</span>
                  <span className="text-xs text-muted-foreground">{(item.file.size / 1024 / 1024).toFixed(2)} MB</span>
                  <Button variant="ghost" size="icon" onClick={() => removeFile(index)} className="h-7 w-7 text-muted-foreground hover:text-destructive"><X className="h-3.5 w-3.5" /></Button>
                </div>
              ))}
            </div>
          )}

          <Button onClick={handleUpload} disabled={isPending} size="lg" className="w-full h-12 bg-sky-600 hover:bg-sky-700 font-semibold shadow-lg shadow-sky-600/25">
            {isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Upload className="mr-2 h-4 w-4" />}
            {multiMode ? "Als mehrseitiges Dokument hochladen" : `${files.length} Datei(en) hochladen`}
          </Button>
        </div>
      )}
    </div>
  );
}
