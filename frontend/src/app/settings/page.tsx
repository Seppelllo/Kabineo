"use client";

import { useState } from "react";
import { AppShell } from "@/components/layout/app-shell";
import { useAuth } from "@/hooks/use-auth";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
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
import { api } from "@/lib/api";
import { toast } from "sonner";
import { Copy, Plus, Trash2, Key, Webhook, Mail, FolderOpen, AlertTriangle, CheckCircle, XCircle, Pencil, Save, Loader2, Shield, Lock, Info } from "lucide-react";

interface ApiKey {
  id: string;
  name: string;
  prefix: string;
  created_at: string;
}

interface WebhookConfig {
  id: string;
  url: string;
  events: string[];
  is_active: boolean;
  created_at: string;
}

interface EmailImportConfig {
  enabled: boolean;
  server: string | null;
  email: string | null;
  folder: string | null;
}

interface ConsumeFolderConfig {
  enabled: boolean;
  path: string | null;
}

interface SsoConfig {
  sso_enabled: boolean;
  sso_provider_name: string;
  saml_enabled: boolean;
}

export default function SettingsPage() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [linkCode, setLinkCode] = useState<string | null>(null);

  // API Keys
  const { data: apiKeys } = useQuery<ApiKey[]>({
    queryKey: ["settings", "api-keys"],
    queryFn: () => api("/api/settings/api-keys"),
  });
  const [createKeyOpen, setCreateKeyOpen] = useState(false);
  const [keyName, setKeyName] = useState("");
  const [newKey, setNewKey] = useState<string | null>(null);

  const createApiKey = useMutation({
    mutationFn: (name: string) => api<{ key: string; id: string }>("/api/settings/api-keys", { method: "POST", body: { name } }),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["settings", "api-keys"] });
      setNewKey((data as { key: string }).key);
    },
  });

  const deleteApiKey = useMutation({
    mutationFn: (id: string) => api(`/api/settings/api-keys/${id}`, { method: "DELETE" }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["settings", "api-keys"] }),
  });

  // Webhooks
  const { data: webhooks } = useQuery<WebhookConfig[]>({
    queryKey: ["settings", "webhooks"],
    queryFn: () => api("/api/settings/webhooks"),
  });
  const [webhookOpen, setWebhookOpen] = useState(false);
  const [editingWebhookId, setEditingWebhookId] = useState<string | null>(null);
  const [webhookUrl, setWebhookUrl] = useState("");
  const [webhookEvents, setWebhookEvents] = useState("");
  const [deleteWebhookTarget, setDeleteWebhookTarget] = useState<{ id: string; url: string } | null>(null);

  const createWebhook = useMutation({
    mutationFn: (data: { url: string; events: string[] }) =>
      api("/api/settings/webhooks", { method: "POST", body: data }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["settings", "webhooks"] }),
  });

  const updateWebhook = useMutation({
    mutationFn: ({ id, data }: { id: string; data: { url: string; events: string[] } }) =>
      api(`/api/settings/webhooks/${id}`, { method: "PUT", body: data }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["settings", "webhooks"] }),
  });

  const deleteWebhook = useMutation({
    mutationFn: (id: string) => api(`/api/settings/webhooks/${id}`, { method: "DELETE" }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["settings", "webhooks"] }),
  });

  // Email Import
  const { data: emailConfig } = useQuery<EmailImportConfig>({
    queryKey: ["settings", "email-import"],
    queryFn: () => api("/api/settings/email-import"),
  });
  const [editingEmail, setEditingEmail] = useState(false);
  const [emailForm, setEmailForm] = useState({ enabled: false, server: "", user: "", password: "", folder: "INBOX" });

  const saveEmailConfig = useMutation({
    mutationFn: (data: typeof emailForm) =>
      api("/api/settings/email-import", { method: "PUT", body: data }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["settings", "email-import"] });
      setEditingEmail(false);
      toast.success("E-Mail-Konfiguration gespeichert");
    },
    onError: () => toast.error("Speichern fehlgeschlagen"),
  });

  // Consume Folder
  const { data: consumeConfig } = useQuery<ConsumeFolderConfig>({
    queryKey: ["settings", "consume-folder"],
    queryFn: () => api("/api/settings/consume-folder"),
  });

  // SSO Config
  const { data: ssoConfig } = useQuery<SsoConfig>({
    queryKey: ["sso", "config"],
    queryFn: () => api("/api/auth/sso/config"),
  });
  const [editingConsume, setEditingConsume] = useState(false);
  const [consumeForm, setConsumeForm] = useState({ enabled: false, path: "" });

  const saveConsumeConfig = useMutation({
    mutationFn: (data: typeof consumeForm) =>
      api("/api/settings/consume-folder", { method: "PUT", body: data }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["settings", "consume-folder"] });
      setEditingConsume(false);
      toast.success("Consume-Ordner-Konfiguration gespeichert");
    },
    onError: () => toast.error("Speichern fehlgeschlagen"),
  });

  const generateTelegramLink = async () => {
    try {
      const data = await api<{ link_code: string }>("/api/auth/telegram-link", { method: "POST" });
      setLinkCode(data.link_code);
      toast.success("Link-Code generiert");
    } catch {
      toast.error("Fehler beim Generieren des Link-Codes");
    }
  };

  const copyCode = () => {
    if (linkCode) {
      navigator.clipboard.writeText(`/link ${linkCode}`);
      toast.success("In Zwischenablage kopiert");
    }
  };

  const handleCreateKey = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!keyName.trim()) return;
    try {
      await createApiKey.mutateAsync(keyName.trim());
      setKeyName("");
      toast.success("API-Schluessel erstellt");
    } catch {
      toast.error("API-Schluessel konnte nicht erstellt werden");
    }
  };

  const handleWebhookSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!webhookUrl.trim()) return;
    const events = webhookEvents.split(",").map((s) => s.trim()).filter(Boolean);
    try {
      if (editingWebhookId) {
        await updateWebhook.mutateAsync({ id: editingWebhookId, data: { url: webhookUrl.trim(), events } });
        toast.success("Webhook aktualisiert");
      } else {
        await createWebhook.mutateAsync({ url: webhookUrl.trim(), events });
        toast.success("Webhook erstellt");
      }
      setWebhookOpen(false);
      setWebhookUrl("");
      setWebhookEvents("");
      setEditingWebhookId(null);
    } catch {
      toast.error("Webhook konnte nicht gespeichert werden");
    }
  };

  const handleDeleteWebhook = async () => {
    if (!deleteWebhookTarget) return;
    try {
      await deleteWebhook.mutateAsync(deleteWebhookTarget.id);
      toast.success("Webhook geloescht");
    } catch {
      toast.error("Loeschen fehlgeschlagen");
    }
    setDeleteWebhookTarget(null);
  };

  return (
    <AppShell>
      <div className="max-w-2xl mx-auto space-y-6">
        <div>
          <h1 className="text-2xl font-bold">Einstellungen</h1>
          <p className="text-muted-foreground">Verwalte dein Profil und Verknuepfungen</p>
        </div>

        {/* Profile */}
        <Card>
          <CardHeader>
            <CardTitle>Profil</CardTitle>
            <CardDescription>Deine Kontoinformationen</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label>E-Mail</Label>
              <Input value={user?.email ?? ""} disabled />
            </div>
            <div className="space-y-2">
              <Label>Benutzername</Label>
              <Input value={user?.username ?? ""} disabled />
            </div>
            <div className="space-y-2">
              <Label>Rolle</Label>
              <Input value={user?.role ?? ""} disabled />
            </div>
          </CardContent>
        </Card>

        {/* Telegram */}
        <Card>
          <CardHeader>
            <CardTitle>Telegram</CardTitle>
            <CardDescription>
              Verknuepfe deinen Telegram-Account, um Dokumente direkt per Chat hochzuladen und zu suchen
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <Button onClick={generateTelegramLink}>
              Link-Code generieren
            </Button>
            {linkCode && (
              <div className="space-y-2">
                <Label>Sende diesen Befehl an den Kabineo Bot:</Label>
                <div className="flex gap-2">
                  <Input value={`/link ${linkCode}`} readOnly />
                  <Button variant="outline" size="icon" onClick={copyCode}>
                    <Copy className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* API Keys */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="flex items-center gap-2">
                  <Key className="h-5 w-5 text-muted-foreground" />
                  API-Schluessel
                </CardTitle>
                <CardDescription>Verwalte API-Schluessel fuer externen Zugriff</CardDescription>
              </div>
              <Button
                size="sm"
                onClick={() => { setNewKey(null); setKeyName(""); setCreateKeyOpen(true); }}
                className="bg-sky-600 hover:bg-sky-700"
              >
                <Plus className="mr-1 h-4 w-4" />
                Neu
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            {apiKeys && apiKeys.length > 0 ? (
              <Table>
                <TableHeader>
                  <TableRow className="bg-slate-50/80 dark:bg-muted/50">
                    <TableHead>Name</TableHead>
                    <TableHead>Praefix</TableHead>
                    <TableHead>Erstellt</TableHead>
                    <TableHead className="w-10" />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {apiKeys.map((key) => (
                    <TableRow key={key.id}>
                      <TableCell className="font-medium text-sm">{key.name}</TableCell>
                      <TableCell className="text-sm font-mono text-muted-foreground">{key.prefix}...</TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {new Date(key.created_at).toLocaleDateString("de-DE")}
                      </TableCell>
                      <TableCell>
                        <button
                          onClick={async () => {
                            try {
                              await deleteApiKey.mutateAsync(key.id);
                              toast.success("API-Schluessel geloescht");
                            } catch {
                              toast.error("Loeschen fehlgeschlagen");
                            }
                          }}
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
              <p className="text-sm text-muted-foreground text-center py-4">Keine API-Schluessel vorhanden</p>
            )}
          </CardContent>
        </Card>

        {/* Webhooks */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="flex items-center gap-2">
                  <Webhook className="h-5 w-5 text-muted-foreground" />
                  Webhooks
                </CardTitle>
                <CardDescription>HTTP-Benachrichtigungen bei Ereignissen</CardDescription>
              </div>
              <Button
                size="sm"
                onClick={() => { setEditingWebhookId(null); setWebhookUrl(""); setWebhookEvents(""); setWebhookOpen(true); }}
                className="bg-sky-600 hover:bg-sky-700"
              >
                <Plus className="mr-1 h-4 w-4" />
                Neu
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            {webhooks && webhooks.length > 0 ? (
              <Table>
                <TableHeader>
                  <TableRow className="bg-slate-50/80 dark:bg-muted/50">
                    <TableHead>URL</TableHead>
                    <TableHead>Ereignisse</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="w-10" />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {webhooks.map((wh) => (
                    <TableRow key={wh.id}>
                      <TableCell className="font-medium text-sm max-w-[200px] truncate">{wh.url}</TableCell>
                      <TableCell>
                        <div className="flex flex-wrap gap-1">
                          {wh.events.map((ev) => (
                            <Badge key={ev} variant="secondary" className="text-[10px]">{ev}</Badge>
                          ))}
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant="secondary" className={wh.is_active
                          ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                          : "bg-red-50 text-red-700 border-red-200"
                        }>
                          {wh.is_active ? "Aktiv" : "Inaktiv"}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1">
                          <button
                            onClick={() => {
                              setEditingWebhookId(wh.id);
                              setWebhookUrl(wh.url);
                              setWebhookEvents(wh.events.join(", "));
                              setWebhookOpen(true);
                            }}
                            className="p-1.5 rounded-lg hover:bg-muted transition-colors cursor-pointer"
                          >
                            <Copy className="h-3.5 w-3.5 text-muted-foreground" />
                          </button>
                          <button
                            onClick={() => setDeleteWebhookTarget({ id: wh.id, url: wh.url })}
                            className="p-1.5 rounded-lg text-destructive hover:bg-destructive/10 transition-colors cursor-pointer"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            ) : (
              <p className="text-sm text-muted-foreground text-center py-4">Keine Webhooks konfiguriert</p>
            )}
          </CardContent>
        </Card>

        {/* Email Import */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="flex items-center gap-2">
                  <Mail className="h-5 w-5 text-muted-foreground" />
                  E-Mail Import
                </CardTitle>
                <CardDescription>Automatischer Import von E-Mail-Anhaengen</CardDescription>
              </div>
              {!editingEmail && (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => {
                    setEmailForm({
                      enabled: emailConfig?.enabled ?? false,
                      server: emailConfig?.server ?? "",
                      user: emailConfig?.email ?? "",
                      password: "",
                      folder: emailConfig?.folder ?? "INBOX",
                    });
                    setEditingEmail(true);
                  }}
                >
                  <Pencil className="mr-1 h-3.5 w-3.5" />
                  Bearbeiten
                </Button>
              )}
            </div>
          </CardHeader>
          <CardContent>
            {editingEmail ? (
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  saveEmailConfig.mutate(emailForm);
                }}
                className="space-y-3"
              >
                <div className="flex items-center gap-3">
                  <input
                    type="checkbox"
                    id="email-enabled"
                    checked={emailForm.enabled}
                    onChange={(e) => setEmailForm({ ...emailForm, enabled: e.target.checked })}
                    className="h-4 w-4 rounded border-border text-sky-600 focus:ring-sky-500"
                  />
                  <Label htmlFor="email-enabled" className="text-sm font-normal">Aktiviert</Label>
                </div>
                <div className="space-y-2">
                  <Label>IMAP-Server</Label>
                  <Input
                    value={emailForm.server}
                    onChange={(e) => setEmailForm({ ...emailForm, server: e.target.value })}
                    placeholder="imap.example.com"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Benutzer / E-Mail</Label>
                  <Input
                    value={emailForm.user}
                    onChange={(e) => setEmailForm({ ...emailForm, user: e.target.value })}
                    placeholder="user@example.com"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Passwort</Label>
                  <Input
                    type="password"
                    value={emailForm.password}
                    onChange={(e) => setEmailForm({ ...emailForm, password: e.target.value })}
                    placeholder="Neues Passwort (leer = beibehalten)"
                  />
                </div>
                <div className="space-y-2">
                  <Label>IMAP-Ordner</Label>
                  <Input
                    value={emailForm.folder}
                    onChange={(e) => setEmailForm({ ...emailForm, folder: e.target.value })}
                    placeholder="INBOX"
                  />
                </div>
                <div className="flex gap-2 pt-2">
                  <Button type="submit" className="bg-sky-600 hover:bg-sky-700" disabled={saveEmailConfig.isPending}>
                    {saveEmailConfig.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
                    Speichern
                  </Button>
                  <Button type="button" variant="outline" onClick={() => setEditingEmail(false)}>Abbrechen</Button>
                </div>
              </form>
            ) : (
              <div className="space-y-3">
                <div className="flex items-center gap-2">
                  {emailConfig?.enabled ? (
                    <CheckCircle className="h-5 w-5 text-emerald-600" />
                  ) : (
                    <XCircle className="h-5 w-5 text-muted-foreground" />
                  )}
                  <span className="text-sm font-medium">
                    {emailConfig?.enabled ? "Aktiviert" : "Deaktiviert"}
                  </span>
                </div>
                {emailConfig?.enabled && (
                  <div className="space-y-2 text-sm">
                    <div className="flex items-center justify-between">
                      <span className="text-muted-foreground">Server</span>
                      <span className="font-medium">{emailConfig.server ?? "-"}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-muted-foreground">E-Mail</span>
                      <span className="font-medium">{emailConfig.email ?? "-"}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-muted-foreground">Ordner</span>
                      <span className="font-medium">{emailConfig.folder ?? "INBOX"}</span>
                    </div>
                  </div>
                )}
                {!emailConfig && (
                  <p className="text-xs text-muted-foreground">Konfiguration wird geladen...</p>
                )}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Consume Folder */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="flex items-center gap-2">
                  <FolderOpen className="h-5 w-5 text-muted-foreground" />
                  Consume-Ordner
                </CardTitle>
                <CardDescription>Automatischer Import aus einem lokalen Ordner</CardDescription>
              </div>
              {!editingConsume && (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => {
                    setConsumeForm({
                      enabled: consumeConfig?.enabled ?? false,
                      path: consumeConfig?.path ?? "",
                    });
                    setEditingConsume(true);
                  }}
                >
                  <Pencil className="mr-1 h-3.5 w-3.5" />
                  Bearbeiten
                </Button>
              )}
            </div>
          </CardHeader>
          <CardContent>
            {editingConsume ? (
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  saveConsumeConfig.mutate(consumeForm);
                }}
                className="space-y-3"
              >
                <div className="flex items-center gap-3">
                  <input
                    type="checkbox"
                    id="consume-enabled"
                    checked={consumeForm.enabled}
                    onChange={(e) => setConsumeForm({ ...consumeForm, enabled: e.target.checked })}
                    className="h-4 w-4 rounded border-border text-sky-600 focus:ring-sky-500"
                  />
                  <Label htmlFor="consume-enabled" className="text-sm font-normal">Aktiviert</Label>
                </div>
                <div className="space-y-2">
                  <Label>Ordner-Pfad</Label>
                  <Input
                    value={consumeForm.path}
                    onChange={(e) => setConsumeForm({ ...consumeForm, path: e.target.value })}
                    placeholder="/data/consume"
                  />
                </div>
                <div className="flex gap-2 pt-2">
                  <Button type="submit" className="bg-sky-600 hover:bg-sky-700" disabled={saveConsumeConfig.isPending}>
                    {saveConsumeConfig.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
                    Speichern
                  </Button>
                  <Button type="button" variant="outline" onClick={() => setEditingConsume(false)}>Abbrechen</Button>
                </div>
              </form>
            ) : (
              <div className="space-y-3">
                <div className="flex items-center gap-2">
                  {consumeConfig?.enabled ? (
                    <CheckCircle className="h-5 w-5 text-emerald-600" />
                  ) : (
                    <XCircle className="h-5 w-5 text-muted-foreground" />
                  )}
                  <span className="text-sm font-medium">
                    {consumeConfig?.enabled ? "Aktiviert" : "Deaktiviert"}
                  </span>
                </div>
                {consumeConfig?.enabled && consumeConfig.path && (
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">Pfad</span>
                    <span className="font-mono text-xs bg-muted px-2 py-1 rounded">{consumeConfig.path}</span>
                  </div>
                )}
                {!consumeConfig && (
                  <p className="text-xs text-muted-foreground">Konfiguration wird geladen...</p>
                )}
              </div>
            )}
          </CardContent>
        </Card>
        {/* SSO & SAML */}
        <Card>
          <CardHeader>
            <div>
              <CardTitle className="flex items-center gap-2">
                <Shield className="h-5 w-5 text-muted-foreground" />
                SSO &amp; SAML
              </CardTitle>
              <CardDescription>Single Sign-On Konfiguration</CardDescription>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Shield className="h-4 w-4 text-sky-600" />
                  <span className="text-sm font-medium">SSO / OIDC</span>
                </div>
                {ssoConfig?.sso_enabled ? (
                  <div className="flex items-center gap-1.5">
                    <CheckCircle className="h-4 w-4 text-emerald-600" />
                    <span className="text-sm text-emerald-600 font-medium">
                      {ssoConfig.sso_provider_name}
                    </span>
                  </div>
                ) : (
                  <div className="flex items-center gap-1.5">
                    <XCircle className="h-4 w-4 text-muted-foreground" />
                    <span className="text-sm text-muted-foreground">Nicht konfiguriert</span>
                  </div>
                )}
              </div>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Lock className="h-4 w-4 text-indigo-600" />
                  <span className="text-sm font-medium">SAML 2.0</span>
                </div>
                {ssoConfig?.saml_enabled ? (
                  <div className="flex items-center gap-1.5">
                    <CheckCircle className="h-4 w-4 text-emerald-600" />
                    <span className="text-sm text-emerald-600 font-medium">Konfiguriert</span>
                  </div>
                ) : (
                  <div className="flex items-center gap-1.5">
                    <XCircle className="h-4 w-4 text-muted-foreground" />
                    <span className="text-sm text-muted-foreground">Nicht konfiguriert</span>
                  </div>
                )}
              </div>
            </div>
            <div className="flex items-start gap-2 p-3 rounded-lg bg-sky-50 dark:bg-sky-950/30 border border-sky-200 dark:border-sky-900">
              <Info className="h-4 w-4 text-sky-600 mt-0.5 shrink-0" />
              <p className="text-xs text-sky-700 dark:text-sky-300 leading-relaxed">
                SSO wird über Umgebungsvariablen konfiguriert. Setze die entsprechenden SSO_ und SAML_ Variablen in der .env Datei und starte den Server neu.
              </p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Create API Key Dialog */}
      <Dialog open={createKeyOpen} onOpenChange={(open) => { if (!open) { setCreateKeyOpen(false); setNewKey(null); } }}>
        <DialogContent>
          {newKey ? (
            <>
              <DialogHeader>
                <DialogTitle>API-Schluessel erstellt</DialogTitle>
                <DialogDescription>
                  Kopiere den Schluessel jetzt. Er wird nicht erneut angezeigt.
                </DialogDescription>
              </DialogHeader>
              <div className="py-4">
                <div className="flex gap-2">
                  <Input value={newKey} readOnly className="font-mono text-sm" />
                  <Button
                    variant="outline"
                    size="icon"
                    onClick={() => {
                      navigator.clipboard.writeText(newKey);
                      toast.success("In Zwischenablage kopiert");
                    }}
                  >
                    <Copy className="h-4 w-4" />
                  </Button>
                </div>
              </div>
              <DialogFooter>
                <Button onClick={() => { setCreateKeyOpen(false); setNewKey(null); }} className="bg-sky-600 hover:bg-sky-700">
                  Fertig
                </Button>
              </DialogFooter>
            </>
          ) : (
            <form onSubmit={handleCreateKey}>
              <DialogHeader>
                <DialogTitle>Neuer API-Schluessel</DialogTitle>
                <DialogDescription>
                  Gib einen Namen fuer den Schluessel ein.
                </DialogDescription>
              </DialogHeader>
              <div className="py-4">
                <div className="space-y-2">
                  <Label>Name</Label>
                  <Input
                    value={keyName}
                    onChange={(e) => setKeyName(e.target.value)}
                    placeholder="z.B. Meine App"
                    autoFocus
                  />
                </div>
              </div>
              <DialogFooter>
                <DialogClose className="inline-flex items-center justify-center rounded-lg border border-border bg-background px-4 h-9 text-sm font-medium hover:bg-muted transition-colors cursor-pointer">
                  Abbrechen
                </DialogClose>
                <Button type="submit" className="bg-sky-600 hover:bg-sky-700" disabled={!keyName.trim() || createApiKey.isPending}>
                  {createApiKey.isPending ? "Erstellt..." : "Erstellen"}
                </Button>
              </DialogFooter>
            </form>
          )}
        </DialogContent>
      </Dialog>

      {/* Webhook Create/Edit Dialog */}
      <Dialog open={webhookOpen} onOpenChange={setWebhookOpen}>
        <DialogContent>
          <form onSubmit={handleWebhookSubmit}>
            <DialogHeader>
              <DialogTitle>{editingWebhookId ? "Webhook bearbeiten" : "Neuer Webhook"}</DialogTitle>
              <DialogDescription>
                Konfiguriere die URL und Ereignisse fuer den Webhook.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label>URL *</Label>
                <Input
                  value={webhookUrl}
                  onChange={(e) => setWebhookUrl(e.target.value)}
                  placeholder="https://example.com/webhook"
                  autoFocus
                />
              </div>
              <div className="space-y-2">
                <Label>Ereignisse</Label>
                <Input
                  value={webhookEvents}
                  onChange={(e) => setWebhookEvents(e.target.value)}
                  placeholder="document.created, document.updated"
                />
                <p className="text-xs text-muted-foreground">
                  Kommagetrennte Liste von Ereignissen.
                </p>
              </div>
            </div>
            <DialogFooter>
              <DialogClose className="inline-flex items-center justify-center rounded-lg border border-border bg-background px-4 h-9 text-sm font-medium hover:bg-muted transition-colors cursor-pointer">
                Abbrechen
              </DialogClose>
              <Button type="submit" className="bg-sky-600 hover:bg-sky-700" disabled={!webhookUrl.trim() || createWebhook.isPending || updateWebhook.isPending}>
                {(createWebhook.isPending || updateWebhook.isPending) ? "Speichert..." : editingWebhookId ? "Speichern" : "Erstellen"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Delete Webhook Confirm */}
      <Dialog open={!!deleteWebhookTarget} onOpenChange={(open) => !open && setDeleteWebhookTarget(null)}>
        <DialogContent>
          <DialogHeader>
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-destructive/10 mb-2">
              <AlertTriangle className="h-6 w-6 text-destructive" />
            </div>
            <DialogTitle className="text-center">Webhook loeschen?</DialogTitle>
            <DialogDescription className="text-center">
              Der Webhook fuer <span className="font-semibold text-foreground">{deleteWebhookTarget?.url}</span> wird entfernt.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <DialogClose className="inline-flex items-center justify-center rounded-lg border border-border bg-background px-4 h-9 text-sm font-medium hover:bg-muted transition-colors cursor-pointer">
              Abbrechen
            </DialogClose>
            <Button variant="destructive" onClick={handleDeleteWebhook} disabled={deleteWebhook.isPending}>
              {deleteWebhook.isPending ? "Loescht..." : "Loeschen"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AppShell>
  );
}
