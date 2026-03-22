"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";

export interface Group {
  id: string;
  name: string;
  description: string | null;
  member_count: number;
  created_at: string;
}

export interface GroupMember {
  id: string;
  user_id: string;
  username: string;
  full_name: string | null;
  email: string;
  role: string;
  joined_at: string;
}

export interface JoinRequest {
  id: string;
  group_id: string;
  group_name: string;
  user_id: string;
  username: string;
  status: string;
  message: string | null;
  created_at: string;
}

export function useGroups() {
  return useQuery<Group[]>({
    queryKey: ["groups"],
    queryFn: () => api("/api/groups"),
  });
}

export function useMyGroups() {
  return useQuery<Group[]>({
    queryKey: ["groups", "my"],
    queryFn: () => api("/api/groups/my"),
  });
}

export function useCreateGroup() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: { name: string; description?: string }) =>
      api<Group>("/api/groups", { method: "POST", body: data }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["groups"] }),
  });
}

export function useUpdateGroup() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: { name?: string; description?: string } }) =>
      api<Group>(`/api/groups/${id}`, { method: "PUT", body: data }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["groups"] }),
  });
}

export function useDeleteGroup() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api(`/api/groups/${id}`, { method: "DELETE" }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["groups"] }),
  });
}

export function useGroupMembers(groupId: string | null) {
  return useQuery<GroupMember[]>({
    queryKey: ["groups", groupId, "members"],
    queryFn: () => api(`/api/groups/${groupId}/members`),
    enabled: !!groupId,
  });
}

export function useAddGroupMember() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ groupId, userId, role }: { groupId: string; userId: string; role?: string }) =>
      api(`/api/groups/${groupId}/members`, { method: "POST", body: { user_id: userId, role: role || "member" } }),
    onSuccess: (_, { groupId }) => {
      qc.invalidateQueries({ queryKey: ["groups", groupId, "members"] });
      qc.invalidateQueries({ queryKey: ["groups"] });
    },
  });
}

export function useRemoveGroupMember() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ groupId, userId }: { groupId: string; userId: string }) =>
      api(`/api/groups/${groupId}/members/${userId}`, { method: "DELETE" }),
    onSuccess: (_, { groupId }) => {
      qc.invalidateQueries({ queryKey: ["groups", groupId, "members"] });
      qc.invalidateQueries({ queryKey: ["groups"] });
    },
  });
}

export function useJoinRequests(groupId: string | null) {
  return useQuery<JoinRequest[]>({
    queryKey: ["groups", groupId, "requests"],
    queryFn: () => api(`/api/groups/${groupId}/requests`),
    enabled: !!groupId,
  });
}

export function useRequestJoin() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ groupId, message }: { groupId: string; message?: string }) =>
      api(`/api/groups/${groupId}/join`, { method: "POST", body: { message } }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["groups"] }),
  });
}

export function useApproveRequest() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ groupId, requestId }: { groupId: string; requestId: string }) =>
      api(`/api/groups/${groupId}/requests/${requestId}/approve`, { method: "POST" }),
    onSuccess: (_, { groupId }) => {
      qc.invalidateQueries({ queryKey: ["groups", groupId, "requests"] });
      qc.invalidateQueries({ queryKey: ["groups", groupId, "members"] });
      qc.invalidateQueries({ queryKey: ["groups"] });
    },
  });
}

export function useDenyRequest() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ groupId, requestId }: { groupId: string; requestId: string }) =>
      api(`/api/groups/${groupId}/requests/${requestId}/deny`, { method: "POST" }),
    onSuccess: (_, { groupId }) => {
      qc.invalidateQueries({ queryKey: ["groups", groupId, "requests"] });
    },
  });
}
