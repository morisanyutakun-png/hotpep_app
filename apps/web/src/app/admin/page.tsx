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

interface DashboardStats {
  total_reservations_today: number;
  checked_in_count: number;
  no_show_count: number;
  available_seats: number;
  total_seats: number;
}

export default function AdminDashboard() {
  const router = useRouter();
  const { user, role, isLoading: authLoading } = useAuth();
  const apiFetch = useApiFetch();

  useEffect(() => {
    if (!authLoading) {
      if (!user) router.push("/login");
      else if (role !== "admin") router.push("/");
    }
  }, [authLoading, user, role, router]);

  const { data: stats, isLoading } = useQuery({
    queryKey: ["adminDashboard"],
    queryFn: () => apiFetch<DashboardStats>("/admin/dashboard"),
    enabled: !!user && role === "admin",
    refetchInterval: 30000,
  });

  if (authLoading || !user || role !== "admin") {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-pulse text-muted-foreground">読み込み中...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <Header />
      <main className="max-w-7xl mx-auto px-4 py-8">
        <div className="mb-8">
          <h1 className="text-2xl font-bold text-gray-900">管理ダッシュボード</h1>
          <p className="text-muted-foreground mt-1">今日の状況を確認</p>
        </div>

        {/* Stats cards */}
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4 mb-8">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm text-muted-foreground font-normal">今日の予約</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-orange-600">
                {isLoading ? "-" : stats?.total_reservations_today}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm text-muted-foreground font-normal">チェックイン済み</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-green-600">
                {isLoading ? "-" : stats?.checked_in_count}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm text-muted-foreground font-normal">無断欠席</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-red-600">
                {isLoading ? "-" : stats?.no_show_count}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm text-muted-foreground font-normal">空席数</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-blue-600">
                {isLoading ? "-" : `${stats?.available_seats}/${stats?.total_seats}`}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Quick links */}
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Link href="/admin/students">
            <Card className="hover:shadow-md transition-shadow cursor-pointer group h-full">
              <CardHeader>
                <CardTitle className="text-lg group-hover:text-orange-600">
                  👩‍🎓 生徒管理
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground">
                  生徒アカウントの登録・管理・ログイン
                </p>
              </CardContent>
            </Card>
          </Link>

          <Link href="/admin/reservations">
            <Card className="hover:shadow-md transition-shadow cursor-pointer group h-full">
              <CardHeader>
                <CardTitle className="text-lg group-hover:text-orange-600">
                  📋 予約管理
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground">
                  予約一覧の確認・チェックイン・no_show処理
                </p>
              </CardContent>
            </Card>
          </Link>

          <Link href="/admin/spaces">
            <Card className="hover:shadow-md transition-shadow cursor-pointer group h-full">
              <CardHeader>
                <CardTitle className="text-lg group-hover:text-orange-600">
                  🏢 スペース管理
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground">
                  スペースの作成・座席レイアウト編集
                </p>
              </CardContent>
            </Card>
          </Link>

          <Link href="/admin/settings">
            <Card className="hover:shadow-md transition-shadow cursor-pointer group h-full">
              <CardHeader>
                <CardTitle className="text-lg group-hover:text-orange-600">
                  ⚙️ 設定
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground">
                  予約ルール・ペナルティ設定
                </p>
              </CardContent>
            </Card>
          </Link>
        </div>
      </main>
    </div>
  );
}
