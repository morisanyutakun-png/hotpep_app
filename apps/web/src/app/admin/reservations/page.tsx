"use client";

import { useEffect, useState } from "react";
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
import { Input } from "@/components/ui/input";
import { toast } from "sonner";

interface Reservation {
  id: string;
  space_id: string;
  seat_id: string;
  user_id: string;
  date: string;
  status: string;
  seat_label: string | null;
  space_name: string | null;
  time_slot_label: string | null;
  user_display_name: string | null;
  created_at: string;
}

const STATUS_STYLES: Record<string, { label: string; className: string }> = {
  booked: { label: "予約済み", className: "bg-blue-50 text-blue-700 border-blue-200" },
  checked_in: { label: "チェックイン", className: "bg-green-50 text-green-700 border-green-200" },
  used: { label: "利用完了", className: "bg-gray-50 text-gray-600 border-gray-200" },
  cancelled: { label: "キャンセル", className: "bg-yellow-50 text-yellow-700 border-yellow-200" },
  no_show: { label: "無断欠席", className: "bg-red-50 text-red-700 border-red-200" },
};

export default function AdminReservationsPage() {
  const router = useRouter();
  const { user, role, isLoading: authLoading } = useAuth();
  const apiFetch = useApiFetch();
  const queryClient = useQueryClient();
  const [filterDate, setFilterDate] = useState(format(new Date(), "yyyy-MM-dd"));

  useEffect(() => {
    if (!authLoading) {
      if (!user) router.push("/login");
      else if (role !== "admin") router.push("/");
    }
  }, [authLoading, user, role, router]);

  const { data: reservations, isLoading } = useQuery({
    queryKey: ["adminReservations", filterDate],
    queryFn: () =>
      apiFetch<Reservation[]>(`/admin/reservations?date=${filterDate}`),
    enabled: !!user && role === "admin",
  });

  const checkInMutation = useMutation({
    mutationFn: (id: string) =>
      apiFetch<any>(`/admin/reservations/${id}/check-in`, { method: "POST" }),
    onSuccess: () => {
      toast.success("チェックインしました");
      queryClient.invalidateQueries({ queryKey: ["adminReservations"] });
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const markUsedMutation = useMutation({
    mutationFn: (id: string) =>
      apiFetch<any>(`/admin/reservations/${id}/mark-used`, { method: "POST" }),
    onSuccess: () => {
      toast.success("利用完了にしました");
      queryClient.invalidateQueries({ queryKey: ["adminReservations"] });
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const noShowMutation = useMutation({
    mutationFn: (id: string) =>
      apiFetch<any>(`/admin/reservations/${id}/mark-no-show`, { method: "POST" }),
    onSuccess: () => {
      toast.success("無断欠席として記録しました");
      queryClient.invalidateQueries({ queryKey: ["adminReservations"] });
    },
    onError: (err: Error) => toast.error(err.message),
  });

  if (authLoading || !user) return null;

  return (
    <div className="min-h-screen bg-gray-50">
      <Header />
      <main className="max-w-7xl mx-auto px-4 py-8">
        <div className="flex items-center justify-between mb-6 flex-wrap gap-3">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">予約管理</h1>
            <p className="text-muted-foreground mt-1">予約の確認・チェックイン・no_show処理</p>
          </div>
          <div className="flex items-center gap-2">
            <Input
              type="date"
              value={filterDate}
              onChange={(e) => setFilterDate(e.target.value)}
              className="w-40"
            />
          </div>
        </div>

        {isLoading ? (
          <div className="animate-pulse text-muted-foreground">読み込み中...</div>
        ) : reservations && reservations.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-gray-50/80">
                  <th className="text-left p-3 font-semibold">利用者</th>
                  <th className="text-left p-3 font-semibold">スペース</th>
                  <th className="text-left p-3 font-semibold">座席</th>
                  <th className="text-left p-3 font-semibold">時間帯</th>
                  <th className="text-left p-3 font-semibold">ステータス</th>
                  <th className="text-left p-3 font-semibold">操作</th>
                </tr>
              </thead>
              <tbody>
                {reservations.map((r) => {
                  const statusInfo = STATUS_STYLES[r.status] || { label: r.status, className: "" };
                  return (
                    <tr key={r.id} className="border-b hover:bg-gray-50/50">
                      <td className="p-3 font-medium">{r.user_display_name || "-"}</td>
                      <td className="p-3">{r.space_name}</td>
                      <td className="p-3">
                        <Badge variant="outline">{r.seat_label}</Badge>
                      </td>
                      <td className="p-3">{r.time_slot_label}</td>
                      <td className="p-3">
                        <Badge className={statusInfo.className}>{statusInfo.label}</Badge>
                      </td>
                      <td className="p-3">
                        <div className="flex gap-1.5">
                          {r.status === "booked" && (
                            <>
                              <Button
                                size="sm"
                                variant="outline"
                                className="text-green-600 hover:bg-green-50 h-7 text-xs"
                                onClick={() => checkInMutation.mutate(r.id)}
                              >
                                チェックイン
                              </Button>
                              <Button
                                size="sm"
                                variant="outline"
                                className="text-red-600 hover:bg-red-50 h-7 text-xs"
                                onClick={() => {
                                  if (confirm("無断欠席として記録しますか？ペナルティが付与されます。")) {
                                    noShowMutation.mutate(r.id);
                                  }
                                }}
                              >
                                No Show
                              </Button>
                            </>
                          )}
                          {r.status === "checked_in" && (
                            <Button
                              size="sm"
                              variant="outline"
                              className="text-blue-600 hover:bg-blue-50 h-7 text-xs"
                              onClick={() => markUsedMutation.mutate(r.id)}
                            >
                              利用完了
                            </Button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <Card className="text-center py-12">
            <CardContent>
              <p className="text-muted-foreground">
                {filterDate} の予約はありません
              </p>
            </CardContent>
          </Card>
        )}
      </main>
    </div>
  );
}
