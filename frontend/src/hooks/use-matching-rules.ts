"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";

export interface MatchingRule {
  id: string;
  name: string;
  order: number;
  match_type: string;
  pattern: string;
  case_sensitive: boolean;
  assign_correspondent_id: string | null;
  assign_document_type_id: string | null;
  assign_tag_ids: string[] | null;
  assign_folder_id: string | null;
  created_at: string;
}

export function useMatchingRules() {
  return useQuery<MatchingRule[]>({
    queryKey: ["matching-rules"],
    queryFn: () => api("/api/matching-rules"),
  });
}

export function useCreateMatchingRule() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: Omit<MatchingRule, "id" | "created_at">) =>
      api<MatchingRule>("/api/matching-rules", { method: "POST", body: data }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["matching-rules"] }),
  });
}

export function useUpdateMatchingRule() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<Omit<MatchingRule, "id" | "created_at">> }) =>
      api<MatchingRule>(`/api/matching-rules/${id}`, { method: "PUT", body: data }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["matching-rules"] }),
  });
}

export function useDeleteMatchingRule() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api(`/api/matching-rules/${id}`, { method: "DELETE" }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["matching-rules"] }),
  });
}
