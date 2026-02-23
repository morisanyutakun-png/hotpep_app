"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/lib/auth";
import { useApiFetch } from "@/hooks/use-api";
import { Header } from "@/components/header";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";

interface Settings {
  booking_deadline_minutes: number;
  penalty_days: number;
  max_concurrent_reservations: number;
}

export default function AdminSettingsPage() {
  const router = useRouter();
  const { user, role, isLoading: authLoading } = useAuth();
  const apiFetch = useApiFetch();
  const queryClient = useQueryClient();

  const [deadlineMinutes, setDeadlineMinutes] = useState(10);
  const [penaltyDays, setPenaltyDays] = useState(3);
  const [maxReservations, setMaxReservations] = useState(1);

  useEffect(() => {
    if (!authLoading) {
      if (!user) router.push("/login");
      else if (role !== "admin") router.push("/");
    }
  }, [authLoading, user, role, router]);

  const { data: settings, isLoading } = useQuery({
    queryKey: ["adminSettings"],
    queryFn: () => apiFetch<Settings>("/admin/settings"),
    enabled: !!user && role === "admin",
  });

  useEffect(() => {
    if (settings) {
      setDeadlineMinutes(settings.booking_deadline_minutes);
      setPenaltyDays(settings.penalty_days);
      setMaxReservations(settings.max_concurrent_reservations);
    }
  }, [settings]);

  const saveMutation = useMutation({
    mutationFn: () =>
      apiFetch<any>("/admin/settings", {
        method: "PUT",
        body: JSON.stringify({
          booking_deadline_minutes: deadlineMinutes,
          penalty_days: penaltyDays,
          max_concurrent_reservations: maxReservations,
        }),
      }),
    onSuccess: () => {
      toast.success("設定を保存しました");
      queryClient.invalidateQueries({ queryKey: ["adminSettings"] });
    },
    onError: (err: Error) => toast.error("保存に失敗しました", { description: err.message }),
  });

  if (authLoading || !user) return null;

  return (
    <div className="min-h-screen bg-gray-50">
      <Header />
      <main className="max-w-2xl mx-auto px-4 py-8">
        <h1 className="text-2xl font-bold text-gray-900 mb-6">予約ルール設定</h1>

        <Card>
          <CardHeader>
            <CardTitle>基本設定</CardTitle>
            <CardDescription>予約に関するルールを設定します</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {isLoading ? (
              <div className="animate-pulse">読み込み中...</div>
            ) : (
              <>
                <div className="space-y-2">
                  <Label>予約締切（開始何分前まで予約可能）</Label>
                  <div className="flex items-center gap-2">
                    <Input
                      type="number"
                      min={0}
                      value={deadlineMinutes}
                      onChange={(e) => setDeadlineMinutes(Number(e.target.value))}
                      className="w-24"
                    />
                    <span className="text-sm text-muted-foreground">分前</span>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    例: 10 → 時間帯開始の10分前まで予約可能
                  </p>
                </div>

                <div className="space-y-2">
                  <Label>ペナルティ期間（無断欠席時の予約停止日数）</Label>
                  <div className="flex items-center gap-2">
                    <Input
                      type="number"
                      min={0}
                      value={penaltyDays}
                      onChange={(e) => setPenaltyDays(Number(e.target.value))}
                      className="w-24"
                    />
                    <span className="text-sm text-muted-foreground">日間</span>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label>最大同時予約数</Label>
                  <div className="flex items-center gap-2">
                    <Input
                      type="number"
                      min={1}
                      value={maxReservations}
                      onChange={(e) => setMaxReservations(Number(e.target.value))}
                      className="w-24"
                    />
                    <span className="text-sm text-muted-foreground">件</span>
                  </div>
                </div>

                <Button
                  className="bg-orange-500 hover:bg-orange-600"
                  onClick={() => saveMutation.mutate()}
                  disabled={saveMutation.isPending}
                >
                  {saveMutation.isPending ? "保存中..." : "設定を保存"}
                </Button>
              </>
            )}
          </CardContent>
        </Card>
      </main>
    </div>
  );
}
