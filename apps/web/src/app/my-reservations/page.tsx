"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { format } from "date-fns";
import { ja } from "date-fns/locale";
import { useAuth } from "@/lib/auth";
import { useApiFetch } from "@/hooks/use-api";
import { Header } from "@/components/header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";

interface Reservation {
  id: string;
  space_id: string;
  seat_id: string;
  date: string;
  status: string;
  seat_label: string | null;
  space_name: string | null;
  time_slot_label: string | null;
  created_at: string;
}

const STATUS_MAP: Record<string, { label: string; variant: "default" | "secondary" | "destructive" | "outline" }> = {
  booked: { label: "予約済み", variant: "default" },
  checked_in: { label: "チェックイン済み", variant: "secondary" },
  used: { label: "利用完了", variant: "outline" },
  cancelled: { label: "キャンセル", variant: "destructive" },
  no_show: { label: "無断欠席", variant: "destructive" },
};

export default function MyReservationsPage() {
  const router = useRouter();
  const { user, isLoading: authLoading } = useAuth();
  const apiFetch = useApiFetch();
  const queryClient = useQueryClient();

  useEffect(() => {
    if (!authLoading && !user) router.push("/login");
  }, [authLoading, user, router]);

  const { data: reservations, isLoading } = useQuery({
    queryKey: ["myReservations"],
    queryFn: () => apiFetch<Reservation[]>("/my/reservations"),
    enabled: !!user,
  });

  const cancelMutation = useMutation({
    mutationFn: (id: string) =>
      apiFetch<any>(`/reservations/${id}/cancel`, { method: "POST" }),
    onSuccess: () => {
      toast.success("予約をキャンセルしました");
      queryClient.invalidateQueries({ queryKey: ["myReservations"] });
    },
    onError: (err: Error) => {
      toast.error("キャンセルに失敗しました", { description: err.message });
    },
  });

  if (authLoading || !user) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-pulse text-muted-foreground">読み込み中...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-orange-50/50 to-amber-50/50">
      <Header />
      <main className="max-w-4xl mx-auto px-4 py-8">
        <h1 className="text-2xl font-bold text-gray-900 mb-6">マイ予約</h1>

        {isLoading ? (
          <div className="space-y-3">
            {[1, 2, 3].map((i) => (
              <Card key={i} className="animate-pulse">
                <CardContent className="p-4">
                  <div className="h-5 bg-gray-200 rounded w-1/3 mb-2" />
                  <div className="h-4 bg-gray-100 rounded w-1/2" />
                </CardContent>
              </Card>
            ))}
          </div>
        ) : reservations && reservations.length > 0 ? (
          <div className="space-y-3">
            {reservations.map((r) => {
              const statusInfo = STATUS_MAP[r.status] || { label: r.status, variant: "outline" as const };
              return (
                <Card key={r.id} className="hover:shadow-sm transition-shadow">
                  <CardContent className="p-4">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <span className="font-semibold">{r.space_name}</span>
                          <Badge variant={statusInfo.variant}>{statusInfo.label}</Badge>
                        </div>
                        <div className="text-sm text-muted-foreground flex flex-wrap gap-x-4 gap-y-1">
                          <span>📅 {format(new Date(r.date), "M月d日 (EEE)", { locale: ja })}</span>
                          <span>🕐 {r.time_slot_label}</span>
                          <span>💺 {r.seat_label}</span>
                        </div>
                      </div>
                      {r.status === "booked" && (
                        <Button
                          variant="outline"
                          size="sm"
                          className="text-red-600 hover:text-red-700 hover:bg-red-50 self-start"
                          onClick={() => cancelMutation.mutate(r.id)}
                          disabled={cancelMutation.isPending}
                        >
                          キャンセル
                        </Button>
                      )}
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        ) : (
          <Card className="text-center py-12">
            <CardContent>
              <p className="text-muted-foreground mb-4">予約はまだありません</p>
              <Button
                className="bg-orange-500 hover:bg-orange-600"
                onClick={() => router.push("/")}
              >
                スペースを探す
              </Button>
            </CardContent>
          </Card>
        )}
      </main>
    </div>
  );
}
