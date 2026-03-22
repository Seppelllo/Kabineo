"use client";

import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";

export interface SearchResult {
  id: string;
  title: string;
  description: string | null;
  filename: string;
  mime_type: string;
  file_size: number;
  folder_id: string | null;
  ocr_status: string;
  snippet: string | null;
  rank: number;
  created_at: string;
}

interface SearchResponse {
  items: SearchResult[];
  total: number;
  query: string;
}

export interface SearchFilters {
  folderId?: string;
  mimeType?: string;
  dateFrom?: string;
  dateTo?: string;
}

export function useSearch(query: string, filters?: SearchFilters) {
  return useQuery<SearchResponse>({
    queryKey: ["search", query, filters?.folderId, filters?.mimeType, filters?.dateFrom, filters?.dateTo],
    queryFn: () => {
      const params = new URLSearchParams({ q: query });
      if (filters?.folderId) params.set("folder_id", filters.folderId);
      if (filters?.mimeType) params.set("mime_type", filters.mimeType);
      if (filters?.dateFrom) params.set("date_from", filters.dateFrom);
      if (filters?.dateTo) params.set("date_to", filters.dateTo);
      return api(`/api/search?${params}`);
    },
    enabled: query.length > 0,
  });
}
