"use client";

import { useState } from "react";
import { AppShell } from "@/components/layout/app-shell";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import {
  BookOpen, ChevronDown, ChevronRight, Copy, Lock, Unlock,
  ArrowLeft,
} from "lucide-react";
import { toast } from "sonner";

type Method = "GET" | "POST" | "PUT" | "DELETE";

interface Param {
  name: string;
  type: string;
  required?: boolean;
  description: string;
}

interface Endpoint {
  method: Method;
  path: string;
  description: string;
  auth: boolean;
  params?: Param[];
  body?: Param[];
  response?: string;
  notes?: string;
}

interface ApiSection {
  title: string;
  description: string;
  endpoints: Endpoint[];
}

const methodColors: Record<Method, string> = {
  GET: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400",
  POST: "bg-sky-100 text-sky-700 dark:bg-sky-900/30 dark:text-sky-400",
  PUT: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400",
  DELETE: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400",
};

const apiSections: ApiSection[] = [
  {
    title: "Authentifizierung",
    description: "JWT-basierte Authentifizierung mit Access- und Refresh-Tokens",
    endpoints: [
      {
        method: "POST", path: "/api/auth/register", auth: false,
        description: "Neuen Benutzer registrieren",
        body: [
          { name: "email", type: "string", required: true, description: "E-Mail-Adresse" },
          { name: "username", type: "string", required: true, description: "Benutzername" },
          { name: "password", type: "string", required: true, description: "Passwort (min. 8 Zeichen)" },
          { name: "full_name", type: "string", description: "Vollständiger Name" },
        ],
        response: "UserResponse",
      },
      {
        method: "POST", path: "/api/auth/login", auth: false,
        description: "Anmelden und Token erhalten",
        body: [
          { name: "email", type: "string", required: true, description: "E-Mail-Adresse" },
          { name: "password", type: "string", required: true, description: "Passwort" },
        ],
        response: "{ access_token, refresh_token, token_type }",
      },
      {
        method: "POST", path: "/api/auth/refresh", auth: false,
        description: "Access-Token erneuern",
        body: [{ name: "refresh_token", type: "string", required: true, description: "Refresh-Token" }],
        response: "{ access_token, refresh_token, token_type }",
      },
      {
        method: "GET", path: "/api/auth/me", auth: true,
        description: "Aktuellen Benutzer abrufen",
        response: "UserResponse",
      },
    ],
  },
  {
    title: "Dokumente",
    description: "CRUD-Operationen, Upload, Download, Versionen",
    endpoints: [
      {
        method: "GET", path: "/api/documents", auth: true,
        description: "Dokumente auflisten (paginiert)",
        params: [
          { name: "folder_id", type: "UUID", description: "Nach Ordner filtern" },
          { name: "root_only", type: "bool", description: "Nur Dokumente ohne Ordner" },
          { name: "favorites_only", type: "bool", description: "Nur Favoriten" },
          { name: "trash", type: "bool", description: "Nur gelöschte Dokumente" },
          { name: "mime_type", type: "string", description: "Nach MIME-Type filtern" },
          { name: "date_from", type: "date", description: "Ab Datum" },
          { name: "date_to", type: "date", description: "Bis Datum" },
          { name: "page", type: "int", description: "Seite (default: 1)" },
          { name: "page_size", type: "int", description: "Einträge pro Seite (max: 100)" },
        ],
        response: "{ items: DocumentResponse[], total, page, page_size }",
      },
      {
        method: "POST", path: "/api/documents", auth: true,
        description: "Dokument hochladen (multipart/form-data)",
        body: [
          { name: "file", type: "File", required: true, description: "Die Datei" },
          { name: "title", type: "string", description: "Titel (default: Dateiname)" },
          { name: "description", type: "string", description: "Beschreibung" },
          { name: "folder_id", type: "UUID", description: "Zielordner" },
          { name: "tag_ids", type: "string", description: "Kommagetrennte Tag-UUIDs" },
        ],
        response: "DocumentResponse",
        notes: "Max. 100 MB. Löst automatisch Scan, OCR, Klassifizierung aus.",
      },
      {
        method: "POST", path: "/api/documents/multi", auth: true,
        description: "Mehrere Dateien als ein Dokument hochladen",
        body: [
          { name: "files", type: "File[]", required: true, description: "Mehrere Dateien (je eine Seite)" },
          { name: "title", type: "string", required: true, description: "Dokumenttitel" },
          { name: "description", type: "string", description: "Beschreibung" },
        ],
        response: "DocumentResponse",
      },
      {
        method: "GET", path: "/api/documents/{id}", auth: true,
        description: "Dokument-Details abrufen",
        response: "DocumentResponse",
      },
      {
        method: "PUT", path: "/api/documents/{id}", auth: true,
        description: "Dokument aktualisieren",
        body: [
          { name: "title", type: "string", description: "Neuer Titel" },
          { name: "description", type: "string", description: "Neue Beschreibung" },
          { name: "folder_id", type: "UUID", description: "Neuer Ordner" },
          { name: "clear_folder", type: "bool", description: "Ins Stammverzeichnis verschieben" },
          { name: "tag_ids", type: "UUID[]", description: "Tag-IDs" },
          { name: "is_favorite", type: "bool", description: "Favorit ein/aus" },
          { name: "correspondent_id", type: "UUID", description: "Korrespondent" },
          { name: "document_type_id", type: "UUID", description: "Dokumenttyp" },
          { name: "document_date", type: "date", description: "Dokumentdatum" },
          { name: "archive_serial_number", type: "string", description: "ASN" },
        ],
        response: "DocumentResponse",
      },
      {
        method: "DELETE", path: "/api/documents/{id}", auth: true,
        description: "Dokument löschen (Papierkorb)",
        params: [{ name: "permanent", type: "bool", description: "Endgültig löschen" }],
      },
      {
        method: "POST", path: "/api/documents/{id}/restore", auth: true,
        description: "Aus Papierkorb wiederherstellen",
      },
      {
        method: "GET", path: "/api/documents/{id}/download", auth: true,
        description: "Datei herunterladen",
        response: "Binary (file content)",
      },
      {
        method: "GET", path: "/api/documents/{id}/thumbnail", auth: true,
        description: "Thumbnail abrufen",
        response: "Binary (image/webp)",
      },
      {
        method: "GET", path: "/api/documents/{id}/pages", auth: true,
        description: "Seiteninfo abrufen (Multi-Page)",
        response: "{ page_count, pages: number[] }",
      },
      {
        method: "GET", path: "/api/documents/{id}/pages/{num}", auth: true,
        description: "Einzelne Seite herunterladen",
        response: "Binary",
      },
      {
        method: "GET", path: "/api/documents/{id}/versions", auth: true,
        description: "Versionshistorie",
        response: "VersionResponse[]",
      },
      {
        method: "POST", path: "/api/documents/{id}/versions", auth: true,
        description: "Neue Version hochladen",
        body: [
          { name: "file", type: "File", required: true, description: "Neue Dateiversion" },
          { name: "comment", type: "string", description: "Versionskommentar" },
        ],
      },
      {
        method: "GET", path: "/api/documents/{id}/comments", auth: true,
        description: "Kommentare abrufen",
        response: "CommentResponse[]",
      },
      {
        method: "POST", path: "/api/documents/{id}/comments", auth: true,
        description: "Kommentar hinzufügen",
        body: [{ name: "text", type: "string", required: true, description: "Kommentartext" }],
      },
      {
        method: "POST", path: "/api/documents/bulk", auth: true,
        description: "Massenoperation auf mehrere Dokumente",
        body: [
          { name: "document_ids", type: "UUID[]", required: true, description: "Dokument-IDs" },
          { name: "action", type: "string", required: true, description: "delete, restore, move, favorite, unfavorite, tag" },
          { name: "folder_id", type: "UUID", description: "Zielordner (bei move)" },
          { name: "tag_ids", type: "UUID[]", description: "Tag-IDs (bei tag)" },
        ],
      },
    ],
  },
  {
    title: "Ordner",
    description: "Hierarchische Ordnerstruktur",
    endpoints: [
      { method: "GET", path: "/api/folders", auth: true, description: "Root-Ordner auflisten", params: [{ name: "parent_id", type: "UUID", description: "Unterordner auflisten" }] },
      { method: "POST", path: "/api/folders", auth: true, description: "Ordner erstellen", body: [{ name: "name", type: "string", required: true, description: "Ordnername" }, { name: "parent_id", type: "UUID", description: "Elternordner" }] },
      { method: "GET", path: "/api/folders/{id}", auth: true, description: "Ordner mit Unterordnern" },
      { method: "GET", path: "/api/folders/{id}/breadcrumb", auth: true, description: "Pfad zum Ordner" },
      { method: "PUT", path: "/api/folders/{id}", auth: true, description: "Ordner umbenennen/verschieben" },
      { method: "DELETE", path: "/api/folders/{id}", auth: true, description: "Ordner löschen" },
    ],
  },
  {
    title: "Tags",
    description: "Farbige Labels für Dokumente",
    endpoints: [
      { method: "GET", path: "/api/tags", auth: true, description: "Alle Tags auflisten" },
      { method: "POST", path: "/api/tags", auth: true, description: "Tag erstellen", body: [{ name: "name", type: "string", required: true, description: "Tag-Name" }, { name: "color", type: "string", description: "Hex-Farbe (#3b82f6)" }] },
      { method: "PUT", path: "/api/tags/{id}", auth: true, description: "Tag bearbeiten" },
      { method: "DELETE", path: "/api/tags/{id}", auth: true, description: "Tag löschen" },
    ],
  },
  {
    title: "Suche",
    description: "PostgreSQL Volltext-Suche mit Ranking",
    endpoints: [
      {
        method: "GET", path: "/api/search", auth: true, description: "Volltextsuche",
        params: [
          { name: "q", type: "string", required: true, description: "Suchbegriff" },
          { name: "folder_id", type: "UUID", description: "Auf Ordner beschränken" },
          { name: "mime_type", type: "string", description: "Nach MIME-Type filtern" },
          { name: "page", type: "int", description: "Seite" },
          { name: "page_size", type: "int", description: "Einträge pro Seite" },
        ],
        response: "{ items: SearchResult[], total, query }",
      },
    ],
  },
  {
    title: "Share-Links",
    description: "Öffentliche Links mit optionalem Passwort",
    endpoints: [
      { method: "POST", path: "/api/documents/{id}/share", auth: true, description: "Share-Link erstellen", body: [{ name: "expires_in_hours", type: "int", description: "Gültigkeit in Stunden" }, { name: "password", type: "string", description: "Optionales Passwort" }, { name: "max_downloads", type: "int", description: "Max. Downloads" }] },
      { method: "GET", path: "/api/documents/{id}/shares", auth: true, description: "Share-Links eines Dokuments" },
      { method: "DELETE", path: "/api/shares/{id}", auth: true, description: "Share-Link widerrufen" },
      { method: "GET", path: "/api/shared/{token}", auth: false, description: "Geteiltes Dokument ansehen" },
      { method: "GET", path: "/api/shared/{token}/download", auth: false, description: "Geteiltes Dokument herunterladen" },
    ],
  },
  {
    title: "Korrespondenten",
    description: "Absender/Empfänger von Dokumenten",
    endpoints: [
      { method: "GET", path: "/api/correspondents", auth: true, description: "Alle Korrespondenten" },
      { method: "POST", path: "/api/correspondents", auth: true, description: "Erstellen", body: [{ name: "name", type: "string", required: true, description: "Name" }, { name: "match_pattern", type: "string", description: "Auto-Match Pattern" }] },
      { method: "PUT", path: "/api/correspondents/{id}", auth: true, description: "Bearbeiten" },
      { method: "DELETE", path: "/api/correspondents/{id}", auth: true, description: "Löschen" },
    ],
  },
  {
    title: "Dokumenttypen",
    description: "Kategorisierung von Dokumenten",
    endpoints: [
      { method: "GET", path: "/api/document-types", auth: true, description: "Alle Dokumenttypen" },
      { method: "POST", path: "/api/document-types", auth: true, description: "Erstellen", body: [{ name: "name", type: "string", required: true, description: "Name" }, { name: "match_pattern", type: "string", description: "Auto-Match Pattern" }] },
      { method: "PUT", path: "/api/document-types/{id}", auth: true, description: "Bearbeiten" },
      { method: "DELETE", path: "/api/document-types/{id}", auth: true, description: "Löschen" },
    ],
  },
  {
    title: "Zuordnungsregeln",
    description: "Automatische Klassifizierung basierend auf OCR-Text",
    endpoints: [
      { method: "GET", path: "/api/matching-rules", auth: true, description: "Alle Regeln (nach Priorität)" },
      { method: "POST", path: "/api/matching-rules", auth: true, description: "Regel erstellen" },
      { method: "PUT", path: "/api/matching-rules/{id}", auth: true, description: "Regel bearbeiten" },
      { method: "DELETE", path: "/api/matching-rules/{id}", auth: true, description: "Regel löschen" },
      { method: "POST", path: "/api/matching-rules/test", auth: true, description: "Regel gegen Text testen", body: [{ name: "text", type: "string", required: true, description: "Testtext" }] },
    ],
  },
  {
    title: "Export",
    description: "Dokumente als ZIP-Archiv exportieren",
    endpoints: [
      { method: "GET", path: "/api/export", auth: true, description: "Alle Dokumente als ZIP", response: "Binary (ZIP)" },
      { method: "GET", path: "/api/export/{id}", auth: true, description: "Einzelnes Dokument als ZIP mit Metadaten", response: "Binary (ZIP)" },
    ],
  },
  {
    title: "Admin",
    description: "Benutzerverwaltung und Audit-Log (Admin-Rolle erforderlich)",
    endpoints: [
      { method: "GET", path: "/api/admin/users", auth: true, description: "Alle Benutzer" },
      { method: "PUT", path: "/api/admin/users/{id}", auth: true, description: "Rolle/Status ändern", body: [{ name: "role", type: "admin|user|viewer", description: "Neue Rolle" }, { name: "is_active", type: "bool", description: "Aktiv/Gesperrt" }] },
      { method: "GET", path: "/api/admin/audit-logs", auth: true, description: "Audit-Log abfragen" },
      { method: "GET", path: "/api/admin/stats", auth: true, description: "System-Statistiken" },
    ],
  },
  {
    title: "Einstellungen",
    description: "API-Schlüssel und Webhooks",
    endpoints: [
      { method: "GET", path: "/api/settings/api-keys", auth: true, description: "API-Schlüssel auflisten" },
      { method: "POST", path: "/api/settings/api-keys", auth: true, description: "Neuen Schlüssel erstellen", response: "{ id, name, key, prefix }" },
      { method: "DELETE", path: "/api/settings/api-keys/{id}", auth: true, description: "Schlüssel widerrufen" },
      { method: "GET", path: "/api/settings/webhooks", auth: true, description: "Webhooks auflisten" },
      { method: "POST", path: "/api/settings/webhooks", auth: true, description: "Webhook erstellen" },
      { method: "PUT", path: "/api/settings/webhooks/{id}", auth: true, description: "Webhook bearbeiten" },
      { method: "DELETE", path: "/api/settings/webhooks/{id}", auth: true, description: "Webhook löschen" },
      { method: "POST", path: "/api/settings/webhooks/{id}/test", auth: true, description: "Test-Event senden" },
    ],
  },
];

