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
      <div className="min-h-screen bg-warm-gradient">
        <Header />
        <main className="max-w-7xl mx-auto px-6 py-12">
          <Card className="text-center py-16 shadow-premium-lg border-border/40">
            <CardContent className="space-y-5">
              <p className="text-lg font-semibold tracking-tight text-foreground">テナントが設定されていません</p>
              <p className="text-muted-foreground max-w-sm mx-auto">
                アカウントにテナントが紐づいていません。新しいアカウントを作成してください。
              </p>
              <div className="flex justify-center gap-3 pt-2">
                <Button
                  variant="outline"
                  onClick={() => { logout(); router.push("/login"); }}
                >
                  ログアウト
                </Button>
                <Button
                  className="btn-glow"
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
    <div className="min-h-screen bg-warm-gradient">
      <Header />

      <main className="max-w-7xl mx-auto px-6 py-10">
        <div className="mb-10 animate-fade-in-up">
          <h1 className="text-3xl font-bold tracking-tight text-foreground">スペース一覧</h1>
          <p className="text-muted-foreground mt-2 text-base">
            予約したいスペースを選んでください
          </p>
        </div>

        {isLoading ? (
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3 stagger-children">
            {[1, 2, 3].map((i) => (
              <Card key={i} className="animate-pulse border-border/30">
                <CardHeader>
                  <div className="h-6 bg-muted rounded-lg w-1/2" />
                  <div className="h-4 bg-muted/60 rounded-lg w-3/4 mt-3" />
                </CardHeader>
                <CardContent>
                  <div className="h-11 bg-muted/40 rounded-xl" />
                </CardContent>
              </Card>
            ))}
          </div>
        ) : spaces && spaces.length > 0 ? (
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3 stagger-children">
            {spaces.map((space) => (
              <Card
                key={space.id}
                className="hover:shadow-premium-hover hover:-translate-y-0.5 transition-all duration-300 cursor-pointer group border-border/40"
                onClick={() => router.push(`/spaces/${space.id}`)}
              >
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-lg group-hover:text-primary transition-colors duration-200">
                      {space.name}
                    </CardTitle>
                    <Badge variant="secondary" className="bg-emerald-50 text-emerald-600 border border-emerald-200/60 font-medium">
                      予約可能
                    </Badge>
                  </div>
                  <CardDescription className="line-clamp-2 leading-relaxed">
                    {space.description || "説明はありません"}
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-muted-foreground font-medium">
                      座席あり
                    </span>
                    <Button
                      size="sm"
                      className="btn-glow group-hover:shadow-md transition-all duration-200"
                    >
                      予約する →
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        ) : (
          <Card className="text-center py-16 border-border/40">
            <CardContent>
              <p className="text-muted-foreground text-base">
                まだスペースが登録されていません
              </p>
            </CardContent>
          </Card>
        )}
      </main>
    </div>
  );
}