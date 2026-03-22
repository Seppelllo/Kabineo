"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";

export interface Correspondent {
  id: string;
  name: string;
  match_pattern: string | null;
  created_at: string;
}

export function useCorrespondents() {
  return useQuery<Correspondent[]>({
    queryKey: ["correspondents"],
    queryFn: () => api("/api/correspondents"),
  });
}

export function useCreateCorrespondent() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: { name: string; match_pattern?: string }) =>
      api<Correspondent>("/api/correspondents", { method: "POST", body: data }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["correspondents"] }),
  });
}

export function useDeleteCorrespondent() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api(`/api/correspondents/${id}`, { method: "DELETE" }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["correspondents"] }),
  });
}
