"use client";

import { useState } from "react";
import { AppShell } from "@/components/layout/app-shell";
import { useCorrespondents, useCreateCorrespondent, useDeleteCorrespondent } from "@/hooks/use-correspondents";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogClose,
} from "@/components/ui/dialog";
import { Users, Plus, Trash2, AlertTriangle } from "lucide-react";
import { toast } from "sonner";

export default function CorrespondentsPage() {
  const { data: correspondents, isLoading } = useCorrespondents();
  const createCorrespondent = useCreateCorrespondent();
  const deleteCorrespondent = useDeleteCorrespondent();

  const [createOpen, setCreateOpen] = useState(false);
  const [name, setName] = useState("");
  const [matchPattern, setMatchPattern] = useState("");
  const [deleteTarget, setDeleteTarget] = useState<{ id: string; name: string } | null>(null);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    try {
      await createCorrespondent.mutateAsync({
        name: name.trim(),
        match_pattern: matchPattern.trim() || undefined,
      });
      toast.success("Korrespondent erstellt");
      setName("");
      setMatchPattern("");
      setCreateOpen(false);
    } catch {
      toast.error("Korrespondent konnte nicht erstellt werden");
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    try {
      await deleteCorrespondent.mutateAsync(deleteTarget.id);
      toast.success(`"${deleteTarget.name}" geloescht`);
    } catch {
      toast.error("Loeschen fehlgeschlagen");
    }
    setDeleteTarget(null);
  };

  return (
    <AppShell>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Korrespondenten</h1>
            <p className="text-sm text-muted-foreground mt-1">
              Verwalte Absender und Empfaenger deiner Dokumente
            </p>
          </div>
          <Button
            onClick={() => setCreateOpen(true)}
            className="bg-sky-600 hover:bg-sky-700 shadow-md shadow-sky-600/25"
          >
            <Plus className="mr-2 h-4 w-4" />
            Neuer Korrespondent
          </Button>
        </div>

        <Card className="border-0 shadow-md bg-white dark:bg-card">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Users className="h-5 w-5 text-muted-foreground" />
              Alle Korrespondenten
            </CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="flex items-center justify-center py-12">
                <div className="h-6 w-6 animate-spin rounded-full border-2 border-sky-500 border-t-transparent" />
              </div>
            ) : correspondents && correspondents.length > 0 ? (
              <Table>
                <TableHeader>
                  <TableRow className="bg-slate-50/80 dark:bg-muted/50">
                    <TableHead>Name</TableHead>
                    <TableHead>Muster</TableHead>
                    <TableHead>Erstellt</TableHead>
                    <TableHead className="w-10" />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {correspondents.map((c) => (
                    <TableRow key={c.id}>
                      <TableCell className="font-medium text-sm">{c.name}</TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {c.match_pattern || <span className="italic">Keins</span>}
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {new Date(c.created_at).toLocaleDateString("de-DE")}
                      </TableCell>
                      <TableCell>
                        <button
                          onClick={() => setDeleteTarget({ id: c.id, name: c.name })}
                          className="p-1.5 rounded-lg text-destructive hover:bg-destructive/10 transition-colors cursor-pointer"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            ) : (
              <div className="text-center py-12">
                <div className="mx-auto w-14 h-14 rounded-2xl bg-slate-100 dark:bg-muted flex items-center justify-center mb-3">
                  <Users className="h-7 w-7 text-slate-400" />
                </div>
                <p className="text-sm font-medium">Noch keine Korrespondenten</p>
                <p className="text-xs text-muted-foreground mt-1">Erstelle deinen ersten Korrespondenten</p>
                <Button
                  onClick={() => setCreateOpen(true)}
                  className="mt-4 bg-sky-600 hover:bg-sky-700"
                  size="sm"
                >
                  <Plus className="mr-2 h-4 w-4" />
                  Korrespondent erstellen
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Create Dialog */}
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent>
          <form onSubmit={handleCreate}>
            <DialogHeader>
              <DialogTitle>Neuer Korrespondent</DialogTitle>
              <DialogDescription>
                Erstelle einen neuen Korrespondenten fuer die Dokumentenzuordnung.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label>Name *</Label>
                <Input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="z.B. Deutsche Bank"
                  autoFocus
                />
              </div>
              <div className="space-y-2">
                <Label>Muster (optional)</Label>
                <Input
                  value={matchPattern}
                  onChange={(e) => setMatchPattern(e.target.value)}
                  placeholder="z.B. deutsche*bank"
                />
                <p className="text-xs text-muted-foreground">
                  Wird fuer die automatische Zuordnung verwendet.
                </p>
              </div>
            </div>
            <DialogFooter>
              <DialogClose className="inline-flex items-center justify-center rounded-lg border border-border bg-background px-4 h-9 text-sm font-medium hover:bg-muted transition-colors cursor-pointer">
                Abbrechen
              </DialogClose>
              <Button
                type="submit"
                className="bg-sky-600 hover:bg-sky-700"
                disabled={!name.trim() || createCorrespondent.isPending}
              >
                {createCorrespondent.isPending ? "Erstellt..." : "Erstellen"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Delete Confirm Dialog */}
      <Dialog open={!!deleteTarget} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <DialogContent>
          <DialogHeader>
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-destructive/10 mb-2">
              <AlertTriangle className="h-6 w-6 text-destructive" />
            </div>
            <DialogTitle className="text-center">Korrespondent loeschen?</DialogTitle>
            <DialogDescription className="text-center">
              <span className="font-semibold text-foreground">&ldquo;{deleteTarget?.name}&rdquo;</span> wird unwiderruflich geloescht.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <DialogClose className="inline-flex items-center justify-center rounded-lg border border-border bg-background px-4 h-9 text-sm font-medium hover:bg-muted transition-colors cursor-pointer">
              Abbrechen
            </DialogClose>
            <Button variant="destructive" onClick={handleDelete} disabled={deleteCorrespondent.isPending}>
              {deleteCorrespondent.isPending ? "Loescht..." : "Loeschen"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AppShell>
  );
}
