"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";

export interface Tag {
  id: string;
  name: string;
  color: string;
}

export interface Document {
  id: string;
  title: string;
  description: string | null;
  filename: string;
  mime_type: string;
  file_size: number;
  folder_id: string | null;
  owner_id: string;
  current_version: number;
  ocr_status: string;
  tags: Tag[];
  correspondent_id: string | null;
  correspondent_name: string | null;
  document_type_id: string | null;
  document_type_name: string | null;
  document_date: string | null;
  asn: string | null;
  retention_date: string | null;
  is_favorite?: boolean;
  deleted_at?: string | null;
  metadata: Record<string, unknown> | null;
  created_at: string;
  updated_at: string;
}

interface DocumentList {
  items: Document[];
  total: number;
  page: number;
  page_size: number;
}

export interface Comment {
  id: string;
  document_id: string;
  user_id: string;
  username: string;
  text: string;
  created_at: string;
}

interface CommentList {
  items: Comment[];
}

interface UseDocumentsOptions {
  folderId?: string | null;
  page?: number;
  rootOnly?: boolean;
  favoritesOnly?: boolean;
  trash?: boolean;
}

export function useDocuments(folderIdOrOptions?: string | null | UseDocumentsOptions, page = 1, rootOnly = false) {
  // Support both old and new call signatures
  let opts: UseDocumentsOptions;
  if (typeof folderIdOrOptions === "object" && folderIdOrOptions !== null && !Array.isArray(folderIdOrOptions) && "folderId" in folderIdOrOptions || typeof folderIdOrOptions === "object" && folderIdOrOptions !== null && "favoritesOnly" in folderIdOrOptions || typeof folderIdOrOptions === "object" && folderIdOrOptions !== null && "trash" in folderIdOrOptions) {
    opts = folderIdOrOptions as UseDocumentsOptions;
  } else {
    opts = { folderId: folderIdOrOptions as string | null | undefined, page, rootOnly };
  }

  const { folderId, page: p = 1, rootOnly: ro = false, favoritesOnly = false, trash = false } = opts;

  return useQuery<DocumentList>({
    queryKey: ["documents", folderId, p, ro, favoritesOnly, trash],
    queryFn: () => {
      if (trash) {
        return api(`/api/documents?trash=true&page=${p}&page_size=20`);
      }
      const params = new URLSearchParams({ page: String(p), page_size: "20" });
      if (folderId) params.set("folder_id", folderId);
      else if (ro) params.set("root_only", "true");
      if (favoritesOnly) params.set("favorites_only", "true");
      return api(`/api/documents?${params}`);
    },
  });
}

export function useDocument(id: string) {
  return useQuery<Document>({
    queryKey: ["documents", id],
    queryFn: () => api(`/api/documents/${id}`),
    enabled: !!id,
  });
}

export function useUploadDocument() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (formData: FormData) => {
      return api<Document>("/api/documents", {
        method: "POST",
        body: formData,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["documents"] });
    },
  });
}

export function useDeleteDocument() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      return api(`/api/documents/${id}`, { method: "DELETE" });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["documents"] });
    },
  });
}

export function usePermanentDeleteDocument() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      return api(`/api/documents/${id}?permanent=true`, { method: "DELETE" });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["documents"] });
    },
  });
}

export function useRestoreDocument() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      return api(`/api/documents/${id}/restore`, { method: "POST" });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["documents"] });
    },
  });
}

export function useUpdateDocument() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      id,
      data,
    }: {
      id: string;
      data: { title?: string; description?: string; folder_id?: string; tag_ids?: string[]; is_favorite?: boolean; correspondent_id?: string | null; document_type_id?: string | null; document_date?: string | null; asn?: string | null; retention_date?: string | null };
    }) => {
      return api<Document>(`/api/documents/${id}`, {
        method: "PUT",
        body: data,
      });
    },
    onSuccess: (_, { id }) => {
      queryClient.invalidateQueries({ queryKey: ["documents"] });
      queryClient.invalidateQueries({ queryKey: ["documents", id] });
    },
  });
}

