"use client";

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Users, Globe, UserPlus, Trash2, Shield } from "lucide-react";
import { toast } from "sonner";

interface ShareEntry {
  id: string;
  document_id: string;
  shared_with_id: string | null;
  shared_with_username: string | null;
  permission: string;
  shared_by: string;
  created_at: string;
}

interface UserOption {
  id: string;
  username: string;
  email: string;
  full_name: string | null;
}

export function DocumentShareCard({ docId }: { docId: string }) {
  const queryClient = useQueryClient();
  const [showAdd, setShowAdd] = useState(false);
  const [selectedUserId, setSelectedUserId] = useState<string>("__all__");
  const [permission, setPermission] = useState("read");

  const { data: shares } = useQuery<ShareEntry[]>({
    queryKey: ["documents", docId, "shares-users"],
    queryFn: () => api(`/api/documents/${docId}/shares/users`),
  });

  const { data: users } = useQuery<UserOption[]>({
    queryKey: ["all-users"],
    queryFn: async () => {
      try { return await api<UserOption[]>("/api/admin/users"); }
      catch { return []; }
    },
    enabled: showAdd,
  });

  const addShare = useMutation({
    mutationFn: (data: { user_id: string | null; permission: string }) =>
      api(`/api/documents/${docId}/shares/users`, { method: "POST", body: data }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["documents", docId, "shares-users"] });
      setShowAdd(false);
      toast.success("Freigabe erteilt");
    },
    onError: () => toast.error("Freigabe fehlgeschlagen"),
  });

  const removeShare = useMutation({
    mutationFn: (shareId: string) =>
      api(`/api/documents/${docId}/shares/users/${shareId}`, { method: "DELETE" }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["documents", docId, "shares-users"] });
      toast.success("Freigabe entfernt");
    },
  });

  const handleAdd = () => {
    addShare.mutate({
      user_id: selectedUserId === "__all__" ? null : selectedUserId,
      permission,
    });
  };

  return (
    <Card className="border-0 shadow-md bg-white dark:bg-card">
      <CardHeader className="pb-3 flex flex-row items-center justify-between">
        <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
          <Users className="h-4 w-4" />
          Freigaben
          {shares && shares.length > 0 && (
            <Badge variant="secondary" className="ml-1 text-[10px]">{shares.length}</Badge>
          )}
        </CardTitle>
        <Button
          variant="ghost"
          size="sm"
          className="h-7 text-xs text-muted-foreground"
          onClick={() => setShowAdd(!showAdd)}
        >
          <UserPlus className="h-3 w-3 mr-1" />
          {showAdd ? "Abbrechen" : "Freigeben"}
        </Button>
      </CardHeader>
      <CardContent className="space-y-3">
        {/* Add share form */}
        {showAdd && (
          <div className="space-y-2 p-3 rounded-lg bg-sky-50 dark:bg-sky-900/10 border border-sky-200 dark:border-sky-800">
            <div className="space-y-1.5">
              <label className="text-xs text-muted-foreground">Freigeben für</label>
              <select
                value={selectedUserId}
                onChange={(e) => setSelectedUserId(e.target.value)}
                className="w-full h-9 rounded-lg border border-border bg-background px-2 text-sm"
              >
                <option value="__all__">Alle Benutzer</option>
                {users?.map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.full_name || u.username} ({u.email})
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-1.5">
              <label className="text-xs text-muted-foreground">Berechtigung</label>
              <select
                value={permission}
                onChange={(e) => setPermission(e.target.value)}
                className="w-full h-9 rounded-lg border border-border bg-background px-2 text-sm"
              >
                <option value="read">Lesen</option>
                <option value="write">Lesen & Bearbeiten</option>
              </select>
            </div>
            <Button size="sm" onClick={handleAdd} disabled={addShare.isPending} className="bg-sky-600 hover:bg-sky-700">
              {addShare.isPending ? "..." : "Freigeben"}
            </Button>
          </div>
        )}

        {/* Share list */}
        {shares && shares.length > 0 ? (
          <div className="space-y-2">
            {shares.map((s) => (
              <div key={s.id} className="flex items-center gap-2 p-2 rounded-lg hover:bg-muted/50 transition-colors">
                <div className={`flex h-7 w-7 items-center justify-center rounded-lg text-xs ${
                  s.shared_with_id ? "bg-sky-100 dark:bg-sky-900/20 text-sky-700" : "bg-amber-100 dark:bg-amber-900/20 text-amber-700"
                }`}>
                  {s.shared_with_id ? (
                    <Shield className="h-3.5 w-3.5" />
                  ) : (
                    <Globe className="h-3.5 w-3.5" />
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-medium truncate">{s.shared_with_username}</p>
                  <p className="text-[10px] text-muted-foreground">
                    {s.permission === "write" ? "Lesen & Bearbeiten" : "Nur Lesen"}
                  </p>
                </div>
                <button
                  onClick={() => removeShare.mutate(s.id)}
                  className="p-1 rounded hover:bg-destructive/10 transition-colors cursor-pointer"
                >
                  <Trash2 className="h-3 w-3 text-destructive" />
                </button>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-xs text-muted-foreground">Nicht freigegeben. Klicke &quot;Freigeben&quot; um das Dokument mit anderen zu teilen.</p>
        )}
      </CardContent>
    </Card>
  );
}
