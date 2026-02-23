"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/lib/auth";
import { useApiFetch } from "@/hooks/use-api";
import { Header } from "@/components/header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import Link from "next/link";

interface Space {
  id: string;
  name: string;
  description: string | null;
  grid_rows: number;
  grid_cols: number;
}

export default function AdminSpacesPage() {
  const router = useRouter();
  const { user, role, tenantId, isLoading: authLoading } = useAuth();
  const apiFetch = useApiFetch();

  useEffect(() => {
    if (!authLoading) {
      if (!user) router.push("/login");
      else if (role !== "admin") router.push("/");
    }
  }, [authLoading, user, role, router]);

  const { data: spaces, isLoading } = useQuery({
    queryKey: ["adminSpaces", tenantId],
    queryFn: () => apiFetch<Space[]>(`/tenants/${tenantId}/spaces`),
    enabled: !!user && !!tenantId && role === "admin",
  });

  if (authLoading || !user) return null;

  return (
    <div className="min-h-screen bg-gray-50">
      <Header />
      <main className="max-w-7xl mx-auto px-4 py-8">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">スペース管理</h1>
            <p className="text-muted-foreground mt-1">スペースの設定と座席レイアウト編集</p>
          </div>
        </div>

        {isLoading ? (
          <div className="animate-pulse">読み込み中...</div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {spaces?.map((space) => (
              <Card key={space.id} className="hover:shadow-md transition-shadow">
                <CardHeader>
                  <CardTitle className="text-lg">{space.name}</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <p className="text-sm text-muted-foreground">{space.description || "説明なし"}</p>
                  <p className="text-sm text-muted-foreground">
                    グリッド: {space.grid_rows} × {space.grid_cols}
                  </p>
                  <Link href={`/admin/spaces/${space.id}/layout`}>
                    <Button className="w-full bg-orange-500 hover:bg-orange-600">
                      座席レイアウト編集
                    </Button>
                  </Link>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
