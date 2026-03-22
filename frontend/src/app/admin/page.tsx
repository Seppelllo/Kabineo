"use client";

import { AppShell } from "@/components/layout/app-shell";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { useAuth } from "@/hooks/use-auth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
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
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogClose,
} from "@/components/ui/dialog";
import {
  FileText, HardDrive, Users, MoreVertical, Shield, UserCheck, UserX, Eye, ChevronDown,
  Settings, Mail, MailX, UserPlus, KeyRound, Loader2, Copy, Check, Lock, LockOpen,
} from "lucide-react";
import type { User } from "@/lib/auth";
import { toast } from "sonner";
import { useState } from "react";

interface Stats {
  total_users: number;
  total_documents: number;
  total_storage_bytes: number;
}

interface AuditLog {
  id: string;
  user_id: string | null;
  action: string;
  resource_type: string;
  resource_id: string;
  created_at: string;
}

interface SystemSettings {
  registration_enabled: boolean;
  smtp_configured: boolean;
}

interface SsoConfig {
  sso_enabled: boolean;
  sso_provider_name: string;
  saml_enabled: boolean;
}

const roleLabels: Record<string, { label: string; icon: typeof Shield; color: string }> = {
  admin: { label: "Admin", icon: Shield, color: "bg-sky-50 text-sky-700 border-sky-200 dark:bg-sky-900/30 dark:text-sky-300 dark:border-sky-800" },
  user: { label: "Benutzer", icon: UserCheck, color: "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-900/30 dark:text-emerald-300 dark:border-emerald-800" },
  viewer: { label: "Betrachter", icon: Eye, color: "bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-900/30 dark:text-amber-300 dark:border-amber-800" },
};

