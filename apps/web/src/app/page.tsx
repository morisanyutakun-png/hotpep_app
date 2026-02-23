"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/lib/auth";
import { useApiFetch } from "@/hooks/use-api";
import { Header } from "@/components/header";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

interface Space {
  id: string;
  tenant_id: string;
  name: string;
  description: string | null;
  is_active: boolean;
  grid_rows: number;
  grid_cols: number;
}

export default function HomePage() {
  const router = useRouter();
  const { user, tenantId, isLoading: authLoading, logout } = useAuth();
  const apiFetch = useApiFetch();

  useEffect(() => {
    if (!authLoading && !user) {
      router.push("/login");
    }
  }, [authLoading, user, router]);

  const { data: spaces, isLoading, error } = useQuery({
    queryKey: ["spaces", tenantId],
    queryFn: () => apiFetch<Space[]>(`/tenants/${tenantId}/spaces`),
    enabled: !!tenantId && !!user,
    retry: false,
  });

  if (authLoading || !user) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-pulse text-muted-foreground">読み込み中...</div>
      </div>
    );
  }

  if (!tenantId) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-orange-50/50 to-amber-50/50">
        <Header />
        <main className="max-w-7xl mx-auto px-4 py-8">
          <Card className="text-center py-12">
            <CardContent className="space-y-4">
              <p className="text-lg font-medium text-gray-900">テナントが設定されていません</p>
              <p className="text-muted-foreground">
                アカウントにテナントが紐づいていません。新しいアカウントを作成してください。
              </p>
              <div className="flex justify-center gap-3">
                <Button
                  variant="outline"
                  onClick={() => { logout(); router.push("/login"); }}
                >
                  ログアウト
                </Button>
                <Button
                  className="bg-orange-500 hover:bg-orange-600"
                  onClick={() => { logout(); router.push("/register"); }}
                >
                  アカウント再作成
                </Button>
              </div>
            </CardContent>
          </Card>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-orange-50/50 to-amber-50/50">
      <Header />

      <main className="max-w-7xl mx-auto px-4 py-8">
        <div className="mb-8">
          <h1 className="text-2xl font-bold text-gray-900">スペース一覧</h1>
          <p className="text-muted-foreground mt-1">
            予約したいスペースを選んでください
          </p>
        </div>

        {isLoading ? (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {[1, 2, 3].map((i) => (
              <Card key={i} className="animate-pulse">
                <CardHeader>
                  <div className="h-6 bg-gray-200 rounded w-1/2" />
                  <div className="h-4 bg-gray-100 rounded w-3/4 mt-2" />
                </CardHeader>
                <CardContent>
                  <div className="h-10 bg-gray-100 rounded" />
                </CardContent>
              </Card>
            ))}
          </div>
        ) : spaces && spaces.length > 0 ? (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {spaces.map((space) => (
              <Card
                key={space.id}
                className="hover:shadow-md transition-shadow cursor-pointer group"
                onClick={() => router.push(`/spaces/${space.id}`)}
              >
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-lg group-hover:text-orange-600 transition-colors">
                      {space.name}
                    </CardTitle>
                    <Badge variant="secondary" className="bg-green-50 text-green-700 border-green-200">
                      予約可能
                    </Badge>
                  </div>
                  <CardDescription className="line-clamp-2">
                    {space.description || "説明はありません"}
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-muted-foreground">
                      座席あり
                    </span>
                    <Button
                      size="sm"
                      className="bg-orange-500 hover:bg-orange-600"
                    >
                      予約する →
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        ) : (
          <Card className="text-center py-12">
            <CardContent>
              <p className="text-muted-foreground">
                まだスペースが登録されていません
              </p>
            </CardContent>
          </Card>
        )}
      </main>
    </div>
  );
}