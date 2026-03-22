"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";

export interface Folder {
  id: string;
  name: string;
  parent_id: string | null;
  owner_id: string;
  created_at: string;
  updated_at: string;
}

export interface FolderDetail extends Folder {
  children: Folder[];
}

export function useFolders(parentId?: string | null) {
  return useQuery<Folder[]>({
    queryKey: ["folders", parentId],
    queryFn: () => {
      const params = parentId ? `?parent_id=${parentId}` : "";
      return api(`/api/folders${params}`);
    },
  });
}

export function useFolder(id: string) {
  return useQuery<FolderDetail>({
    queryKey: ["folders", id, "detail"],
    queryFn: () => api(`/api/folders/${id}`),
    enabled: !!id,
  });
}

export function useBreadcrumb(folderId: string | null) {
  return useQuery<Folder[]>({
    queryKey: ["folders", folderId, "breadcrumb"],
    queryFn: () => api(`/api/folders/${folderId}/breadcrumb`),
    enabled: !!folderId,
  });
}

export function useCreateFolder() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: { name: string; parent_id?: string | null }) =>
      api<Folder>("/api/folders", { method: "POST", body: data }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["folders"] }),
  });
}

export function useDeleteFolder() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api(`/api/folders/${id}`, { method: "DELETE" }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["folders"] }),
  });
}

export function useUpdateFolder() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, name }: { id: string; name: string }) =>
      api<Folder>(`/api/folders/${id}`, { method: "PUT", body: { name } }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["folders"] }),
  });
}
