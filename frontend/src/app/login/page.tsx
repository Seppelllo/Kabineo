"use client";

import { useState, useEffect } from "react";
import { useAuth } from "@/hooks/use-auth";
import { register } from "@/lib/auth";
import { api } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import {
  FileText, Loader2, Search, FolderOpen, Shield, Bot,
  Eye, Zap, Share2, Lock, ArrowRight, CheckCircle2,
} from "lucide-react";
import { toast } from "sonner";

const features = [
  { icon: Eye, title: "OCR & Scanner", desc: "Automatische Texterkennung und Perspektivkorrektur" },
  { icon: Search, title: "Volltextsuche", desc: "Durchsuche alle Dokumente inkl. OCR-Text" },
  { icon: FolderOpen, title: "Organisation", desc: "Ordner, Tags, Korrespondenten, Dokumenttypen" },
  { icon: Zap, title: "Auto-Klassifizierung", desc: "Regeln weisen Typ, Tags und Ordner automatisch zu" },
  { icon: Bot, title: "Telegram-Bot", desc: "Voll interaktiv — Upload, Suche, alles per Chat" },
  { icon: Share2, title: "Teilen & Zusammenarbeit", desc: "Share-Links, Kommentare, Berechtigungen" },
];

interface SsoConfig {
  sso_enabled: boolean;
  sso_provider_name: string;
  saml_enabled: boolean;
}

