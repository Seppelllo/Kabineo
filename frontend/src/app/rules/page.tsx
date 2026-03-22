"use client";

import { useState } from "react";
import { AppShell } from "@/components/layout/app-shell";
import {
  useMatchingRules,
  useCreateMatchingRule,
  useUpdateMatchingRule,
  useDeleteMatchingRule,
  type MatchingRule,
} from "@/hooks/use-matching-rules";
import { useCorrespondents } from "@/hooks/use-correspondents";
import { useDocumentTypes } from "@/hooks/use-document-types";
import { useTags } from "@/hooks/use-tags";
import { useFolders } from "@/hooks/use-folders";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
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
import { Wand2, Plus, Pencil, Trash2, AlertTriangle, FlaskConical, Loader2, CheckCircle } from "lucide-react";
import { toast } from "sonner";
import { api } from "@/lib/api";

const MATCH_TYPES = [
  { value: "keyword", label: "Enthält (Keyword)" },
  { value: "exact", label: "Exakt" },
  { value: "regex", label: "Regex" },
];

interface RuleFormData {
  name: string;
  order: number;
  match_type: string;
  pattern: string;
  case_sensitive: boolean;
  assign_correspondent_id: string | null;
  assign_document_type_id: string | null;
  assign_tag_ids: string[] | null;
  assign_folder_id: string | null;
}

const emptyForm: RuleFormData = {
  name: "",
  order: 0,
  match_type: "keyword",
  pattern: "",
  case_sensitive: false,
  assign_correspondent_id: null,
  assign_document_type_id: null,
  assign_tag_ids: null,
  assign_folder_id: null,
};

