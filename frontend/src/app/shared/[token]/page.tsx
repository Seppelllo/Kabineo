"use client";

import { useParams } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Download, FileText } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";

interface SharedDoc {
  id: string;
  title: string;
  filename: string;
  mime_type: string;
  file_size: number;
  has_password: boolean;
}

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

export default function SharedPage() {
  const params = useParams();
  const token = params.token as string;

  const { data, isLoading, error } = useQuery<SharedDoc>({
    queryKey: ["shared", token],
    queryFn: async () => {
      const res = await fetch(`${API_URL}/api/shared/${token}`);
      if (!res.ok) throw new Error("Not found");
      return res.json();
    },
  });

  const handleDownload = () => {
    window.open(`${API_URL}/api/shared/${token}/download`, "_blank");
  };

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-muted/40">
        <Skeleton className="h-64 w-96" />
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-muted/40">
        <Card className="w-96">
          <CardContent className="pt-6 text-center">
            <FileText className="mx-auto h-12 w-12 text-muted-foreground" />
            <p className="mt-4 text-lg font-medium">Link ungültig oder abgelaufen</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-muted/40">
      <Card className="w-96">
        <CardHeader className="text-center">
          <div className="mx-auto rounded-full bg-primary/10 p-3 mb-2">
            <FileText className="h-8 w-8 text-primary" />
          </div>
          <CardTitle>{data.title}</CardTitle>
          <p className="text-sm text-muted-foreground">{data.filename}</p>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex justify-between text-sm text-muted-foreground">
            <span>Typ</span>
            <span>{data.mime_type.split("/")[1]?.toUpperCase()}</span>
          </div>
          <div className="flex justify-between text-sm text-muted-foreground">
            <span>Größe</span>
            <span>{(data.file_size / 1024 / 1024).toFixed(1)} MB</span>
          </div>
          <Button onClick={handleDownload} className="w-full">
            <Download className="mr-2 h-4 w-4" />
            Herunterladen
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