export default function LoginPage() {
  const { login } = useAuth();
  const [isLoading, setIsLoading] = useState(false);
  const [mode, setMode] = useState<"login" | "register">("login");
  const [registrationEnabled, setRegistrationEnabled] = useState(true);
  const [ssoConfig, setSsoConfig] = useState<SsoConfig | null>(null);

  useEffect(() => {
    api<{ registration_enabled: boolean }>("/api/auth/config")
      .then((data) => {
        setRegistrationEnabled(data.registration_enabled);
        if (!data.registration_enabled && mode === "register") {
          setMode("login");
        }
      })
      .catch(() => {});
    api<SsoConfig>("/api/auth/sso/config")
      .then((data) => setSsoConfig(data))
      .catch(() => {});
  }, []);

  const handleLogin = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setIsLoading(true);
    const form = new FormData(e.currentTarget);
    try {
      await login(form.get("email") as string, form.get("password") as string);
    } catch {
      toast.error("Ungültige Anmeldedaten");
    } finally {
      setIsLoading(false);
    }
  };

  const handleRegister = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setIsLoading(true);
    const form = new FormData(e.currentTarget);
    const pw = form.get("password") as string;
    const pw2 = form.get("password_confirm") as string;
    if (pw !== pw2) {
      toast.error("Passwörter stimmen nicht überein");
      setIsLoading(false);
      return;
    }
    try {
      await register(
        form.get("email") as string,
        form.get("username") as string,
        pw,
        (form.get("full_name") as string) || undefined,
      );
      toast.success("Account erstellt!");
      setMode("login");
    } catch {
      toast.error("Registrierung fehlgeschlagen");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen bg-slate-950">
      {/* Left side — branding */}
      <div className="hidden lg:flex lg:w-[55%] flex-col relative overflow-hidden">
        {/* Animated gradient background */}
        <div className="absolute inset-0 bg-gradient-to-br from-sky-600 via-blue-700 to-indigo-900" />
        <div className="absolute inset-0 opacity-30" style={{
          backgroundImage: `radial-gradient(circle at 25% 25%, rgba(56, 189, 248, 0.3) 0%, transparent 50%),
                           radial-gradient(circle at 75% 75%, rgba(99, 102, 241, 0.3) 0%, transparent 50%),
                           radial-gradient(circle at 50% 50%, rgba(14, 165, 233, 0.2) 0%, transparent 70%)`,
        }} />
        <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNjAiIGhlaWdodD0iNjAiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+PGRlZnM+PHBhdHRlcm4gaWQ9ImdyaWQiIHdpZHRoPSI2MCIgaGVpZ2h0PSI2MCIgcGF0dGVyblVuaXRzPSJ1c2VyU3BhY2VPblVzZSI+PHBhdGggZD0iTSA2MCAwIEwgMCAwIDAgNjAiIGZpbGw9Im5vbmUiIHN0cm9rZT0icmdiYSgyNTUsMjU1LDI1NSwwLjA0KSIgc3Ryb2tlLXdpZHRoPSIxIi8+PC9wYXR0ZXJuPjwvZGVmcz48cmVjdCBmaWxsPSJ1cmwoI2dyaWQpIiB3aWR0aD0iMTAwJSIgaGVpZ2h0PSIxMDAlIi8+PC9zdmc+')] opacity-80" />

        <div className="relative flex flex-col justify-between h-full p-12">
          {/* Logo */}
          <div className="flex items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-white/10 backdrop-blur-sm border border-white/10">
              <FileText className="h-6 w-6 text-white" />
            </div>
            <div>
              <span className="text-xl font-bold text-white tracking-tight">Kabineo</span>
              <p className="text-[11px] text-sky-200/60 -mt-0.5">Dein digitales Aktenkabinett</p>
            </div>
          </div>

          {/* Hero text */}
          <div className="space-y-6 max-w-lg">
            <h1 className="text-5xl font-bold text-white leading-[1.1] tracking-tight">
              Deine Dokumente.<br />
              <span className="bg-gradient-to-r from-sky-200 to-blue-200 bg-clip-text text-transparent">
                Intelligent verwaltet.
              </span>
            </h1>
            <p className="text-lg text-sky-100/70 leading-relaxed max-w-md">
              Self-Hosted Aktenkabinett mit OCR, automatischer Klassifizierung, Telegram-Bot und Volltextsuche.
            </p>

            {/* Feature grid */}
            <div className="grid grid-cols-2 gap-3 pt-2">
              {features.map((f) => (
                <div key={f.title} className="flex items-start gap-3 rounded-xl bg-white/5 backdrop-blur-sm border border-white/5 p-3">
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-white/10">
                    <f.icon className="h-4 w-4 text-sky-300" />
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-white">{f.title}</p>
                    <p className="text-[11px] text-sky-200/50 leading-snug mt-0.5">{f.desc}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Bottom stats */}
          <div className="flex items-center gap-8">
            <div className="flex items-center gap-2">
              <Shield className="h-4 w-4 text-sky-300/50" />
              <span className="text-xs text-sky-200/40">End-to-End verschlüsselt</span>
            </div>
            <div className="flex items-center gap-2">
              <Lock className="h-4 w-4 text-sky-300/50" />
              <span className="text-xs text-sky-200/40">Self-Hosted & Open Source</span>
            </div>
          </div>
        </div>
      </div>

      {/* Right side — form */}
      <div className="flex flex-1 items-center justify-center bg-[#f0f4f8] dark:bg-slate-950 p-6">
        <div className="w-full max-w-[420px]">
          {/* Mobile logo */}
          <div className="lg:hidden flex flex-col items-center space-y-4 mb-8">
            <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-sky-500 to-blue-600 shadow-xl shadow-sky-500/30">
              <FileText className="h-8 w-8 text-white" />
            </div>
            <div className="text-center">
              <h1 className="text-2xl font-bold">Kabineo</h1>
              <p className="text-sm text-muted-foreground">Dein digitales Aktenkabinett</p>
            </div>
          </div>

          {/* Mode toggle */}
          {registrationEnabled && (
            <div className="flex rounded-2xl bg-white dark:bg-slate-900 p-1.5 shadow-sm mb-6">
              <button
                onClick={() => setMode("login")}
                className={`flex-1 py-2.5 text-sm font-semibold rounded-xl transition-all cursor-pointer ${
                  mode === "login"
                    ? "bg-sky-600 text-white shadow-md shadow-sky-600/25"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                Anmelden
              </button>
              <button
                onClick={() => setMode("register")}
                className={`flex-1 py-2.5 text-sm font-semibold rounded-xl transition-all cursor-pointer ${
                  mode === "register"
                    ? "bg-sky-600 text-white shadow-md shadow-sky-600/25"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                Registrieren
              </button>
            </div>
          )}

          {/* Login form */}
          {mode === "login" && (
            <Card className="border-0 shadow-xl shadow-sky-900/5 bg-white dark:bg-slate-900">
              <CardContent className="p-6">
                <div className="mb-6">
                  <h2 className="text-xl font-bold">Willkommen zurück</h2>
                  <p className="text-sm text-muted-foreground mt-1">Melde dich an um fortzufahren</p>
                </div>
                {(ssoConfig?.sso_enabled || ssoConfig?.saml_enabled) && (
                  <div className="space-y-3 mb-5">
                    {ssoConfig.sso_enabled && (
                      <a
                        href={`${process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000"}/api/auth/sso/login`}
                        className="flex w-full h-12 items-center justify-center gap-2 rounded-xl border-2 border-sky-200 dark:border-sky-800 bg-sky-50 dark:bg-sky-950/50 text-sky-700 dark:text-sky-300 font-semibold text-sm hover:bg-sky-100 dark:hover:bg-sky-900/50 transition-colors"
                      >
                        <Shield className="h-4 w-4" />
                        Mit {ssoConfig.sso_provider_name} anmelden
                      </a>
                    )}
                    {ssoConfig.saml_enabled && (
                      <a
                        href={`${process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000"}/api/auth/sso/saml/login`}
                        className="flex w-full h-12 items-center justify-center gap-2 rounded-xl border-2 border-indigo-200 dark:border-indigo-800 bg-indigo-50 dark:bg-indigo-950/50 text-indigo-700 dark:text-indigo-300 font-semibold text-sm hover:bg-indigo-100 dark:hover:bg-indigo-900/50 transition-colors"
                      >
                        <Lock className="h-4 w-4" />
                        SAML Login
                      </a>
                    )}
                    <div className="relative">
                      <div className="absolute inset-0 flex items-center">
                        <div className="w-full border-t border-border" />
                      </div>
                      <div className="relative flex justify-center text-xs">
                        <span className="bg-white dark:bg-slate-900 px-3 text-muted-foreground">oder</span>
                      </div>
                    </div>
                  </div>
                )}
                <form onSubmit={handleLogin} className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="login-email" className="text-xs font-medium text-muted-foreground">E-Mail-Adresse</Label>
                    <Input
                      id="login-email"
                      name="email"
                      type="email"
                      required
                      placeholder="name@example.com"
                      className="h-12 rounded-xl bg-slate-50 dark:bg-slate-800 border-0 text-sm"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="login-password" className="text-xs font-medium text-muted-foreground">Passwort</Label>
                    <Input
                      id="login-password"
                      name="password"
                      type="password"
                      required
                      placeholder="••••••••"
                      className="h-12 rounded-xl bg-slate-50 dark:bg-slate-800 border-0 text-sm"
                    />
                  </div>
                  <Button
                    type="submit"
                    className="w-full h-12 rounded-xl bg-sky-600 hover:bg-sky-700 font-semibold text-sm shadow-lg shadow-sky-600/25 mt-2"
                    disabled={isLoading}
                  >
                    {isLoading ? (
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    ) : (
                      <ArrowRight className="mr-2 h-4 w-4" />
                    )}
                    Anmelden
                  </Button>
                </form>
                {registrationEnabled && (
                  <p className="text-center text-xs text-muted-foreground mt-6">
                    Noch kein Account?{" "}
                    <button onClick={() => setMode("register")} className="text-sky-600 font-semibold hover:underline cursor-pointer">
                      Jetzt registrieren
                    </button>
                  </p>
                )}
              </CardContent>
            </Card>
          )}

          {/* Register form */}
          {mode === "register" && registrationEnabled && (
            <Card className="border-0 shadow-xl shadow-sky-900/5 bg-white dark:bg-slate-900">
              <CardContent className="p-6">
                <div className="mb-6">
                  <h2 className="text-xl font-bold">Account erstellen</h2>
                  <p className="text-sm text-muted-foreground mt-1">Registriere dich kostenlos</p>
                </div>
                <form onSubmit={handleRegister} className="space-y-3">
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1.5">
                      <Label htmlFor="reg-name" className="text-xs font-medium text-muted-foreground">Name</Label>
                      <Input
                        id="reg-name"
                        name="full_name"
                        placeholder="Max Mustermann"
                        className="h-11 rounded-xl bg-slate-50 dark:bg-slate-800 border-0 text-sm"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor="reg-username" className="text-xs font-medium text-muted-foreground">Benutzername *</Label>
                      <Input
                        id="reg-username"
                        name="username"
                        required
                        placeholder="mmustermann"
                        className="h-11 rounded-xl bg-slate-50 dark:bg-slate-800 border-0 text-sm"
                      />
                    </div>
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="reg-email" className="text-xs font-medium text-muted-foreground">E-Mail-Adresse *</Label>
                    <Input
                      id="reg-email"
                      name="email"
                      type="email"
                      required
                      placeholder="name@example.com"
                      className="h-11 rounded-xl bg-slate-50 dark:bg-slate-800 border-0 text-sm"
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1.5">
                      <Label htmlFor="reg-password" className="text-xs font-medium text-muted-foreground">Passwort *</Label>
                      <Input
                        id="reg-password"
                        name="password"
                        type="password"
                        required
                        minLength={8}
                        placeholder="Min. 8 Zeichen"
                        className="h-11 rounded-xl bg-slate-50 dark:bg-slate-800 border-0 text-sm"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor="reg-password2" className="text-xs font-medium text-muted-foreground">Wiederholen *</Label>
                      <Input
                        id="reg-password2"
                        name="password_confirm"
                        type="password"
                        required
                        minLength={8}
                        placeholder="Passwort bestätigen"
                        className="h-11 rounded-xl bg-slate-50 dark:bg-slate-800 border-0 text-sm"
                      />
                    </div>
                  </div>
                  <div className="flex items-start gap-2 pt-1">
                    <CheckCircle2 className="h-4 w-4 text-emerald-500 mt-0.5 shrink-0" />
                    <p className="text-[11px] text-muted-foreground leading-snug">
                      Deine Daten werden ausschließlich auf diesem Server gespeichert. Kein Tracking, keine externen Dienste.
                    </p>
                  </div>
                  <Button
                    type="submit"
                    className="w-full h-12 rounded-xl bg-sky-600 hover:bg-sky-700 font-semibold text-sm shadow-lg shadow-sky-600/25 mt-1"
                    disabled={isLoading}
                  >
                    {isLoading ? (
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    ) : (
                      <ArrowRight className="mr-2 h-4 w-4" />
                    )}
                    Account erstellen
                  </Button>
                </form>
                <p className="text-center text-xs text-muted-foreground mt-5">
                  Bereits registriert?{" "}
                  <button onClick={() => setMode("login")} className="text-sky-600 font-semibold hover:underline cursor-pointer">
                    Anmelden
                  </button>
                </p>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
