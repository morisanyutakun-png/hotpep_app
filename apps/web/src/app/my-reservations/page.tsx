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
import { Calendar, Clock, Armchair } from "lucide-react";
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
    <div className="min-h-screen bg-warm-gradient">
      <Header />
      <main className="max-w-4xl mx-auto px-6 py-10">
        <h1 className="text-3xl font-bold tracking-tight text-foreground mb-8 animate-fade-in-up">マイ予約</h1>

        {isLoading ? (
          <div className="space-y-4 stagger-children">
            {[1, 2, 3].map((i) => (
              <Card key={i} className="animate-pulse border-border/40">
                <CardContent className="p-5">
                  <div className="h-5 bg-muted rounded-lg w-1/3 mb-3" />
                  <div className="h-4 bg-muted/60 rounded-lg w-1/2" />
                </CardContent>
              </Card>
            ))}
          </div>
        ) : reservations && reservations.length > 0 ? (
          <div className="space-y-4 stagger-children">
            {reservations.map((r) => {
              const statusInfo = STATUS_MAP[r.status] || { label: r.status, variant: "outline" as const };
              return (
                <Card key={r.id} className="hover:shadow-premium-hover transition-all duration-300 border-border/40">
                  <CardContent className="p-5">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                      <div className="space-y-2">
                        <div className="flex items-center gap-2.5">
                          <span className="font-semibold tracking-tight text-foreground">{r.space_name}</span>
                          <Badge variant={statusInfo.variant}>{statusInfo.label}</Badge>
                        </div>
                        <div className="text-sm text-muted-foreground flex flex-wrap gap-x-5 gap-y-1">
                          <span className="flex items-center gap-1.5"><Calendar className="w-3.5 h-3.5 opacity-50" /> {format(new Date(r.date), "M月d日 (EEE)", { locale: ja })}</span>
                          <span className="flex items-center gap-1.5"><Clock className="w-3.5 h-3.5 opacity-50" /> {r.time_slot_label}</span>
                          <span className="flex items-center gap-1.5"><Armchair className="w-3.5 h-3.5 opacity-50" /> {r.seat_label}</span>
                        </div>
                      </div>
                      {r.status === "booked" && (
                        <Button
                          variant="outline"
                          size="sm"
                          className="text-destructive hover:text-destructive hover:bg-destructive/5 self-start"
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
          <Card className="text-center py-16 border-border/40">
            <CardContent>
              <p className="text-muted-foreground mb-5 text-base">予約はまだありません</p>
              <Button
                className="btn-glow"
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
