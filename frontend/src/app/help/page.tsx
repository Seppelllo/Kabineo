"use client";

import { useState } from "react";
import { AppShell } from "@/components/layout/app-shell";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import {
  FileText, Upload, FolderOpen, Search, Star, Trash2, Tags, MessageCircle,
  Users, FileType, Wand2, Mail, Key, Webhook, QrCode,
  Calendar, Shield, Share2, CheckSquare, Moon, CloudUpload,
  Bot, Layers, Download, Eye, HelpCircle, ChevronDown, ChevronRight,
  Zap, BookOpen, ArrowRight, Lock, Bell, Keyboard,
} from "lucide-react";

interface Section {
  id: string;
  icon: typeof FileText;
  title: string;
  color: string;
  bg: string;
  items: { title: string; description: string }[];
}

const categories = [
  {
    label: "Grundlagen",
    sections: [
      {
        id: "upload", icon: Upload, title: "Dokumente hochladen", color: "text-sky-600", bg: "bg-sky-50 dark:bg-sky-900/20",
        items: [
          { title: "Einzelner Upload", description: "Gehe zu \"Upload\" in der Sidebar oder klicke auf den \"Hochladen\" Button. Ziehe Dateien in den Bereich oder klicke zum Auswählen. Du kannst Titel und Beschreibung pro Datei anpassen." },
          { title: "Mehrseitiges Dokument", description: "Wenn du mehrere Dateien hochlädst, aktiviere \"Als einzelnes Dokument (mehrseitig)\". Alle Dateien werden zu einem Dokument zusammengefasst — ideal für gescannte Dokumente mit mehreren Seiten." },
          { title: "Automatische Verarbeitung", description: "Nach dem Upload startet automatisch: Dokumenterkennung (Ausschneiden aus Foto), OCR-Texterkennung, Datumsextraktion, Barcode-Scan, automatische Klassifizierung und Thumbnail-Erstellung." },
          { title: "Duplikat-Erkennung", description: "Jede Datei wird mit einem SHA256-Hash versehen. Wenn du dieselbe Datei erneut hochlädst, wirst du gewarnt." },
          { title: "Thumbnail-Vorschau", description: "Dokumente werden in der Kartenansicht mit Vorschaubild angezeigt (wie Paperless). Thumbnail kann bei Problemen neu generiert werden." },
        ],
      },
      {
        id: "folders", icon: FolderOpen, title: "Ordner & Organisation", color: "text-amber-600", bg: "bg-amber-50 dark:bg-amber-900/20",
        items: [
          { title: "Ordner erstellen", description: "Auf der Dokumente-Seite klicke \"Neuer Ordner\". Ordner können verschachtelt werden — klicke auf einen Ordner um hineinzunavigieren." },
          { title: "Drag & Drop", description: "Ziehe ein Dokument per Drag & Drop auf einen Ordner. Der Ordner leuchtet blau auf wenn du darüber fährst." },
          { title: "Breadcrumb-Navigation", description: "Über den Ordnern siehst du den aktuellen Pfad (z.B. Alle Dokumente > Rechnungen > 2026). Klicke auf einen Eintrag um dorthin zu springen." },
          { title: "Ordner umbenennen", description: "Drei-Punkte-Menü auf einem Ordner → \"Umbenennen\" → Name inline bearbeiten." },
          { title: "Ordner-Berechtigungen", description: "In einem Ordner → \"Freigabe\" Button → User oder Gruppen mit Lesen/Schreiben/Admin Berechtigung hinzufügen." },
        ],
      },
      {
        id: "search", icon: Search, title: "Suche & Filter", color: "text-violet-600", bg: "bg-violet-50 dark:bg-violet-900/20",
        items: [
          { title: "Volltextsuche", description: "Durchsucht Titel, Beschreibung UND den OCR-erkannten Text aller Dokumente. Treffer werden hervorgehoben." },
          { title: "Erweiterte Filter", description: "Filtere nach Dateityp (PDF, Bild, Office), Datumsbereich, Korrespondent und Dokumenttyp." },
          { title: "Tag-Filter", description: "Klicke auf einen Tag um nur Dokumente mit diesem Tag anzuzeigen. Mehrere Tags können kombiniert werden." },
          { title: "Schnellsuche (⌘K)", description: "Drücke ⌘K (oder Ctrl+K) für eine Spotlight-artige Sofortsuche. Ergebnisse erscheinen während du tippst." },
        ],
      },
      {
        id: "tags", icon: Tags, title: "Tags", color: "text-emerald-600", bg: "bg-emerald-50 dark:bg-emerald-900/20",
        items: [
          { title: "Tags zuweisen", description: "Öffne ein Dokument → \"Tags\" → \"Bearbeiten\". Wähle bestehende Tags oder erstelle neue mit automatischer Farbzuweisung." },
          { title: "Bulk-Tagging", description: "Aktiviere den Auswahl-Modus, wähle mehrere Dokumente und klicke \"Taggen\" in der Aktionsleiste am unteren Rand." },
        ],
      },
    ],
  },
  {
    label: "Organisation",
    sections: [
      {
        id: "favorites", icon: Star, title: "Favoriten", color: "text-amber-500", bg: "bg-amber-50 dark:bg-amber-900/20",
        items: [
          { title: "Favorit markieren", description: "Klicke den Stern auf einer Dokument-Karte oder in der Detailansicht." },
          { title: "Favoriten-Ansicht", description: "\"Favoriten\" in der Sidebar zeigt alle markierten Dokumente." },
          { title: "Drag & Drop", description: "Dokumente können per Drag & Drop in Ordner verschoben werden." },
        ],
      },
      {
        id: "trash", icon: Trash2, title: "Papierkorb", color: "text-red-600", bg: "bg-red-50 dark:bg-red-900/20",
        items: [
          { title: "Soft-Delete", description: "Gelöschte Dokumente landen im Papierkorb und können wiederhergestellt werden." },
          { title: "Endgültig löschen", description: "Im Papierkorb: \"Endgültig löschen\" entfernt das Dokument und die Datei unwiderruflich." },
        ],
      },
      {
        id: "correspondents", icon: Users, title: "Korrespondenten", color: "text-blue-600", bg: "bg-blue-50 dark:bg-blue-900/20",
        items: [
          { title: "Was sind Korrespondenten?", description: "Absender oder Empfänger — Firmen, Behörden, Personen. Jedes Dokument kann einem Korrespondenten zugeordnet werden." },
          { title: "Auto-Matching", description: "Setze ein Match-Pattern (z.B. \"Telekom\"). Wenn der OCR-Text eines neuen Dokuments dieses Muster enthält, wird der Korrespondent automatisch zugewiesen." },
        ],
      },
      {
        id: "doctypes", icon: FileType, title: "Dokumenttypen", color: "text-indigo-600", bg: "bg-indigo-50 dark:bg-indigo-900/20",
        items: [
          { title: "Kategorisierung", description: "Typen wie Rechnung, Vertrag, Brief, Quittung. In der Detailansicht per Dropdown zuweisen." },
          { title: "Automatisch", description: "Über Zuordnungsregeln werden Dokumenttypen automatisch basierend auf dem OCR-Text gesetzt." },
        ],
      },
      {
        id: "rules", icon: Wand2, title: "Zuordnungsregeln", color: "text-purple-600", bg: "bg-purple-50 dark:bg-purple-900/20",
        items: [
          { title: "Funktionsweise", description: "Regeln werden nach jedem OCR-Scan auf den Text angewendet. Die Regel mit der höchsten Priorität (niedrigste Nummer) gewinnt." },
          { title: "Match-Typen", description: "Keyword: Alle Wörter müssen vorkommen. Regex: Regulärer Ausdruck. Exact: Exakte Übereinstimmung." },
          { title: "Aktionen", description: "Eine Regel kann zuweisen: Korrespondent, Dokumenttyp, Tags und/oder Ordner." },
          { title: "Beispiel", description: "Pattern \"Rechnung\" + \"Telekom\" → Korrespondent=Telekom, Typ=Rechnung, Ordner=Rechnungen, Tag=Bezahlt" },
        ],
      },
      {
        id: "groups", icon: Users, title: "Gruppen", color: "text-violet-600", bg: "bg-violet-50 dark:bg-violet-900/20",
        items: [
          { title: "Gruppen erstellen", description: "Admin kann Gruppen erstellen und User zuweisen. Jeder User bekommt eine Benachrichtigung." },
          { title: "Beitrittsanfragen", description: "User können über die Gruppen-Seite eine Beitrittsanfrage senden. Admin genehmigt oder lehnt ab." },
          { title: "Ordner-Gruppenfreigabe", description: "Ordner können an ganze Gruppen freigegeben werden — alle Mitglieder sehen die Dokumente." },
        ],
      },
      {
        id: "doc-sharing", icon: Share2, title: "Dokument-Freigabe", color: "text-green-600", bg: "bg-green-50 dark:bg-green-900/20",
        items: [
          { title: "Für User freigeben", description: "In der Detailansicht → Freigaben → User auswählen mit Berechtigung (Lesen oder Lesen & Bearbeiten)." },
          { title: "Für alle freigeben", description: "Wähle \"Alle Benutzer\" um das Dokument für jeden sichtbar zu machen." },
          { title: "Freigegebene Dokumente", description: "Freigegebene Dokumente erscheinen automatisch in der Dokumentenliste des Empfängers." },
        ],
      },
      {
        id: "retention", icon: Calendar, title: "Aufbewahrungsfristen", color: "text-teal-600", bg: "bg-teal-50 dark:bg-teal-900/20",
        items: [
          { title: "Ablaufdatum", description: "In der Detailansicht unter \"Aufbewahrung bis\" ein Datum setzen. Nützlich für Verträge, Lizenzen, Fristen." },
        ],
      },
    ],
  },
  {
    label: "Automatisierung",
    sections: [
      {
        id: "ocr", icon: Eye, title: "OCR & Scanner", color: "text-cyan-600", bg: "bg-cyan-50 dark:bg-cyan-900/20",
        items: [
          { title: "Texterkennung", description: "Tesseract OCR erkennt Text in Bildern und PDFs auf Deutsch und Englisch. Der Text wird durchsuchbar gemacht." },
          { title: "Dokumenten-Scanner", description: "Fotos von Dokumenten werden automatisch zugeschnitten und gerade gerückt. Das Original bleibt als Backup." },
        ],
      },
      {
        id: "date", icon: Calendar, title: "Datum & Barcode", color: "text-teal-600", bg: "bg-teal-50 dark:bg-teal-900/20",
        items: [
          { title: "Datumsextraktion", description: "Erkennt automatisch DD.MM.YYYY, YYYY-MM-DD und deutsche Monatsnamen im OCR-Text." },
          { title: "Barcode/QR-Code", description: "Scannt Barcodes und QR-Codes. ASN-Pattern (z.B. \"ASN-001234\") wird als Archiv-Seriennummer gesetzt." },
        ],
      },
      {
        id: "email", icon: Mail, title: "E-Mail Import", color: "text-red-500", bg: "bg-red-50 dark:bg-red-900/20",
        items: [
          { title: "IMAP-Polling", description: "Setze IMAP_ENABLED=true und die Zugangsdaten in .env. Alle 5 Minuten werden neue E-Mails mit Anhängen importiert." },
          { title: "Automatisch", description: "Absender wird als Korrespondent angelegt, Betreff als Titel. Anhänge durchlaufen die volle Verarbeitungskette." },
        ],
      },
      {
        id: "consume", icon: CloudUpload, title: "Consume-Ordner", color: "text-emerald-500", bg: "bg-emerald-50 dark:bg-emerald-900/20",
        items: [
          { title: "Ordner-Watch", description: "CONSUME_FOLDER_PATH in .env setzen. Alle 30 Sekunden werden neue Dateien importiert und nach \"processed\" verschoben." },
        ],
      },
    ],
  },
  {
    label: "Teilen & Zusammenarbeit",
    sections: [
      {
        id: "share", icon: Share2, title: "Share-Links", color: "text-green-600", bg: "bg-green-50 dark:bg-green-900/20",
        items: [
          { title: "Link erstellen", description: "In der Detailansicht → Share-Link generieren. 72 Stunden gültig, optional mit Passwort und Download-Limit." },
          { title: "Öffentlich", description: "Empfänger können das Dokument ohne Account ansehen und herunterladen." },
        ],
      },
      {
        id: "comments", icon: MessageCircle, title: "Kommentare", color: "text-pink-600", bg: "bg-pink-50 dark:bg-pink-900/20",
        items: [
          { title: "Web & Telegram", description: "Kommentare unter der Dokumentvorschau schreiben. Auch per Telegram über den Kommentar-Button möglich." },
        ],
      },
      {
        id: "bulk", icon: CheckSquare, title: "Bulk-Operationen", color: "text-sky-600", bg: "bg-sky-50 dark:bg-sky-900/20",
        items: [
          { title: "Mehrfachauswahl", description: "\"Auswählen\" aktivieren → Checkboxen → Aktionsleiste: Löschen, Verschieben, Favorit, Tags zuweisen." },
        ],
      },
      {
        id: "versions", icon: Layers, title: "Versionen", color: "text-orange-600", bg: "bg-orange-50 dark:bg-orange-900/20",
        items: [
          { title: "Versionshistorie", description: "Jedes Dokument zeigt alle Versionen mit Datum, Größe und Kommentar." },
          { title: "Neue Version", description: "Button \"Neue Version\" in der Versionen-Card → Datei + optionaler Kommentar hochladen." },
          { title: "Alte Version herunterladen", description: "Klick auf Download-Icon neben einer älteren Version." },
        ],
      },
      {
        id: "pages", icon: Layers, title: "Seitenmanagement", color: "text-sky-600", bg: "bg-sky-50 dark:bg-sky-900/20",
        items: [
          { title: "Seiten verwalten", description: "Bei mehrseitigen Dokumenten → \"Seiten verwalten\" Button in der Seitennavigation." },
          { title: "Drehen", description: "Einzelne Seiten im/gegen Uhrzeigersinn drehen." },
          { title: "Reihenfolge", description: "Seiten per Pfeil-Buttons nach oben/unten verschieben und speichern." },
          { title: "Extrahieren", description: "Eine Seite als eigenständiges neues Dokument extrahieren." },
          { title: "Löschen", description: "Einzelne Seiten aus dem Dokument entfernen." },
        ],
      },
    ],
  },
  {
    label: "Integration",
    sections: [
      {
        id: "telegram", icon: Bot, title: "Telegram-Bot", color: "text-blue-500", bg: "bg-blue-50 dark:bg-blue-900/20",
        items: [
          { title: "Einrichten", description: "Einstellungen → Telegram → Link-Code generieren → an Bot senden mit /link." },
          { title: "Voll interaktiv", description: "Hauptmenü mit Buttons nach jeder Aktion. Dokumente hochladen, suchen, durchblättern, herunterladen, taggen, kommentieren — alles ohne Commands." },
          { title: "Mehrseitig", description: "\"Mehrseitig hochladen\" im Menü → Titel eingeben → Dateien/Fotos senden → \"Fertig\" tippen." },
        ],
      },
      {
        id: "api", icon: Key, title: "API & Webhooks", color: "text-yellow-600", bg: "bg-yellow-50 dark:bg-yellow-900/20",
        items: [
          { title: "API-Schlüssel", description: "Einstellungen → API-Schlüssel → Neu. Schlüssel wird nur einmal angezeigt. Als Bearer Token verwenden." },
          { title: "Webhooks", description: "HTTP-Benachrichtigungen bei Events (document.created, ocr_completed). HMAC-SHA256 signiert." },
          { title: "API-Dokumentation", description: "Vollständige REST-API Dokumentation unter /api-docs in der Sidebar." },
          { title: "Export", description: "Alle Dokumente als ZIP-Archiv herunterladen. Jedes Dokument enthält die Datei und eine metadata.json." },
        ],
      },
      {
        id: "admin", icon: Shield, title: "Administration", color: "text-sky-700", bg: "bg-sky-50 dark:bg-sky-900/20",
        items: [
          { title: "Benutzerverwaltung", description: "Rollen: Admin, Benutzer, Betrachter. Benutzer sperren/aktivieren." },
          { title: "Audit-Log", description: "Alle Aktionen werden protokolliert: Uploads, Löschungen, Änderungen." },
          { title: "User anlegen", description: "Admin kann unter Administration → \"Benutzer anlegen\" neue User erstellen. Ein Temp-Passwort wird generiert." },
          { title: "Passwort zurücksetzen", description: "Im Drei-Punkte-Menü eines Users → \"Passwort zurücksetzen\". Neues Temp-Passwort wird angezeigt." },
          { title: "Registrierung steuern", description: "In den Systemeinstellungen kann der Admin die öffentliche Registrierung ein-/ausschalten." },
          { title: "Passwort-Änderungspflicht", description: "Vom Admin erstellte User müssen beim ersten Login ihr Passwort ändern." },
          { title: "SMTP", description: "Wenn konfiguriert, werden Welcome-Mails und Passwort-Reset-Mails automatisch versendet." },
        ],
      },
      {
        id: "sso", icon: Lock, title: "SSO & SAML", color: "text-violet-700", bg: "bg-violet-50 dark:bg-violet-900/20",
        items: [
          { title: "OIDC mit Keycloak", description: "Setze SSO_ENABLED=true und konfiguriere SSO_CLIENT_ID, SSO_CLIENT_SECRET sowie die Keycloak-URLs (Authorization, Token, UserInfo) in der .env Datei. Erstelle in Keycloak einen Client mit Redirect-URI http://localhost:3000/auth/callback." },
          { title: "Andere OIDC-Provider", description: "Azure AD, Okta, Google und Auth0 werden ebenfalls unterstützt. Konfiguriere die entsprechenden OIDC-Endpunkte (Authorization URL, Token URL, UserInfo URL) in den SSO_*-Umgebungsvariablen." },
          { title: "SAML 2.0", description: "Setze SAML_ENABLED=true, SAML_ENTITY_ID (Service Provider ID) und SAML_SSO_URL (IdP SSO Endpoint). Die Attribut-Mappings (E-Mail, Benutzername, Name) können über SAML_ATTRIBUTE_* angepasst werden." },
          { title: "Automatische Benutzererstellung", description: "SSO_AUTO_CREATE_USERS=true erstellt beim ersten SSO-Login automatisch einen Benutzer. Die Standard-Rolle wird über SSO_DEFAULT_ROLE festgelegt (user, admin oder viewer)." },
          { title: "Konfigurationsvariablen", description: "SSO_ENABLED, SSO_PROVIDER_NAME, SSO_CLIENT_ID, SSO_CLIENT_SECRET, SSO_AUTHORIZATION_URL, SSO_TOKEN_URL, SSO_USERINFO_URL, SSO_REDIRECT_URI, SSO_SCOPES, SSO_AUTO_CREATE_USERS, SSO_DEFAULT_ROLE. Für SAML: SAML_ENABLED, SAML_ENTITY_ID, SAML_SSO_URL, SAML_CERTIFICATE." },
        ],
      },
      {
        id: "notifications", icon: Bell, title: "Benachrichtigungen", color: "text-amber-600", bg: "bg-amber-50 dark:bg-amber-900/20",
        items: [
          { title: "In-App", description: "Glocke im Header zeigt ungelesene Anzahl. Klick öffnet Dropdown mit allen Benachrichtigungen." },
          { title: "Automatisch", description: "Du wirst benachrichtigt bei: Gruppenzuweisung, Beitrittsanfrage genehmigt/abgelehnt, Dokument geteilt." },
          { title: "Telegram", description: "Benachrichtigungen werden auch per Telegram gesendet wenn dein Account verknüpft ist." },
        ],
      },
    ],
  },
  {
    label: "Darstellung & Bedienung",
    sections: [
      {
        id: "darkmode", icon: Moon, title: "Dark Mode", color: "text-slate-600", bg: "bg-slate-50 dark:bg-slate-900/20",
        items: [
          { title: "Umschalten", description: "Mond/Sonnen-Symbol im Header. Einstellung wird in localStorage gespeichert." },
        ],
      },
      {
        id: "pwa", icon: Download, title: "PWA", color: "text-blue-600", bg: "bg-blue-50 dark:bg-blue-900/20",
        items: [
          { title: "App installieren", description: "Kabineo kann als App auf dem Homescreen installiert werden (Chrome → Installieren, Safari → Zum Home-Bildschirm)." },
          { title: "Offline", description: "Die App-Shell wird gecacht und lädt auch ohne Internetverbindung." },
        ],
      },
      {
        id: "lightbox", icon: Eye, title: "Lightbox", color: "text-cyan-600", bg: "bg-cyan-50 dark:bg-cyan-900/20",
        items: [
          { title: "Bildvergrößerung", description: "Klick auf ein Dokument-Bild öffnet es im Vollbild. Bei mehrseitigen Dokumenten Pfeil-Navigation." },
          { title: "Schließen", description: "Escape-Taste oder Klick auf den Hintergrund." },
        ],
      },
      {
        id: "shortcuts", icon: Keyboard, title: "Keyboard Shortcuts", color: "text-indigo-600", bg: "bg-indigo-50 dark:bg-indigo-900/20",
        items: [
          { title: "Übersicht", description: "Drücke ? um alle Tastenkombinationen anzuzeigen." },
          { title: "⌘K Suche", description: "Spotlight-Suche öffnen." },
          { title: "Escape", description: "Dialoge, Lightbox und Overlays schließen." },
        ],
      },
    ],
  },
];

