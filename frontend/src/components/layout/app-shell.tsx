"use client";

import { useAuth } from "@/hooks/use-auth";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { Sidebar } from "./sidebar";
import { Header } from "./header";
import { FileText } from "lucide-react";
import { KeyboardShortcutsDialog, useKeyboardShortcuts } from "./keyboard-shortcuts";

export function AppShell({ children }: { children: React.ReactNode }) {
  const { user, isLoading } = useAuth();
  const router = useRouter();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const { showHelp, setShowHelp } = useKeyboardShortcuts();

  useEffect(() => {
    if (!isLoading && !user) {
      router.push("/login");
    }
    if (!isLoading && user?.must_change_password) {
      router.push("/change-password");
    }
  }, [user, isLoading, router]);

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

  if (!user) return null;

  return (
    <div className="flex h-screen bg-[#f0f4f8] dark:bg-background">
      <Sidebar mobileOpen={mobileMenuOpen} onMobileClose={() => setMobileMenuOpen(false)} />
      <div className="flex flex-1 flex-col overflow-hidden">
        <Header user={user} onMenuToggle={() => setMobileMenuOpen((v) => !v)} onShowShortcuts={() => setShowHelp(true)} />
        <main className="flex-1 overflow-auto">
          <div className="mx-auto max-w-7xl p-6 lg:p-8">
            {children}
          </div>
        </main>
      </div>
      <KeyboardShortcutsDialog open={showHelp} onOpenChange={setShowHelp} />
    </div>
  );
}