export default function ApiDocsPage() {
  const [openSection, setOpenSection] = useState<string>("Dokumente");
  const [openEndpoint, setOpenEndpoint] = useState<string | null>(null);

  const copyPath = (path: string) => {
    navigator.clipboard.writeText(path);
    toast.success("Kopiert");
  };

  return (
    <AppShell>
      <div className="max-w-5xl mx-auto space-y-8">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
              <BookOpen className="h-6 w-6 text-sky-600" />
              API-Dokumentation
            </h1>
            <p className="text-sm text-muted-foreground mt-1">REST-API Referenz für Kabineo</p>
          </div>
          <Link href="/help">
            <Button variant="outline" size="sm">
              <ArrowLeft className="mr-2 h-4 w-4" />
              Zurück zur Hilfe
            </Button>
          </Link>
        </div>

        {/* Auth info */}
        <Card className="border-0 shadow-md bg-white dark:bg-card">
          <CardContent className="p-5">
            <h3 className="font-bold text-sm mb-3">Authentifizierung</h3>
            <div className="space-y-3 text-sm">
              <p className="text-muted-foreground">Alle geschützten Endpoints erfordern einen JWT-Token oder API-Schlüssel im Authorization-Header:</p>
              <div className="bg-slate-900 dark:bg-slate-950 rounded-xl p-4 font-mono text-sm text-slate-300">
                <div className="text-slate-500 text-xs mb-2"># Mit JWT-Token</div>
                <div>Authorization: Bearer <span className="text-emerald-400">eyJhbGci...</span></div>
                <div className="text-slate-500 text-xs mb-2 mt-4"># Mit API-Schlüssel</div>
                <div>Authorization: Bearer <span className="text-amber-400">dms_k1a2b3c4...</span></div>
              </div>
              <p className="text-muted-foreground">Base-URL: <code className="bg-muted px-2 py-0.5 rounded text-xs">http://localhost:8000</code></p>
            </div>
          </CardContent>
        </Card>

        {/* Endpoint sections */}
        <div className="space-y-3">
          {apiSections.map((section) => {
            const isOpen = openSection === section.title;
            return (
              <Card key={section.title} className="border-0 shadow-sm bg-white dark:bg-card overflow-hidden">
                <button
                  onClick={() => setOpenSection(isOpen ? "" : section.title)}
                  className="w-full flex items-center gap-3 p-4 text-left hover:bg-muted/30 transition-colors cursor-pointer"
                >
                  <div className="flex-1">
                    <h3 className="font-bold text-sm">{section.title}</h3>
                    <p className="text-xs text-muted-foreground mt-0.5">{section.description}</p>
                  </div>
                  <Badge variant="secondary" className="text-[10px] mr-2">{section.endpoints.length} Endpoints</Badge>
                  {isOpen ? <ChevronDown className="h-4 w-4 text-muted-foreground" /> : <ChevronRight className="h-4 w-4 text-muted-foreground" />}
                </button>

                {isOpen && (
                  <div className="border-t border-border/50">
                    {section.endpoints.map((ep) => {
                      const epKey = `${ep.method}:${ep.path}`;
                      const epOpen = openEndpoint === epKey;
                      return (
                        <div key={epKey} className="border-b border-border/30 last:border-b-0">
                          <button
                            onClick={() => setOpenEndpoint(epOpen ? null : epKey)}
                            className="w-full flex items-center gap-3 px-5 py-3 text-left hover:bg-muted/20 transition-colors cursor-pointer"
                          >
                            <Badge className={`text-[11px] font-bold px-2 py-0.5 ${methodColors[ep.method]}`}>
                              {ep.method}
                            </Badge>
                            <code className="text-sm font-mono flex-1 truncate">{ep.path}</code>
                            <span className="text-xs text-muted-foreground hidden sm:block">{ep.description}</span>
                            {ep.auth ? <Lock className="h-3 w-3 text-amber-500" /> : <Unlock className="h-3 w-3 text-emerald-500" />}
                          </button>

                          {epOpen && (
                            <div className="px-5 pb-4 space-y-3">
                              <div className="flex items-center gap-2">
                                <p className="text-sm text-muted-foreground flex-1">{ep.description}</p>
                                <button onClick={() => copyPath(ep.path)} className="p-1 rounded hover:bg-muted cursor-pointer">
                                  <Copy className="h-3.5 w-3.5 text-muted-foreground" />
                                </button>
                              </div>

                              {ep.params && ep.params.length > 0 && (
                                <div>
                                  <h5 className="text-xs font-bold text-muted-foreground mb-2">Query-Parameter</h5>
                                  <div className="rounded-lg border border-border/50 overflow-hidden">
                                    {ep.params.map((p) => (
                                      <div key={p.name} className="flex items-start gap-3 px-3 py-2 text-sm border-b border-border/30 last:border-b-0 bg-slate-50/50 dark:bg-muted/20">
                                        <code className="text-xs font-mono text-sky-700 dark:text-sky-400 min-w-[120px]">{p.name}</code>
                                        <span className="text-[10px] text-muted-foreground bg-muted px-1.5 py-0.5 rounded">{p.type}</span>
                                        {p.required && <span className="text-[10px] text-red-500 font-bold">*</span>}
                                        <span className="text-xs text-muted-foreground flex-1">{p.description}</span>
                                      </div>
                                    ))}
                                  </div>
                                </div>
                              )}

                              {ep.body && ep.body.length > 0 && (
                                <div>
                                  <h5 className="text-xs font-bold text-muted-foreground mb-2">Request-Body</h5>
                                  <div className="rounded-lg border border-border/50 overflow-hidden">
                                    {ep.body.map((p) => (
                                      <div key={p.name} className="flex items-start gap-3 px-3 py-2 text-sm border-b border-border/30 last:border-b-0 bg-slate-50/50 dark:bg-muted/20">
                                        <code className="text-xs font-mono text-sky-700 dark:text-sky-400 min-w-[120px]">{p.name}</code>
                                        <span className="text-[10px] text-muted-foreground bg-muted px-1.5 py-0.5 rounded">{p.type}</span>
                                        {p.required && <span className="text-[10px] text-red-500 font-bold">*</span>}
                                        <span className="text-xs text-muted-foreground flex-1">{p.description}</span>
                                      </div>
                                    ))}
                                  </div>
                                </div>
                              )}

                              {ep.response && (
                                <div>
                                  <h5 className="text-xs font-bold text-muted-foreground mb-1">Response</h5>
                                  <code className="text-xs font-mono text-emerald-700 dark:text-emerald-400">{ep.response}</code>
                                </div>
                              )}

                              {ep.notes && (
                                <p className="text-xs text-muted-foreground italic">{ep.notes}</p>
                              )}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </Card>
            );
          })}
        </div>

        {/* Swagger hint */}
        <Card className="border-0 shadow-sm bg-white dark:bg-card">
          <CardContent className="p-5 text-center">
            <p className="text-sm text-muted-foreground">
              Interaktive API-Dokumentation (Swagger UI) verfügbar unter{" "}
              <code className="bg-muted px-2 py-0.5 rounded text-xs font-mono">http://localhost:8000/docs</code>
            </p>
          </CardContent>
        </Card>
      </div>
    </AppShell>
  );
}