const telegramCommands = [
  { cmd: "/start", desc: "Hauptmenü anzeigen", cat: "Allgemein" },
  { cmd: "/link <code>", desc: "Account verknüpfen", cat: "Allgemein" },
  { cmd: "/recent", desc: "Letzte 10 Dokumente", cat: "Dokumente" },
  { cmd: "/favorites", desc: "Favoriten anzeigen", cat: "Dokumente" },
  { cmd: "/search <text>", desc: "Volltextsuche", cat: "Dokumente" },
  { cmd: "/folders", desc: "Ordner durchsuchen", cat: "Ordner" },
  { cmd: "/newfolder <name>", desc: "Neuen Ordner erstellen", cat: "Ordner" },
  { cmd: "/move", desc: "Dokument verschieben", cat: "Ordner" },
  { cmd: "/merge", desc: "Mehrseitiges Dokument", cat: "Upload" },
  { cmd: "/rename <name>", desc: "Umbenennen", cat: "Bearbeiten" },
  { cmd: "/share", desc: "Share-Link erstellen", cat: "Bearbeiten" },
  { cmd: "/comment", desc: "Kommentar schreiben", cat: "Bearbeiten" },
  { cmd: "/tags", desc: "Tags anzeigen", cat: "Bearbeiten" },
  { cmd: "/trash", desc: "Papierkorb", cat: "Bearbeiten" },
];

