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
    <div className="min-h-screen bg-warm-gradient">
      <Header />
      <main className="max-w-2xl mx-auto px-6 py-10">
        <h1 className="text-3xl font-bold tracking-tight text-foreground mb-8 animate-fade-in-up">予約ルール設定</h1>

        <Card className="border-border/40 shadow-premium animate-fade-in-up">
          <CardHeader>
            <CardTitle>基本設定</CardTitle>
            <CardDescription className="text-muted-foreground/80">予約に関するルールを設定します</CardDescription>
          </CardHeader>
          <CardContent className="space-y-8">
            {isLoading ? (
              <div className="animate-pulse text-muted-foreground">読み込み中...</div>
            ) : (
              <>
                <div className="space-y-2.5">
                  <Label className="text-sm font-medium text-foreground/80">予約締切（開始何分前まで予約可能）</Label>
                  <div className="flex items-center gap-3">
                    <Input
                      type="number"
                      min={0}
                      value={deadlineMinutes}
                      onChange={(e) => setDeadlineMinutes(Number(e.target.value))}
                      className="w-28"
                    />
                    <span className="text-sm text-muted-foreground font-medium">分前</span>
                  </div>
                  <p className="text-xs text-muted-foreground/70">
                    例: 10 → 時間帯開始の10分前まで予約可能
                  </p>
                </div>

                <div className="space-y-2.5">
                  <Label className="text-sm font-medium text-foreground/80">ペナルティ期間（無断欠席時の予約停止日数）</Label>
                  <div className="flex items-center gap-3">
                    <Input
                      type="number"
                      min={0}
                      value={penaltyDays}
                      onChange={(e) => setPenaltyDays(Number(e.target.value))}
                      className="w-28"
                    />
                    <span className="text-sm text-muted-foreground font-medium">日間</span>
                  </div>
                </div>

                <div className="space-y-2.5">
                  <Label className="text-sm font-medium text-foreground/80">最大同時予約数</Label>
                  <div className="flex items-center gap-3">
                    <Input
                      type="number"
                      min={1}
                      value={maxReservations}
                      onChange={(e) => setMaxReservations(Number(e.target.value))}
                      className="w-28"
                    />
                    <span className="text-sm text-muted-foreground font-medium">件</span>
                  </div>
                </div>

                <Button
                  className="btn-glow"
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