export default function RulesPage() {
  const { data: rules, isLoading } = useMatchingRules();
  const createRule = useCreateMatchingRule();
  const updateRule = useUpdateMatchingRule();
  const deleteRule = useDeleteMatchingRule();
  const { data: correspondents } = useCorrespondents();
  const { data: documentTypes } = useDocumentTypes();
  const { data: tags } = useTags();
  const { data: folders } = useFolders();

  const [formOpen, setFormOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<RuleFormData>(emptyForm);
  const [deleteTarget, setDeleteTarget] = useState<{ id: string; name: string } | null>(null);

  // Rule tester
  const [testText, setTestText] = useState("");
  const [testLoading, setTestLoading] = useState(false);
  const [testResults, setTestResults] = useState<Array<{
    rule_id: string;
    rule_name: string;
    matched_text: string | null;
    assign_correspondent_id: string | null;
    assign_document_type_id: string | null;
    assign_tag_ids: string[] | null;
    assign_folder_id: string | null;
  }> | null>(null);

  const handleTest = async () => {
    if (!testText.trim()) return;
    setTestLoading(true);
    setTestResults(null);
    try {
      const data = await api<{ matches: typeof testResults }>("/api/matching-rules/test-text", {
        method: "POST",
        body: { text: testText.trim() },
      });
      setTestResults(data.matches ?? []);
    } catch {
      toast.error("Test fehlgeschlagen");
    }
    setTestLoading(false);
  };

  const openCreate = () => {
    setEditingId(null);
    setForm({ ...emptyForm, order: (rules?.length ?? 0) + 1 });
    setFormOpen(true);
  };

  const openEdit = (rule: MatchingRule) => {
    setEditingId(rule.id);
    setForm({
      name: rule.name,
      order: rule.order,
      match_type: rule.match_type,
      pattern: rule.pattern,
      case_sensitive: rule.case_sensitive,
      assign_correspondent_id: rule.assign_correspondent_id,
      assign_document_type_id: rule.assign_document_type_id,
      assign_tag_ids: rule.assign_tag_ids,
      assign_folder_id: rule.assign_folder_id,
    });
    setFormOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name.trim() || !form.pattern.trim()) return;
    // Clean form: convert empty strings to null for optional UUID fields
    const cleanedForm = {
      ...form,
      assign_correspondent_id: form.assign_correspondent_id || null,
      assign_document_type_id: form.assign_document_type_id || null,
      assign_folder_id: form.assign_folder_id || null,
      assign_tag_ids: form.assign_tag_ids?.length ? form.assign_tag_ids : null,
    };
    try {
      if (editingId) {
        await updateRule.mutateAsync({ id: editingId, data: cleanedForm });
        toast.success("Regel aktualisiert");
      } else {
        await createRule.mutateAsync(cleanedForm);
        toast.success("Regel erstellt");
      }
      setFormOpen(false);
    } catch {
      toast.error(editingId ? "Regel konnte nicht aktualisiert werden" : "Regel konnte nicht erstellt werden");
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    try {
      await deleteRule.mutateAsync(deleteTarget.id);
      toast.success(`"${deleteTarget.name}" geloescht`);
    } catch {
      toast.error("Loeschen fehlgeschlagen");
    }
    setDeleteTarget(null);
  };

  const sortedRules = rules?.slice().sort((a, b) => a.order - b.order);

  return (
    <AppShell>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Regeln</h1>
            <p className="text-sm text-muted-foreground mt-1">
              Automatische Zuordnung von Korrespondenten, Typen und Tags
            </p>
          </div>
          <Button
            onClick={openCreate}
            className="bg-sky-600 hover:bg-sky-700 shadow-md shadow-sky-600/25"
          >
            <Plus className="mr-2 h-4 w-4" />
            Neue Regel
          </Button>
        </div>

        {/* Rule Tester Card */}
        <Card className="border-0 shadow-md bg-white dark:bg-card">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FlaskConical className="h-5 w-5 text-muted-foreground" />
              Regel testen
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <Textarea
              value={testText}
              onChange={(e) => setTestText(e.target.value)}
              placeholder="Text eingeben, um Regeln zu testen..."
              className="min-h-[80px] resize-y"
            />
            <Button
              onClick={handleTest}
              disabled={!testText.trim() || testLoading}
              className="bg-sky-600 hover:bg-sky-700"
            >
              {testLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <FlaskConical className="mr-2 h-4 w-4" />}
              Testen
            </Button>
            {testResults !== null && (
              <div className="border-t border-border pt-3 mt-3">
                {testResults.length > 0 ? (
                  <div className="space-y-2">
                    <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                      {testResults.length} Regel(n) getroffen
                    </p>
                    {testResults.map((r) => {
                      const corrName = correspondents?.find((c) => c.id === r.assign_correspondent_id)?.name;
                      const dtName = documentTypes?.find((dt) => dt.id === r.assign_document_type_id)?.name;
                      const tagNames = r.assign_tag_ids?.map((tid) => tags?.find((t) => t.id === tid)?.name).filter(Boolean);
                      const folderName = folders?.find((f) => f.id === r.assign_folder_id)?.name;
                      return (
                        <div key={r.rule_id} className="flex items-start gap-3 rounded-lg border border-emerald-200 dark:border-emerald-800 bg-emerald-50 dark:bg-emerald-900/20 px-3 py-2.5">
                          <CheckCircle className="h-4 w-4 text-emerald-600 shrink-0 mt-0.5" />
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium">{r.rule_name}</p>
                            {r.matched_text && (
                              <p className="text-xs text-muted-foreground mt-0.5">
                                Gefunden: <span className="font-mono bg-muted px-1 rounded">{r.matched_text}</span>
                              </p>
                            )}
                            <div className="flex flex-wrap gap-1 mt-1">
                              {corrName && <Badge variant="secondary" className="text-[10px]">Korr: {corrName}</Badge>}
                              {dtName && <Badge variant="secondary" className="text-[10px]">Typ: {dtName}</Badge>}
                              {tagNames && tagNames.length > 0 && <Badge variant="secondary" className="text-[10px]">Tags: {tagNames.join(", ")}</Badge>}
                              {folderName && <Badge variant="secondary" className="text-[10px]">Ordner: {folderName}</Badge>}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground text-center py-2">Keine Regeln haben auf den Text angesprochen.</p>
                )}
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="border-0 shadow-md bg-white dark:bg-card">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Wand2 className="h-5 w-5 text-muted-foreground" />
              Alle Regeln
            </CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="flex items-center justify-center py-12">
                <div className="h-6 w-6 animate-spin rounded-full border-2 border-sky-500 border-t-transparent" />
              </div>
            ) : sortedRules && sortedRules.length > 0 ? (
              <Table>
                <TableHeader>
                  <TableRow className="bg-slate-50/80 dark:bg-muted/50">
                    <TableHead className="w-16">#</TableHead>
                    <TableHead>Name</TableHead>
                    <TableHead>Typ</TableHead>
                    <TableHead>Muster</TableHead>
                    <TableHead>Zuweisungen</TableHead>
                    <TableHead className="w-20" />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {sortedRules.map((rule) => {
                    const corrName = correspondents?.find((c) => c.id === rule.assign_correspondent_id)?.name;
                    const dtName = documentTypes?.find((dt) => dt.id === rule.assign_document_type_id)?.name;
                    const tagNames = rule.assign_tag_ids?.map((tid) => tags?.find((t) => t.id === tid)?.name).filter(Boolean);
                    const folderName = folders?.find((f) => f.id === rule.assign_folder_id)?.name;

                    return (
                      <TableRow key={rule.id}>
                        <TableCell className="text-sm font-mono text-muted-foreground">{rule.order}</TableCell>
                        <TableCell className="font-medium text-sm">{rule.name}</TableCell>
                        <TableCell>
                          <Badge variant="secondary" className="bg-sky-50 text-sky-700 border-sky-200 dark:bg-sky-900/30 dark:text-sky-300 dark:border-sky-800 text-xs">
                            {MATCH_TYPES.find((mt) => mt.value === rule.match_type)?.label ?? rule.match_type}
                          </Badge>
                          {rule.case_sensitive && (
                            <Badge variant="secondary" className="ml-1 text-xs">Aa</Badge>
                          )}
                        </TableCell>
                        <TableCell className="text-sm font-mono text-muted-foreground max-w-[200px] truncate">
                          {rule.pattern}
                        </TableCell>
                        <TableCell>
                          <div className="flex flex-wrap gap-1">
                            {corrName && <Badge variant="secondary" className="text-[10px]">Korr: {corrName}</Badge>}
                            {dtName && <Badge variant="secondary" className="text-[10px]">Typ: {dtName}</Badge>}
                            {tagNames && tagNames.length > 0 && <Badge variant="secondary" className="text-[10px]">Tags: {tagNames.join(", ")}</Badge>}
                            {folderName && <Badge variant="secondary" className="text-[10px]">Ordner: {folderName}</Badge>}
                            {!corrName && !dtName && (!tagNames || tagNames.length === 0) && !folderName && (
                              <span className="text-xs text-muted-foreground italic">Keine</span>
                            )}
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-1">
                            <button
                              onClick={() => openEdit(rule)}
                              className="p-1.5 rounded-lg hover:bg-muted transition-colors cursor-pointer"
                            >
                              <Pencil className="h-3.5 w-3.5 text-muted-foreground" />
                            </button>
                            <button
                              onClick={() => setDeleteTarget({ id: rule.id, name: rule.name })}
                              className="p-1.5 rounded-lg text-destructive hover:bg-destructive/10 transition-colors cursor-pointer"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </button>
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            ) : (
              <div className="text-center py-12">
                <div className="mx-auto w-14 h-14 rounded-2xl bg-slate-100 dark:bg-muted flex items-center justify-center mb-3">
                  <Wand2 className="h-7 w-7 text-slate-400" />
                </div>
                <p className="text-sm font-medium">Noch keine Regeln</p>
                <p className="text-xs text-muted-foreground mt-1">Erstelle deine erste automatische Regel</p>
                <Button
                  onClick={openCreate}
                  className="mt-4 bg-sky-600 hover:bg-sky-700"
                  size="sm"
                >
                  <Plus className="mr-2 h-4 w-4" />
                  Regel erstellen
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Create/Edit Dialog */}
      <Dialog open={formOpen} onOpenChange={setFormOpen}>
        <DialogContent className="max-w-lg">
          <form onSubmit={handleSubmit}>
            <DialogHeader>
              <DialogTitle>{editingId ? "Regel bearbeiten" : "Neue Regel"}</DialogTitle>
              <DialogDescription>
                {editingId ? "Aendere die Eigenschaften dieser Regel." : "Erstelle eine neue automatische Zuordnungsregel."}
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4 max-h-[60vh] overflow-y-auto">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Name *</Label>
                  <Input
                    value={form.name}
                    onChange={(e) => setForm({ ...form, name: e.target.value })}
                    placeholder="Regelname"
                    autoFocus
                  />
                </div>
                <div className="space-y-2">
                  <Label>Reihenfolge</Label>
                  <Input
                    type="number"
                    value={form.order}
                    onChange={(e) => setForm({ ...form, order: parseInt(e.target.value) || 0 })}
                    min={0}
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Muster-Typ</Label>
                  <select
                    value={form.match_type}
                    onChange={(e) => setForm({ ...form, match_type: e.target.value })}
                    className="w-full h-10 rounded-lg border border-border bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                  >
                    {MATCH_TYPES.map((mt) => (
                      <option key={mt.value} value={mt.value}>{mt.label}</option>
                    ))}
                  </select>
                </div>
                <div className="space-y-2">
                  <Label>Muster *</Label>
                  <Input
                    value={form.pattern}
                    onChange={(e) => setForm({ ...form, pattern: e.target.value })}
                    placeholder="Suchmuster"
                  />
                </div>
              </div>

              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="case_sensitive"
                  checked={form.case_sensitive}
                  onChange={(e) => setForm({ ...form, case_sensitive: e.target.checked })}
                  className="h-4 w-4 rounded border-border text-sky-600 focus:ring-sky-500"
                />
                <Label htmlFor="case_sensitive" className="text-sm font-normal">
                  Gross-/Kleinschreibung beachten
                </Label>
              </div>

              <div className="border-t border-border pt-4">
                <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3">
                  Zuweisungen
                </p>

                <div className="space-y-3">
                  <div className="space-y-2">
                    <Label>Korrespondent</Label>
                    <select
                      value={form.assign_correspondent_id ?? ""}
                      onChange={(e) => setForm({ ...form, assign_correspondent_id: e.target.value || null })}
                      className="w-full h-10 rounded-lg border border-border bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                    >
                      <option value="">Kein Korrespondent</option>
                      {correspondents?.map((c) => (
                        <option key={c.id} value={c.id}>{c.name}</option>
                      ))}
                    </select>
                  </div>

                  <div className="space-y-2">
                    <Label>Dokumenttyp</Label>
                    <select
                      value={form.assign_document_type_id ?? ""}
                      onChange={(e) => setForm({ ...form, assign_document_type_id: e.target.value || null })}
                      className="w-full h-10 rounded-lg border border-border bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                    >
                      <option value="">Kein Dokumenttyp</option>
                      {documentTypes?.map((dt) => (
                        <option key={dt.id} value={dt.id}>{dt.name}</option>
                      ))}
                    </select>
                  </div>

                  <div className="space-y-2">
                    <Label>Ordner</Label>
                    <select
                      value={form.assign_folder_id ?? ""}
                      onChange={(e) => setForm({ ...form, assign_folder_id: e.target.value || null })}
                      className="w-full h-10 rounded-lg border border-border bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                    >
                      <option value="">Kein Ordner</option>
                      {folders?.map((f) => (
                        <option key={f.id} value={f.id}>{f.name}</option>
                      ))}
                    </select>
                  </div>

                  <div className="space-y-2">
                    <Label>Tags</Label>
                    <div className="flex flex-wrap gap-2 p-2 min-h-[40px] rounded-lg border border-border bg-background">
                      {tags?.map((tag) => {
                        const selected = form.assign_tag_ids?.includes(tag.id);
                        return (
                          <button
                            key={tag.id}
                            type="button"
                            onClick={() => {
                              const current = form.assign_tag_ids ?? [];
                              const next = selected
                                ? current.filter((id) => id !== tag.id)
                                : [...current, tag.id];
                              setForm({ ...form, assign_tag_ids: next.length > 0 ? next : null });
                            }}
                            className={`inline-flex items-center px-2 py-1 rounded-md text-xs font-medium transition-colors cursor-pointer border ${
                              selected
                                ? "bg-sky-100 text-sky-700 border-sky-300 dark:bg-sky-900/30 dark:text-sky-300 dark:border-sky-700"
                                : "bg-muted text-muted-foreground border-transparent hover:border-border"
                            }`}
                          >
                            {tag.name}
                          </button>
                        );
                      })}
                      {(!tags || tags.length === 0) && (
                        <span className="text-xs text-muted-foreground">Keine Tags vorhanden</span>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            </div>
            <DialogFooter>
              <DialogClose className="inline-flex items-center justify-center rounded-lg border border-border bg-background px-4 h-9 text-sm font-medium hover:bg-muted transition-colors cursor-pointer">
                Abbrechen
              </DialogClose>
              <Button
                type="submit"
                className="bg-sky-600 hover:bg-sky-700"
                disabled={!form.name.trim() || !form.pattern.trim() || createRule.isPending || updateRule.isPending}
              >
                {(createRule.isPending || updateRule.isPending) ? "Speichert..." : editingId ? "Speichern" : "Erstellen"}
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
            <DialogTitle className="text-center">Regel loeschen?</DialogTitle>
            <DialogDescription className="text-center">
              <span className="font-semibold text-foreground">&ldquo;{deleteTarget?.name}&rdquo;</span> wird unwiderruflich geloescht.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <DialogClose className="inline-flex items-center justify-center rounded-lg border border-border bg-background px-4 h-9 text-sm font-medium hover:bg-muted transition-colors cursor-pointer">
              Abbrechen
            </DialogClose>
            <Button variant="destructive" onClick={handleDelete} disabled={deleteRule.isPending}>
              {deleteRule.isPending ? "Loescht..." : "Loeschen"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AppShell>
  );
}