export default function HelpPage() {
  const [openSection, setOpenSection] = useState<string | null>("upload");

  return (
    <AppShell>
      <div className="max-w-5xl mx-auto space-y-8">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Hilfe & Dokumentation</h1>
            <p className="text-sm text-muted-foreground mt-1">Alles was du über Kabineo wissen musst</p>
          </div>
          <Link href="/api-docs">
            <Button variant="outline">
              <BookOpen className="mr-2 h-4 w-4" />
              API-Dokumentation
            </Button>
          </Link>
        </div>

        {/* Hero quickstart */}
        <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-sky-600 via-blue-600 to-indigo-700 text-white shadow-xl">
          <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNjAiIGhlaWdodD0iNjAiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+PGRlZnM+PHBhdHRlcm4gaWQ9ImdyaWQiIHdpZHRoPSI2MCIgaGVpZ2h0PSI2MCIgcGF0dGVyblVuaXRzPSJ1c2VyU3BhY2VPblVzZSI+PHBhdGggZD0iTSA2MCAwIEwgMCAwIDAgNjAiIGZpbGw9Im5vbmUiIHN0cm9rZT0icmdiYSgyNTUsMjU1LDI1NSwwLjA1KSIgc3Ryb2tlLXdpZHRoPSIxIi8+PC9wYXR0ZXJuPjwvZGVmcz48cmVjdCBmaWxsPSJ1cmwoI2dyaWQpIiB3aWR0aD0iMTAwJSIgaGVpZ2h0PSIxMDAlIi8+PC9zdmc+')] opacity-50" />
          <div className="relative p-8">
            <div className="flex items-center gap-2 mb-4">
              <Zap className="h-5 w-5" />
              <h2 className="text-lg font-bold">Schnellstart in 5 Schritten</h2>
            </div>
            <div className="grid sm:grid-cols-5 gap-4">
              {[
                { icon: Upload, step: "1", text: "Hochladen", sub: "Drag & Drop, Telegram oder E-Mail" },
                { icon: Eye, step: "2", text: "Verarbeiten", sub: "OCR, Scan, Datum, Klassifizierung" },
                { icon: FolderOpen, step: "3", text: "Organisieren", sub: "Ordner, Tags, Typen" },
                { icon: Search, step: "4", text: "Finden", sub: "Volltextsuche inkl. OCR" },
                { icon: Share2, step: "5", text: "Teilen", sub: "Share-Links, Kommentare" },
              ].map((s) => (
                <div key={s.step} className="text-center">
                  <div className="mx-auto w-12 h-12 rounded-2xl bg-white/15 flex items-center justify-center mb-2">
                    <s.icon className="h-6 w-6" />
                  </div>
                  <p className="font-bold text-sm">{s.text}</p>
                  <p className="text-[11px] text-sky-200 mt-0.5">{s.sub}</p>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Feature sections — accordion style */}
        <div className="space-y-6">
          {categories.map((cat) => (
            <div key={cat.label}>
              <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-3 px-1">{cat.label}</h3>
              <div className="space-y-2">
                {cat.sections.map((section) => {
                  const Icon = section.icon;
                  const isOpen = openSection === section.id;
                  return (
                    <Card key={section.id} className="border-0 shadow-sm bg-white dark:bg-card overflow-hidden">
                      <button
                        onClick={() => setOpenSection(isOpen ? null : section.id)}
                        className="w-full flex items-center gap-3 p-4 text-left hover:bg-muted/30 transition-colors cursor-pointer"
                      >
                        <div className={`rounded-xl p-2.5 ${section.bg}`}>
                          <Icon className={`h-5 w-5 ${section.color}`} />
                        </div>
                        <span className="flex-1 font-semibold text-sm">{section.title}</span>
                        <span className="text-[11px] text-muted-foreground mr-2">{section.items.length} Themen</span>
                        {isOpen ? <ChevronDown className="h-4 w-4 text-muted-foreground" /> : <ChevronRight className="h-4 w-4 text-muted-foreground" />}
                      </button>
                      {isOpen && (
                        <CardContent className="pt-0 pb-4 px-4">
                          <div className="border-t border-border/50 pt-4 space-y-4 ml-[52px]">
                            {section.items.map((item) => (
                              <div key={item.title}>
                                <h4 className="text-sm font-semibold text-foreground">{item.title}</h4>
                                <p className="text-sm text-muted-foreground mt-0.5 leading-relaxed">{item.description}</p>
                              </div>
                            ))}
                          </div>
                        </CardContent>
                      )}
                    </Card>
                  );
                })}
              </div>
            </div>
          ))}
        </div>

        {/* Telegram commands */}
        <Card className="border-0 shadow-md bg-white dark:bg-card overflow-hidden">
          <div className="p-5 border-b border-border/50 flex items-center gap-3">
            <div className="rounded-xl p-2.5 bg-blue-50 dark:bg-blue-900/20">
              <Bot className="h-5 w-5 text-blue-500" />
            </div>
            <div>
              <h3 className="font-bold text-sm">Telegram-Befehle</h3>
              <p className="text-[11px] text-muted-foreground">Alle verfügbaren Bot-Commands</p>
            </div>
          </div>
          <CardContent className="p-0">
            <div className="divide-y divide-border/50">
              {telegramCommands.map((c) => (
                <div key={c.cmd} className="flex items-center gap-4 px-5 py-2.5 hover:bg-muted/30 transition-colors">
                  <code className="text-xs font-mono bg-slate-100 dark:bg-muted px-2.5 py-1 rounded-md min-w-[150px] text-sky-700 dark:text-sky-400">{c.cmd}</code>
                  <span className="text-sm text-muted-foreground flex-1">{c.desc}</span>
                  <span className="text-[10px] font-medium text-muted-foreground/60 bg-muted px-2 py-0.5 rounded-full">{c.cat}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Keyboard shortcuts */}
        <Card className="border-0 shadow-sm bg-white dark:bg-card">
          <div className="p-5">
            <h3 className="font-bold text-sm mb-4">Tastenkombinationen & Gesten</h3>
            <div className="grid sm:grid-cols-2 gap-3">
              {[
                ["Bild vergrößern", "Klick auf Vorschau"],
                ["Lightbox schließen", "Esc oder Klick auf Hintergrund"],
                ["Titel bearbeiten", "Klick auf Dokumenttitel"],
                ["Dokument verschieben", "Drag & Drop auf Ordner"],
                ["Seite wechseln", "Pfeil-Buttons in Lightbox"],
                ["Tag schnell erstellen", "Neuer Tag → Name → Enter"],
                ["Suche öffnen", "⌘K / Ctrl+K"],
                ["Shortcuts anzeigen", "?"],
              ].map(([action, shortcut]) => (
                <div key={action} className="flex items-center justify-between p-2.5 rounded-lg bg-slate-50 dark:bg-muted/30">
                  <span className="text-sm">{action}</span>
                  <kbd className="text-[11px] font-mono bg-white dark:bg-card px-2.5 py-1 rounded-md border border-border/50 shadow-sm">{shortcut}</kbd>
                </div>
              ))}
            </div>
          </div>
        </Card>

        {/* Processing pipeline */}
        <Card className="border-0 shadow-sm bg-white dark:bg-card">
          <div className="p-5">
            <h3 className="font-bold text-sm mb-4">Verarbeitungs-Pipeline</h3>
            <p className="text-sm text-muted-foreground mb-4">Jedes hochgeladene Dokument durchläuft automatisch diese Schritte:</p>
            <div className="flex flex-wrap items-center gap-2">
              {[
                { icon: Eye, label: "Scan", color: "bg-cyan-50 text-cyan-600 dark:bg-cyan-900/20" },
                { icon: FileText, label: "OCR", color: "bg-sky-50 text-sky-600 dark:bg-sky-900/20" },
                { icon: Calendar, label: "Datum", color: "bg-teal-50 text-teal-600 dark:bg-teal-900/20" },
                { icon: QrCode, label: "Barcode", color: "bg-slate-100 text-slate-600 dark:bg-slate-800/30" },
                { icon: Wand2, label: "Regeln", color: "bg-purple-50 text-purple-600 dark:bg-purple-900/20" },
                { icon: Layers, label: "Thumbnail", color: "bg-orange-50 text-orange-600 dark:bg-orange-900/20" },
                { icon: Webhook, label: "Webhook", color: "bg-indigo-50 text-indigo-600 dark:bg-indigo-900/20" },
              ].map((step, i) => (
                <div key={step.label} className="flex items-center gap-2">
                  <div className={`flex items-center gap-2 rounded-xl px-3 py-2 ${step.color}`}>
                    <step.icon className="h-4 w-4" />
                    <span className="text-xs font-semibold">{step.label}</span>
                  </div>
                  {i < 6 && <ArrowRight className="h-3.5 w-3.5 text-muted-foreground/40" />}
                </div>
              ))}
            </div>
          </div>
        </Card>
      </div>
    </AppShell>
  );
}
