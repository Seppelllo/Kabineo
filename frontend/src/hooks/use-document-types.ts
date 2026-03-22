"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";

export interface DocumentType {
  id: string;
  name: string;
  match_pattern: string | null;
  created_at: string;
}

export function useDocumentTypes() {
  return useQuery<DocumentType[]>({
    queryKey: ["document-types"],
    queryFn: () => api("/api/document-types"),
  });
}

export function useCreateDocumentType() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: { name: string; match_pattern?: string }) =>
      api<DocumentType>("/api/document-types", { method: "POST", body: data }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["document-types"] }),
  });
}

export function useDeleteDocumentType() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api(`/api/document-types/${id}`, { method: "DELETE" }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["document-types"] }),
  });
}
