"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/hooks/use-auth";
import { api } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { FileText, Loader2, Lock } from "lucide-react";
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";

export default function ChangePasswordPage() {
  const { user, isLoading } = useAuth();
  const router = useRouter();
  const queryClient = useQueryClient();
  const [submitting, setSubmitting] = useState(false);

  if (isLoading) {
    return (
      <div className="flex h-screen items-center justify-center bg-[#f0f4f8] dark:bg-background">
        <div className="flex flex-col items-center gap-4">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-sky-600 shadow-lg shadow-sky-600/25">
            <FileText className="h-6 w-6 text-white" />
          </div>
          <div className="h-1.5 w-32 overflow-hidden rounded-full bg-sky-100">
            <div className="h-full w-1/2 animate-[shimmer_1.5s_ease-in-out_infinite] rounded-full bg-sky-500" />
          </div>
        </div>
      </div>
    );
  }

  if (!user) {
    router.push("/login");
    return null;
  }

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    const newPassword = form.get("new_password") as string;
    const confirmPassword = form.get("confirm_password") as string;

    if (newPassword !== confirmPassword) {
      toast.error("Passwörter stimmen nicht überein");
      return;
    }

    setSubmitting(true);
    try {
      await api("/api/auth/change-password", {
        method: "POST",
        body: {
          old_password: form.get("old_password") as string,
          new_password: newPassword,
        },
      });
      toast.success("Passwort erfolgreich geändert");
      // Refresh user data so must_change_password is updated
      queryClient.invalidateQueries({ queryKey: ["auth", "me"] });
      router.push("/dashboard");
    } catch {
      toast.error("Passwort konnte nicht geändert werden. Ist das alte Passwort korrekt?");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-[#f0f4f8] dark:bg-background p-6">
      <div className="w-full max-w-[420px]">
        <div className="flex flex-col items-center space-y-4 mb-8">
          <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-sky-500 to-blue-600 shadow-xl shadow-sky-500/30">
            <Lock className="h-8 w-8 text-white" />
          </div>
          <div className="text-center">
            <h1 className="text-2xl font-bold">Passwort ändern</h1>
            <p className="text-sm text-muted-foreground mt-1">
              {user.must_change_password
                ? "Du musst dein Passwort ändern, bevor du fortfahren kannst."
                : "Ändere dein Passwort"}
            </p>
          </div>
        </div>

        <Card className="border-0 shadow-xl shadow-sky-900/5 bg-white dark:bg-slate-900">
          <CardContent className="p-6">
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="old_password" className="text-xs font-medium text-muted-foreground">
                  Aktuelles Passwort
                </Label>
                <Input
                  id="old_password"
                  name="old_password"
                  type="password"
                  required
                  placeholder="Aktuelles Passwort"
                  className="h-12 rounded-xl bg-slate-50 dark:bg-slate-800 border-0 text-sm"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="new_password" className="text-xs font-medium text-muted-foreground">
                  Neues Passwort
                </Label>
                <Input
                  id="new_password"
                  name="new_password"
                  type="password"
                  required
                  minLength={8}
                  placeholder="Min. 8 Zeichen"
                  className="h-12 rounded-xl bg-slate-50 dark:bg-slate-800 border-0 text-sm"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="confirm_password" className="text-xs font-medium text-muted-foreground">
                  Neues Passwort bestätigen
                </Label>
                <Input
                  id="confirm_password"
                  name="confirm_password"
                  type="password"
                  required
                  minLength={8}
                  placeholder="Passwort wiederholen"
                  className="h-12 rounded-xl bg-slate-50 dark:bg-slate-800 border-0 text-sm"
                />
              </div>
              <Button
                type="submit"
                className="w-full h-12 rounded-xl bg-sky-600 hover:bg-sky-700 font-semibold text-sm shadow-lg shadow-sky-600/25 mt-2"
                disabled={submitting}
              >
                {submitting ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <Lock className="mr-2 h-4 w-4" />
                )}
                Passwort ändern
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