export function useToggleFavorite() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, is_favorite }: { id: string; is_favorite: boolean }) => {
      return api<Document>(`/api/documents/${id}`, {
        method: "PUT",
        body: { is_favorite },
      });
    },
    onSuccess: (_, { id }) => {
      queryClient.invalidateQueries({ queryKey: ["documents"] });
      queryClient.invalidateQueries({ queryKey: ["documents", id] });
    },
  });
}

export function useBulkAction() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: {
      document_ids: string[];
      action: string;
      folder_id?: string;
      tag_ids?: string[];
    }) => {
      return api("/api/documents/bulk", {
        method: "POST",
        body: data,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["documents"] });
    },
  });
}

export function useDocumentComments(documentId: string) {
  return useQuery<Comment[]>({
    queryKey: ["documents", documentId, "comments"],
    queryFn: () => api<Comment[]>(`/api/documents/${documentId}/comments`),
    enabled: !!documentId,
  });
}

export function useAddComment() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ documentId, text }: { documentId: string; text: string }) => {
      return api<Comment>(`/api/documents/${documentId}/comments`, {
        method: "POST",
        body: { text },
      });
    },
    onSuccess: (_, { documentId }) => {
      queryClient.invalidateQueries({ queryKey: ["documents", documentId, "comments"] });
    },
  });
}

export interface Version {
  id: string;
  version_number: number;
  file_size: number;
  uploaded_by: string;
  comment: string | null;
  created_at: string;
}

export function useDocumentVersions(documentId: string) {
  return useQuery<Version[]>({
    queryKey: ["documents", documentId, "versions"],
    queryFn: () => api<Version[]>(`/api/documents/${documentId}/versions`),
    enabled: !!documentId,
  });
}

export function useUploadVersion() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ documentId, formData }: { documentId: string; formData: FormData }) => {
      return api<Version>(`/api/documents/${documentId}/versions`, {
        method: "POST",
        body: formData,
      });
    },
    onSuccess: (_, { documentId }) => {
      queryClient.invalidateQueries({ queryKey: ["documents", documentId] });
      queryClient.invalidateQueries({ queryKey: ["documents", documentId, "versions"] });
      queryClient.invalidateQueries({ queryKey: ["documents"] });
    },
  });
}

export function useMultiUpload() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (formData: FormData) => {
      return api<Document>("/api/documents/multi", {
        method: "POST",
        body: formData,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["documents"] });
    },
  });
}

// ── Page Management Hooks ───────────────────────────────────────────────────

export function useRotatePage() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ docId, pageNum, direction }: { docId: string; pageNum: number; direction: "cw" | "ccw" }) => {
      return api(`/api/documents/${docId}/pages/${pageNum}/rotate?direction=${direction}`, { method: "POST" });
    },
    onSuccess: (_, { docId }) => {
      queryClient.invalidateQueries({ queryKey: ["documents", docId] });
    },
  });
}

export function useReorderPages() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ docId, order }: { docId: string; order: number[] }) => {
      return api(`/api/documents/${docId}/pages/reorder`, { method: "POST", body: { order } });
    },
    onSuccess: (_, { docId }) => {
      queryClient.invalidateQueries({ queryKey: ["documents", docId] });
    },
  });
}

export function useDeletePage() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ docId, pageNum }: { docId: string; pageNum: number }) => {
      return api(`/api/documents/${docId}/pages/${pageNum}`, { method: "DELETE" });
    },
    onSuccess: (_, { docId }) => {
      queryClient.invalidateQueries({ queryKey: ["documents", docId] });
    },
  });
}

export function useExtractPage() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ docId, pageNum }: { docId: string; pageNum: number }) => {
      return api<Document>(`/api/documents/${docId}/pages/${pageNum}/extract`, { method: "POST" });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["documents"] });
    },
  });
}