export default function AdminPage() {
  const { user: currentUser } = useAuth();
  const queryClient = useQueryClient();
  const [confirmUser, setConfirmUser] = useState<{ id: string; name: string; action: "activate" | "deactivate" } | null>(null);
  const [showCreateUser, setShowCreateUser] = useState(false);
  const [createUserLoading, setCreateUserLoading] = useState(false);
  const [tempPasswordResult, setTempPasswordResult] = useState<{ username: string; password: string } | null>(null);
  const [resetPasswordResult, setResetPasswordResult] = useState<{ username: string; password: string } | null>(null);
  const [copiedField, setCopiedField] = useState<string | null>(null);

  const { data: stats } = useQuery<Stats>({
    queryKey: ["admin", "stats"],
    queryFn: () => api("/api/admin/stats"),
  });

  const { data: users } = useQuery<User[]>({
    queryKey: ["admin", "users"],
    queryFn: () => api("/api/admin/users"),
  });

  const { data: logs } = useQuery<{ items: AuditLog[] }>({
    queryKey: ["admin", "logs"],
    queryFn: () => api("/api/admin/audit-logs?page_size=20"),
  });

  const { data: systemSettings } = useQuery<SystemSettings>({
    queryKey: ["admin", "settings"],
    queryFn: () => api("/api/admin/settings"),
  });

  const { data: ssoConfig } = useQuery<SsoConfig>({
    queryKey: ["sso", "config"],
    queryFn: () => api("/api/auth/sso/config"),
  });

  const updateUser = useMutation({
    mutationFn: ({ userId, data }: { userId: string; data: { role?: string; is_active?: boolean } }) =>
      api(`/api/admin/users/${userId}`, { method: "PUT", body: data }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin", "users"] });
      queryClient.invalidateQueries({ queryKey: ["admin", "stats"] });
    },
  });

  const updateSettings = useMutation({
    mutationFn: (data: { registration_enabled: boolean }) =>
      api("/api/admin/settings", { method: "PUT", body: data }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin", "settings"] });
    },
  });

  const handleRoleChange = async (userId: string, username: string, role: string) => {
    try {
      await updateUser.mutateAsync({ userId, data: { role } });
      toast.success(`${username} ist jetzt ${roleLabels[role]?.label ?? role}`);
    } catch {
      toast.error("Rolle konnte nicht geändert werden");
    }
  };

  const handleToggleActive = async () => {
    if (!confirmUser) return;
    const activate = confirmUser.action === "activate";
    try {
      await updateUser.mutateAsync({ userId: confirmUser.id, data: { is_active: activate } });
      toast.success(`${confirmUser.name} wurde ${activate ? "aktiviert" : "deaktiviert"}`);
    } catch {
      toast.error("Status konnte nicht geändert werden");
    }
    setConfirmUser(null);
  };

  const handleToggleRegistration = async () => {
    if (!systemSettings) return;
    try {
      await updateSettings.mutateAsync({ registration_enabled: !systemSettings.registration_enabled });
      toast.success(
        systemSettings.registration_enabled
          ? "Registrierung deaktiviert"
          : "Registrierung aktiviert"
      );
    } catch {
      toast.error("Einstellung konnte nicht gespeichert werden");
    }
  };

  const handleCreateUser = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setCreateUserLoading(true);
    const form = new FormData(e.currentTarget);
    const body = {
      email: form.get("email") as string,
      username: form.get("username") as string,
      full_name: (form.get("full_name") as string) || undefined,
      role: (form.get("role") as string) || "user",
      password: (form.get("password") as string) || undefined,
    };
    try {
      const result = await api<User & { temporary_password: string; email_sent: boolean }>("/api/admin/users", { method: "POST", body });
      queryClient.invalidateQueries({ queryKey: ["admin", "users"] });
      queryClient.invalidateQueries({ queryKey: ["admin", "stats"] });
      setShowCreateUser(false);
      setTempPasswordResult({
        username: body.username,
        password: result.temporary_password,
      });
      if (result.email_sent) {
        toast.success(`Benutzer "${body.username}" erstellt und E-Mail gesendet`);
      } else {
        toast.success(`Benutzer "${body.username}" erstellt`);
      }
    } catch {
      toast.error("Benutzer konnte nicht erstellt werden");
    } finally {
      setCreateUserLoading(false);
    }
  };

  const handleResetPassword = async (userId: string, username: string) => {
    try {
      const result = await api<{ temporary_password: string; email_sent: boolean }>(
        `/api/admin/users/${userId}/reset-password`,
        { method: "POST" }
      );
      setResetPasswordResult({
        username,
        password: result.temporary_password,
      });
      queryClient.invalidateQueries({ queryKey: ["admin", "users"] });
      if (result.email_sent) {
        toast.success("Passwort zurückgesetzt und E-Mail gesendet");
      } else {
        toast.success("Passwort zurückgesetzt");
      }
    } catch {
      toast.error("Passwort konnte nicht zurückgesetzt werden");
    }
  };

  const copyToClipboard = (text: string, field: string) => {
    navigator.clipboard.writeText(text);
    setCopiedField(field);
    setTimeout(() => setCopiedField(null), 2000);
  };

  return (
    <AppShell>
      <div className="space-y-6">
        <h1 className="text-2xl font-bold tracking-tight">Administration</h1>

        {/* System Settings */}
        <Card className="border-0 shadow-md bg-white dark:bg-card">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Settings className="h-5 w-5 text-muted-foreground" />
              Systemeinstellungen
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-col sm:flex-row gap-4">
              <div className="flex items-center justify-between rounded-xl bg-slate-50 dark:bg-muted/50 p-4 flex-1">
                <div>
                  <p className="text-sm font-medium">Registrierung erlauben</p>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Neue Benutzer können sich selbst registrieren
                  </p>
                </div>
                <button
                  onClick={handleToggleRegistration}
                  className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                    systemSettings?.registration_enabled
                      ? "bg-sky-600"
                      : "bg-gray-300 dark:bg-gray-600"
                  }`}
                >
                  <span
                    className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                      systemSettings?.registration_enabled ? "translate-x-5" : "translate-x-0"
                    }`}
                  />
                </button>
              </div>
              <div className="flex items-center justify-between rounded-xl bg-slate-50 dark:bg-muted/50 p-4 flex-1">
                <div>
                  <p className="text-sm font-medium">SMTP E-Mail</p>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Für Willkommens- und Passwort-E-Mails
                  </p>
                </div>
                {systemSettings?.smtp_configured ? (
                  <div className="flex items-center gap-1.5 text-emerald-600 dark:text-emerald-400">
                    <Mail className="h-4 w-4" />
                    <span className="text-xs font-medium">Konfiguriert</span>
                  </div>
                ) : (
                  <div className="flex items-center gap-1.5 text-muted-foreground">
                    <MailX className="h-4 w-4" />
                    <span className="text-xs font-medium">Nicht konfiguriert</span>
                  </div>
                )}
              </div>
            </div>
            <div className="flex flex-col sm:flex-row gap-4 mt-4">
              <div className="flex items-center justify-between rounded-xl bg-slate-50 dark:bg-muted/50 p-4 flex-1">
                <div>
                  <p className="text-sm font-medium">SSO / OIDC</p>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    OpenID Connect (Keycloak, Azure AD, Okta)
                  </p>
                </div>
                {ssoConfig?.sso_enabled ? (
                  <div className="flex items-center gap-1.5 text-emerald-600 dark:text-emerald-400">
                    <Shield className="h-4 w-4" />
                    <span className="text-xs font-medium">Konfiguriert</span>
                  </div>
                ) : (
                  <div className="flex items-center gap-1.5 text-muted-foreground">
                    <LockOpen className="h-4 w-4" />
                    <span className="text-xs font-medium">Nicht konfiguriert</span>
                  </div>
                )}
              </div>
              <div className="flex items-center justify-between rounded-xl bg-slate-50 dark:bg-muted/50 p-4 flex-1">
                <div>
                  <p className="text-sm font-medium">SAML 2.0</p>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Enterprise Single Sign-On
                  </p>
                </div>
                {ssoConfig?.saml_enabled ? (
                  <div className="flex items-center gap-1.5 text-emerald-600 dark:text-emerald-400">
                    <Lock className="h-4 w-4" />
                    <span className="text-xs font-medium">Konfiguriert</span>
                  </div>
                ) : (
                  <div className="flex items-center gap-1.5 text-muted-foreground">
                    <LockOpen className="h-4 w-4" />
                    <span className="text-xs font-medium">Nicht konfiguriert</span>
                  </div>
                )}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Stats */}
        <div className="grid gap-4 sm:grid-cols-3">
          <Card className="border-0 shadow-md bg-white dark:bg-card">
            <CardContent className="p-5">
              <div className="flex items-center gap-4">
                <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-sky-50 dark:bg-sky-900/20">
                  <Users className="h-6 w-6 text-sky-600" />
                </div>
                <div>
                  <p className="text-2xl font-bold text-sky-700 dark:text-sky-400">{stats?.total_users ?? "..."}</p>
                  <p className="text-xs font-medium text-muted-foreground">Benutzer</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card className="border-0 shadow-md bg-white dark:bg-card">
            <CardContent className="p-5">
              <div className="flex items-center gap-4">
                <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-emerald-50 dark:bg-emerald-900/20">
                  <FileText className="h-6 w-6 text-emerald-600" />
                </div>
                <div>
                  <p className="text-2xl font-bold text-emerald-700 dark:text-emerald-400">{stats?.total_documents ?? "..."}</p>
                  <p className="text-xs font-medium text-muted-foreground">Dokumente</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card className="border-0 shadow-md bg-white dark:bg-card">
            <CardContent className="p-5">
              <div className="flex items-center gap-4">
                <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-violet-50 dark:bg-violet-900/20">
                  <HardDrive className="h-6 w-6 text-violet-600" />
                </div>
                <div>
                  <p className="text-2xl font-bold text-violet-700 dark:text-violet-400">
                    {stats ? `${(stats.total_storage_bytes / 1024 / 1024).toFixed(1)} MB` : "..."}
                  </p>
                  <p className="text-xs font-medium text-muted-foreground">Speicher</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Users */}
        <Card className="border-0 shadow-md bg-white dark:bg-card">
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="flex items-center gap-2">
                <Users className="h-5 w-5 text-muted-foreground" />
                Benutzerverwaltung
              </CardTitle>
              <Button
                onClick={() => setShowCreateUser(true)}
                className="bg-sky-600 hover:bg-sky-700 text-sm"
                size="sm"
              >
                <UserPlus className="h-4 w-4 mr-1.5" />
                Benutzer anlegen
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow className="bg-slate-50/80 dark:bg-muted/50">
                  <TableHead>Benutzer</TableHead>
                  <TableHead>E-Mail</TableHead>
                  <TableHead>Rolle</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Registriert</TableHead>
                  <TableHead className="w-10" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {users?.map((user) => {
                  const roleCfg = roleLabels[user.role] ?? roleLabels.user;
                  const isSelf = user.id === currentUser?.id;
                  return (
                    <TableRow key={user.id}>
                      <TableCell>
                        <div className="flex items-center gap-3">
                          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-sky-500 to-blue-600 text-white text-xs font-bold">
                            {(user.full_name || user.username)[0].toUpperCase()}
                          </div>
                          <div>
                            <p className="font-medium text-sm">{user.full_name || user.username}</p>
                            <p className="text-xs text-muted-foreground">@{user.username}</p>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell className="text-sm">{user.email}</TableCell>
                      <TableCell>
                        <DropdownMenu>
                          <DropdownMenuTrigger
                            className={`inline-flex items-center gap-1.5 rounded-md border px-2.5 py-1 text-xs font-medium cursor-pointer outline-none transition-colors hover:opacity-80 ${roleCfg.color} ${isSelf ? "opacity-50 pointer-events-none" : ""}`}
                          >
                            {roleCfg.label}
                            {!isSelf && <ChevronDown className="h-3 w-3" />}
                          </DropdownMenuTrigger>
                          {!isSelf && (
                            <DropdownMenuContent align="start">
                              <DropdownMenuItem onClick={() => handleRoleChange(user.id, user.username, "admin")}>
                                <Shield className="h-4 w-4 mr-2 text-sky-600" />
                                Admin
                              </DropdownMenuItem>
                              <DropdownMenuItem onClick={() => handleRoleChange(user.id, user.username, "user")}>
                                <UserCheck className="h-4 w-4 mr-2 text-emerald-600" />
                                Benutzer
                              </DropdownMenuItem>
                              <DropdownMenuItem onClick={() => handleRoleChange(user.id, user.username, "viewer")}>
                                <Eye className="h-4 w-4 mr-2 text-amber-600" />
                                Betrachter
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          )}
                        </DropdownMenu>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1.5">
                          <Badge
                            variant="secondary"
                            className={user.is_active
                              ? "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-900/30 dark:text-emerald-300 dark:border-emerald-800"
                              : "bg-red-50 text-red-700 border-red-200 dark:bg-red-900/30 dark:text-red-300 dark:border-red-800"
                            }
                          >
                            {user.is_active ? "Aktiv" : "Gesperrt"}
                          </Badge>
                          {user.must_change_password && (
                            <Badge
                              variant="secondary"
                              className="bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-900/30 dark:text-amber-300 dark:border-amber-800"
                            >
                              PW-Änderung
                            </Badge>
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {new Date(user.created_at).toLocaleDateString("de-DE")}
                      </TableCell>
                      <TableCell>
                        {!isSelf && (
                          <DropdownMenu>
                            <DropdownMenuTrigger className="p-1 rounded hover:bg-muted cursor-pointer outline-none">
                              <MoreVertical className="h-4 w-4 text-muted-foreground" />
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuItem onClick={() => handleResetPassword(user.id, user.username)}>
                                <KeyRound className="h-4 w-4 mr-2" />
                                Passwort zurücksetzen
                              </DropdownMenuItem>
                              {user.is_active ? (
                                <DropdownMenuItem
                                  onClick={() => setConfirmUser({ id: user.id, name: user.username, action: "deactivate" })}
                                  className="text-destructive"
                                >
                                  <UserX className="h-4 w-4 mr-2" />
                                  Benutzer sperren
                                </DropdownMenuItem>
                              ) : (
                                <DropdownMenuItem
                                  onClick={() => setConfirmUser({ id: user.id, name: user.username, action: "activate" })}
                                >
                                  <UserCheck className="h-4 w-4 mr-2" />
                                  Benutzer aktivieren
                                </DropdownMenuItem>
                              )}
                            </DropdownMenuContent>
                          </DropdownMenu>
                        )}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        {/* Audit Logs */}
        <Card className="border-0 shadow-md bg-white dark:bg-card">
          <CardHeader>
            <CardTitle>Letzte Aktivitäten</CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow className="bg-slate-50/80 dark:bg-muted/50">
                  <TableHead>Aktion</TableHead>
                  <TableHead>Typ</TableHead>
                  <TableHead>Datum</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {logs?.items.map((log) => (
                  <TableRow key={log.id}>
                    <TableCell className="font-medium text-sm">{log.action}</TableCell>
                    <TableCell className="text-sm">{log.resource_type}</TableCell>
                    <TableCell className="text-muted-foreground text-sm">
                      {new Date(log.created_at).toLocaleString("de-DE")}
                    </TableCell>
                  </TableRow>
                ))}
                {(!logs?.items || logs.items.length === 0) && (
                  <TableRow>
                    <TableCell colSpan={3} className="text-center text-muted-foreground py-8">
                      Keine Aktivitäten
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>

      {/* Confirm activate/deactivate dialog */}
      <Dialog open={!!confirmUser} onOpenChange={(open) => !open && setConfirmUser(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {confirmUser?.action === "deactivate" ? "Benutzer sperren?" : "Benutzer aktivieren?"}
            </DialogTitle>
            <DialogDescription>
              {confirmUser?.action === "deactivate"
                ? `"${confirmUser?.name}" wird gesperrt und kann sich nicht mehr anmelden.`
                : `"${confirmUser?.name}" wird wieder freigeschaltet.`
              }
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <DialogClose className="inline-flex items-center justify-center rounded-lg border border-border bg-background px-4 h-9 text-sm font-medium hover:bg-muted transition-colors cursor-pointer">
              Abbrechen
            </DialogClose>
            {confirmUser?.action === "deactivate" ? (
              <Button variant="destructive" onClick={handleToggleActive}>
                Sperren
              </Button>
            ) : (
              <Button onClick={handleToggleActive} className="bg-sky-600 hover:bg-sky-700">
                Aktivieren
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Create user dialog */}
      <Dialog open={showCreateUser} onOpenChange={setShowCreateUser}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Benutzer anlegen</DialogTitle>
            <DialogDescription>
              Erstelle einen neuen Benutzer. Ohne Passwort wird ein temporäres generiert.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleCreateUser}>
            <div className="space-y-3 py-2">
              <div className="space-y-1.5">
                <Label htmlFor="create-email" className="text-xs font-medium text-muted-foreground">E-Mail *</Label>
                <Input
                  id="create-email"
                  name="email"
                  type="email"
                  required
                  placeholder="name@example.com"
                  className="h-10 rounded-xl bg-slate-50 dark:bg-slate-800 border-0 text-sm"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label htmlFor="create-username" className="text-xs font-medium text-muted-foreground">Benutzername *</Label>
                  <Input
                    id="create-username"
                    name="username"
                    required
                    placeholder="mmustermann"
                    className="h-10 rounded-xl bg-slate-50 dark:bg-slate-800 border-0 text-sm"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="create-name" className="text-xs font-medium text-muted-foreground">Name</Label>
                  <Input
                    id="create-name"
                    name="full_name"
                    placeholder="Max Mustermann"
                    className="h-10 rounded-xl bg-slate-50 dark:bg-slate-800 border-0 text-sm"
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label htmlFor="create-role" className="text-xs font-medium text-muted-foreground">Rolle</Label>
                  <select
                    id="create-role"
                    name="role"
                    defaultValue="user"
                    className="flex h-10 w-full rounded-xl bg-slate-50 dark:bg-slate-800 border-0 px-3 text-sm outline-none"
                  >
                    <option value="user">Benutzer</option>
                    <option value="admin">Admin</option>
                    <option value="viewer">Betrachter</option>
                  </select>
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="create-password" className="text-xs font-medium text-muted-foreground">Passwort (optional)</Label>
                  <Input
                    id="create-password"
                    name="password"
                    type="password"
                    placeholder="Auto-generiert"
                    minLength={8}
                    className="h-10 rounded-xl bg-slate-50 dark:bg-slate-800 border-0 text-sm"
                  />
                </div>
              </div>
            </div>
            <DialogFooter className="mt-2">
              <DialogClose className="inline-flex items-center justify-center rounded-lg border border-border bg-background px-4 h-9 text-sm font-medium hover:bg-muted transition-colors cursor-pointer">
                Abbrechen
              </DialogClose>
              <Button type="submit" className="bg-sky-600 hover:bg-sky-700" disabled={createUserLoading}>
                {createUserLoading ? (
                  <Loader2 className="h-4 w-4 mr-1.5 animate-spin" />
                ) : (
                  <UserPlus className="h-4 w-4 mr-1.5" />
                )}
                Erstellen
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Temp password result dialog (after create) */}
      <Dialog open={!!tempPasswordResult} onOpenChange={(open) => !open && setTempPasswordResult(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Benutzer erstellt</DialogTitle>
            <DialogDescription>
              Der Benutzer muss das Passwort beim ersten Login ändern.
            </DialogDescription>
          </DialogHeader>
          <div className="rounded-xl bg-slate-50 dark:bg-muted/50 p-4 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs text-muted-foreground">Benutzername</span>
              <span className="text-sm font-medium">{tempPasswordResult?.username}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-xs text-muted-foreground">Temporäres Passwort</span>
              <div className="flex items-center gap-1.5">
                <code className="text-sm font-mono bg-white dark:bg-slate-800 px-2 py-0.5 rounded">
                  {tempPasswordResult?.password}
                </code>
                <button
                  onClick={() => tempPasswordResult && copyToClipboard(tempPasswordResult.password, "temp")}
                  className="p-1 rounded hover:bg-muted cursor-pointer"
                >
                  {copiedField === "temp" ? (
                    <Check className="h-3.5 w-3.5 text-emerald-500" />
                  ) : (
                    <Copy className="h-3.5 w-3.5 text-muted-foreground" />
                  )}
                </button>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button onClick={() => setTempPasswordResult(null)} className="bg-sky-600 hover:bg-sky-700">
              Schließen
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Reset password result dialog */}
      <Dialog open={!!resetPasswordResult} onOpenChange={(open) => !open && setResetPasswordResult(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Passwort zurückgesetzt</DialogTitle>
            <DialogDescription>
              Der Benutzer muss das Passwort beim nächsten Login ändern.
            </DialogDescription>
          </DialogHeader>
          <div className="rounded-xl bg-slate-50 dark:bg-muted/50 p-4 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs text-muted-foreground">Benutzername</span>
              <span className="text-sm font-medium">{resetPasswordResult?.username}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-xs text-muted-foreground">Neues Passwort</span>
              <div className="flex items-center gap-1.5">
                <code className="text-sm font-mono bg-white dark:bg-slate-800 px-2 py-0.5 rounded">
                  {resetPasswordResult?.password}
                </code>
                <button
                  onClick={() => resetPasswordResult && copyToClipboard(resetPasswordResult.password, "reset")}
                  className="p-1 rounded hover:bg-muted cursor-pointer"
                >
                  {copiedField === "reset" ? (
                    <Check className="h-3.5 w-3.5 text-emerald-500" />
                  ) : (
                    <Copy className="h-3.5 w-3.5 text-muted-foreground" />
                  )}
                </button>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button onClick={() => setResetPasswordResult(null)} className="bg-sky-600 hover:bg-sky-700">
              Schließen
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AppShell>
  );
}
