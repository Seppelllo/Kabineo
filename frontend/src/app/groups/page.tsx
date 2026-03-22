"use client";

import { useState } from "react";
import { AppShell } from "@/components/layout/app-shell";
import { useAuth } from "@/hooks/use-auth";
import {
  useGroups, useMyGroups, useCreateGroup, useUpdateGroup, useDeleteGroup,
  useGroupMembers, useAddGroupMember, useRemoveGroupMember,
  useJoinRequests, useRequestJoin, useApproveRequest, useDenyRequest,
  type Group,
} from "@/hooks/use-groups";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogClose,
} from "@/components/ui/dialog";
import {
  Users, Plus, Trash2, UserPlus, LogIn, Check, X, Edit2, Loader2, Crown, UserMinus, AlertTriangle, Search,
} from "lucide-react";
import { toast } from "sonner";
import { api } from "@/lib/api";

export default function GroupsPage() {
  const { user } = useAuth();
  const isAdmin = user?.role === "admin" || user?.role === "UserRole.admin";
  const { data: allGroups, isLoading } = useGroups();
  const { data: myGroups } = useMyGroups();

  const createGroup = useCreateGroup();
  const updateGroup = useUpdateGroup();
  const deleteGroup = useDeleteGroup();
  const addMember = useAddGroupMember();
  const removeMember = useRemoveGroupMember();
  const requestJoin = useRequestJoin();
  const approveReq = useApproveRequest();
  const denyReq = useDenyRequest();

  // Dialogs
  const [createOpen, setCreateOpen] = useState(false);
  const [editGroup, setEditGroup] = useState<Group | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Group | null>(null);
  const [selectedGroup, setSelectedGroup] = useState<string | null>(null);
  const [addMemberOpen, setAddMemberOpen] = useState(false);
  const [joinOpen, setJoinOpen] = useState<string | null>(null);

  // Form state
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [joinMessage, setJoinMessage] = useState("");

  // Users list for add member
  const [availableUsers, setAvailableUsers] = useState<Array<{ id: string; username: string; email: string; full_name?: string }>>([]);
  const [selectedUserIds, setSelectedUserIds] = useState<Set<string>>(new Set());
  const [userSearch, setUserSearch] = useState("");
  const [addingMembers, setAddingMembers] = useState(false);

  const { data: members } = useGroupMembers(selectedGroup);
  const { data: requests } = useJoinRequests(isAdmin ? selectedGroup : null);

  const myGroupIds = new Set(myGroups?.map((g) => g.id) || []);

  const handleCreate = async () => {
    if (!name.trim()) return;
    try {
      await createGroup.mutateAsync({ name: name.trim(), description: description.trim() || undefined });
      toast.success("Gruppe erstellt");
      setName(""); setDescription(""); setCreateOpen(false);
    } catch { toast.error("Gruppe konnte nicht erstellt werden"); }
  };

  const handleUpdate = async () => {
    if (!editGroup || !name.trim()) return;
    try {
      await updateGroup.mutateAsync({ id: editGroup.id, data: { name: name.trim(), description: description.trim() || undefined } });
      toast.success("Gruppe aktualisiert");
      setEditGroup(null); setName(""); setDescription("");
    } catch { toast.error("Aktualisierung fehlgeschlagen"); }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    try {
      await deleteGroup.mutateAsync(deleteTarget.id);
      toast.success("Gruppe geloescht");
      setDeleteTarget(null);
      if (selectedGroup === deleteTarget.id) setSelectedGroup(null);
    } catch { toast.error("Loeschen fehlgeschlagen"); }
  };

  const handleAddMembers = async () => {
    if (!selectedGroup || selectedUserIds.size === 0) return;
    setAddingMembers(true);
    let added = 0;
    for (const userId of selectedUserIds) {
      try {
        await addMember.mutateAsync({ groupId: selectedGroup, userId });
        added++;
      } catch {}
    }
    setAddingMembers(false);
    toast.success(`${added} Mitglied(er) hinzugefügt`);
    setSelectedUserIds(new Set());
    setUserSearch("");
    setAddMemberOpen(false);
  };

  const toggleUser = (userId: string) => {
    setSelectedUserIds((prev) => {
      const next = new Set(prev);
      if (next.has(userId)) next.delete(userId);
      else next.add(userId);
      return next;
    });
  };

  const handleRemoveMember = async (userId: string) => {
    if (!selectedGroup) return;
    try {
      await removeMember.mutateAsync({ groupId: selectedGroup, userId });
      toast.success("Mitglied entfernt");
    } catch { toast.error("Entfernen fehlgeschlagen"); }
  };

  const handleRequestJoin = async () => {
    if (!joinOpen) return;
    try {
      await requestJoin.mutateAsync({ groupId: joinOpen, message: joinMessage.trim() || undefined });
      toast.success("Beitrittsanfrage gesendet");
      setJoinOpen(null); setJoinMessage("");
    } catch (e: any) { toast.error(e?.message || "Anfrage fehlgeschlagen"); }
  };

  const openAddMember = async () => {
    try {
      const users = await api<Array<{ id: string; username: string; email: string; full_name?: string }>>("/api/admin/users");
      setAvailableUsers(users);
    } catch { setAvailableUsers([]); }
    setSelectedUserIds(new Set());
    setUserSearch("");
    setAddMemberOpen(true);
  };

  const selectedGroupData = allGroups?.find((g) => g.id === selectedGroup);

  return (
    <AppShell>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Gruppen</h1>
            <p className="text-sm text-muted-foreground mt-1">
              {allGroups?.length ?? 0} Gruppe(n)
            </p>
          </div>
          {isAdmin && (
            <Button onClick={() => { setName(""); setDescription(""); setCreateOpen(true); }} className="bg-sky-600 hover:bg-sky-700">
              <Plus className="mr-2 h-4 w-4" /> Neue Gruppe
            </Button>
          )}
        </div>

        <div className="grid gap-6 lg:grid-cols-[1fr_1fr]">
          {/* Groups list */}
          <div className="space-y-3">
            <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              {isAdmin ? "Alle Gruppen" : "Verfuegbare Gruppen"}
            </p>
            {isLoading ? (
              <div className="flex justify-center py-8"><Loader2 className="h-6 w-6 animate-spin text-sky-500" /></div>
            ) : allGroups?.length === 0 ? (
              <Card><CardContent className="py-8 text-center text-sm text-muted-foreground">Keine Gruppen vorhanden</CardContent></Card>
            ) : (
              allGroups?.map((group) => (
                <Card
                  key={group.id}
                  className={`cursor-pointer transition-all hover:shadow-md ${selectedGroup === group.id ? "ring-2 ring-sky-500" : ""}`}
                  onClick={() => setSelectedGroup(group.id)}
                >
                  <CardContent className="flex items-center justify-between py-4">
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-sky-100 dark:bg-sky-900/30 shrink-0">
                        <Users className="h-5 w-5 text-sky-600 dark:text-sky-400" />
                      </div>
                      <div className="min-w-0">
                        <p className="font-semibold text-sm truncate">{group.name}</p>
                        {group.description && (
                          <p className="text-xs text-muted-foreground truncate">{group.description}</p>
                        )}
                        <p className="text-xs text-muted-foreground">{group.member_count} Mitglied(er)</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
                      {myGroupIds.has(group.id) && (
                        <span className="text-[10px] bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400 px-2 py-0.5 rounded-full font-medium">
                          Mitglied
                        </span>
                      )}
                      {!myGroupIds.has(group.id) && !isAdmin && (
                        <Button
                          size="sm" variant="outline"
                          onClick={(e) => { e.stopPropagation(); setJoinOpen(group.id); }}
                        >
                          <LogIn className="mr-1 h-3.5 w-3.5" /> Beitrittsanfrage
                        </Button>
                      )}
                      {isAdmin && (
                        <>
                          <Button size="icon" variant="ghost" className="h-8 w-8" onClick={(e) => {
                            e.stopPropagation(); setName(group.name); setDescription(group.description || ""); setEditGroup(group);
                          }}>
                            <Edit2 className="h-3.5 w-3.5" />
                          </Button>
                          <Button size="icon" variant="ghost" className="h-8 w-8 text-destructive" onClick={(e) => { e.stopPropagation(); setDeleteTarget(group); }}>
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </>
                      )}
                    </div>
                  </CardContent>
                </Card>
              ))
            )}
          </div>

          {/* Members panel */}
          <div className="space-y-3">
            {selectedGroup && selectedGroupData ? (
              <>
                <div className="flex items-center justify-between">
                  <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    Mitglieder von &quot;{selectedGroupData.name}&quot;
                  </p>
                  {isAdmin && (
                    <Button size="sm" variant="outline" onClick={openAddMember}>
                      <UserPlus className="mr-1 h-3.5 w-3.5" /> Hinzufuegen
                    </Button>
                  )}
                </div>

                {members?.length === 0 ? (
                  <Card><CardContent className="py-6 text-center text-sm text-muted-foreground">Keine Mitglieder</CardContent></Card>
                ) : (
                  members?.map((m) => (
                    <Card key={m.id}>
                      <CardContent className="flex items-center justify-between py-3">
                        <div className="flex items-center gap-3">
                          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-slate-100 dark:bg-slate-800 text-xs font-bold">
                            {m.username[0].toUpperCase()}
                          </div>
                          <div>
                            <p className="text-sm font-medium">{m.full_name || m.username}</p>
                            <p className="text-xs text-muted-foreground">{m.email}</p>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          {m.role === "admin" && <Crown className="h-3.5 w-3.5 text-amber-500" />}
                          <span className="text-xs text-muted-foreground capitalize">{m.role}</span>
                          {isAdmin && (
                            <Button size="icon" variant="ghost" className="h-7 w-7 text-destructive"
                              onClick={() => handleRemoveMember(m.user_id)}
                            >
                              <UserMinus className="h-3.5 w-3.5" />
                            </Button>
                          )}
                        </div>
                      </CardContent>
                    </Card>
                  ))
                )}

                {/* Join requests (admin only) */}
                {isAdmin && requests && requests.length > 0 && (
                  <div className="space-y-3 mt-6">
                    <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                      Beitrittsanfragen ({requests.length})
                    </p>
                    {requests.map((r) => (
                      <Card key={r.id}>
                        <CardContent className="flex items-center justify-between py-3">
                          <div>
                            <p className="text-sm font-medium">{r.username}</p>
                            {r.message && <p className="text-xs text-muted-foreground">&quot;{r.message}&quot;</p>}
                            <p className="text-[11px] text-muted-foreground">
                              {new Date(r.created_at).toLocaleString("de-DE")}
                            </p>
                          </div>
                          <div className="flex gap-1">
                            <Button size="sm" variant="outline" className="text-green-600 border-green-200 hover:bg-green-50 dark:hover:bg-green-900/20"
                              onClick={() => approveReq.mutate({ groupId: r.group_id, requestId: r.id })}
                            >
                              <Check className="mr-1 h-3.5 w-3.5" /> Genehmigen
                            </Button>
                            <Button size="sm" variant="outline" className="text-destructive"
                              onClick={() => denyReq.mutate({ groupId: r.group_id, requestId: r.id })}
                            >
                              <X className="mr-1 h-3.5 w-3.5" /> Ablehnen
                            </Button>
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                )}
              </>
            ) : (
              <Card>
                <CardContent className="py-12 text-center">
                  <Users className="h-10 w-10 text-muted-foreground/30 mx-auto mb-3" />
                  <p className="text-sm text-muted-foreground">Waehle eine Gruppe aus, um die Mitglieder zu sehen</p>
                </CardContent>
              </Card>
            )}
          </div>
        </div>
      </div>

      {/* Create Group Dialog */}
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Neue Gruppe</DialogTitle></DialogHeader>
          <div className="space-y-3 py-2">
            <Input placeholder="Gruppenname" value={name} onChange={(e) => setName(e.target.value)} autoFocus />
            <Input placeholder="Beschreibung (optional)" value={description} onChange={(e) => setDescription(e.target.value)} />
          </div>
          <DialogFooter>
            <DialogClose className="inline-flex items-center justify-center rounded-lg border border-border bg-background px-4 h-9 text-sm font-medium hover:bg-muted transition-colors cursor-pointer">
              Abbrechen
            </DialogClose>
            <Button onClick={handleCreate} disabled={!name.trim() || createGroup.isPending} className="bg-sky-600 hover:bg-sky-700">
              {createGroup.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Erstellen
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Group Dialog */}
      <Dialog open={!!editGroup} onOpenChange={(o) => !o && setEditGroup(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Gruppe bearbeiten</DialogTitle></DialogHeader>
          <div className="space-y-3 py-2">
            <Input placeholder="Gruppenname" value={name} onChange={(e) => setName(e.target.value)} autoFocus />
            <Input placeholder="Beschreibung" value={description} onChange={(e) => setDescription(e.target.value)} />
          </div>
          <DialogFooter>
            <DialogClose className="inline-flex items-center justify-center rounded-lg border border-border bg-background px-4 h-9 text-sm font-medium hover:bg-muted transition-colors cursor-pointer">
              Abbrechen
            </DialogClose>
            <Button onClick={handleUpdate} disabled={!name.trim() || updateGroup.isPending} className="bg-sky-600 hover:bg-sky-700">
              {updateGroup.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Speichern
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Group Dialog */}
      <Dialog open={!!deleteTarget} onOpenChange={(o) => !o && setDeleteTarget(null)}>
        <DialogContent>
          <DialogHeader>
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-destructive/10 mb-2">
              <AlertTriangle className="h-6 w-6 text-destructive" />
            </div>
            <DialogTitle className="text-center">Gruppe loeschen?</DialogTitle>
            <p className="text-sm text-muted-foreground text-center">
              &quot;{deleteTarget?.name}&quot; und alle Mitgliedschaften werden geloescht.
            </p>
          </DialogHeader>
          <DialogFooter>
            <DialogClose className="inline-flex items-center justify-center rounded-lg border border-border bg-background px-4 h-9 text-sm font-medium hover:bg-muted transition-colors cursor-pointer">
              Abbrechen
            </DialogClose>
            <Button variant="destructive" onClick={handleDelete}>Loeschen</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Add Member Dialog */}
      <Dialog open={addMemberOpen} onOpenChange={setAddMemberOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Mitglieder hinzufügen</DialogTitle>
            <p className="text-sm text-muted-foreground mt-1">
              Wähle die Benutzer aus, die der Gruppe beitreten sollen
            </p>
          </DialogHeader>

          {/* Search */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              value={userSearch}
              onChange={(e) => setUserSearch(e.target.value)}
              placeholder="Benutzer suchen..."
              className="pl-10 h-10"
              autoFocus
            />
          </div>

          {/* Selected count */}
          {selectedUserIds.size > 0 && (
            <div className="flex items-center justify-between px-1">
              <span className="text-xs font-medium text-sky-600">{selectedUserIds.size} ausgewählt</span>
              <button onClick={() => setSelectedUserIds(new Set())} className="text-xs text-muted-foreground hover:text-foreground cursor-pointer">
                Auswahl aufheben
              </button>
            </div>
          )}

          {/* User list */}
          <div className="max-h-72 overflow-auto -mx-1 space-y-0.5">
            {availableUsers
              .filter((u) => !members?.some((m) => m.user_id === u.id))
              .filter((u) => {
                if (!userSearch) return true;
                const q = userSearch.toLowerCase();
                return u.username.toLowerCase().includes(q) ||
                       u.email.toLowerCase().includes(q) ||
                       (u.full_name?.toLowerCase().includes(q) ?? false);
              })
              .map((u) => {
                const isSelected = selectedUserIds.has(u.id);
                return (
                  <button
                    key={u.id}
                    onClick={() => toggleUser(u.id)}
                    className={`flex items-center gap-3 w-full rounded-lg px-3 py-2.5 text-left transition-colors cursor-pointer ${
                      isSelected
                        ? "bg-sky-50 dark:bg-sky-900/20 ring-1 ring-sky-200 dark:ring-sky-800"
                        : "hover:bg-muted/50"
                    }`}
                  >
                    <div className={`flex h-8 w-8 items-center justify-center rounded-lg text-xs font-bold shrink-0 ${
                      isSelected
                        ? "bg-sky-600 text-white"
                        : "bg-slate-100 dark:bg-slate-800 text-muted-foreground"
                    }`}>
                      {isSelected ? <Check className="h-4 w-4" /> : (u.full_name || u.username)[0].toUpperCase()}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{u.full_name || u.username}</p>
                      <p className="text-xs text-muted-foreground truncate">@{u.username} · {u.email}</p>
                    </div>
                    {isSelected && (
                      <div className="h-5 w-5 rounded-full bg-sky-600 flex items-center justify-center shrink-0">
                        <Check className="h-3 w-3 text-white" />
                      </div>
                    )}
                  </button>
                );
              })}
            {availableUsers.filter((u) => !members?.some((m) => m.user_id === u.id)).length === 0 && (
              <p className="text-sm text-muted-foreground text-center py-6">Keine weiteren Benutzer verfügbar</p>
            )}
          </div>

          <DialogFooter>
            <DialogClose className="inline-flex items-center justify-center rounded-lg border border-border bg-background px-4 h-9 text-sm font-medium hover:bg-muted transition-colors cursor-pointer">
              Abbrechen
            </DialogClose>
            <Button
              onClick={handleAddMembers}
              disabled={selectedUserIds.size === 0 || addingMembers}
              className="bg-sky-600 hover:bg-sky-700"
            >
              {addingMembers ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <UserPlus className="mr-2 h-4 w-4" />
              )}
              {selectedUserIds.size > 0 ? `${selectedUserIds.size} hinzufügen` : "Hinzufügen"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Join Request Dialog */}
      <Dialog open={!!joinOpen} onOpenChange={(o) => !o && setJoinOpen(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Beitrittsanfrage</DialogTitle></DialogHeader>
          <div className="py-2">
            <Input
              placeholder="Nachricht (optional)"
              value={joinMessage}
              onChange={(e) => setJoinMessage(e.target.value)}
            />
          </div>
          <DialogFooter>
            <DialogClose className="inline-flex items-center justify-center rounded-lg border border-border bg-background px-4 h-9 text-sm font-medium hover:bg-muted transition-colors cursor-pointer">
              Abbrechen
            </DialogClose>
            <Button onClick={handleRequestJoin} disabled={requestJoin.isPending} className="bg-sky-600 hover:bg-sky-700">
              {requestJoin.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Anfrage senden
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AppShell>
  );
}
