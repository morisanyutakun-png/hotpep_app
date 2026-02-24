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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { toast } from "sonner";

// --- Types ---

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

interface TimelineSeat {
  id: string;
  label: string;
  seat_type: string;
  is_enabled: boolean;
}

interface TimelineSlot {
  id: string;
  label: string;
  start_time: string;
  end_time: string;
  display_order: number;
}

interface TimelineCellReservation {
  id: string;
  status: string;
  user_display_name: string | null;
  user_id: string | null;
}

interface TimelineCell {
  seat_id: string;
  time_slot_id: string;
  reservation: TimelineCellReservation | null;
}

interface TimelineSpace {
  id: string;
  name: string;
}

interface TimelineData {
  spaces: TimelineSpace[];
  seats: TimelineSeat[];
  time_slots: TimelineSlot[];
  cells: TimelineCell[];
  date: string;
}

// --- Constants ---

type ViewMode = "list" | "timeline";

const STATUS_STYLES: Record<string, { label: string; className: string; cellBg: string }> = {
  booked: {
    label: "予約済み",
    className: "bg-blue-50 text-blue-700 border-blue-200",
    cellBg: "bg-blue-100 border-blue-300 text-blue-800",
  },
  checked_in: {
    label: "チェックイン",
    className: "bg-green-50 text-green-700 border-green-200",
    cellBg: "bg-green-100 border-green-300 text-green-800",
  },
  used: {
    label: "利用完了",
    className: "bg-gray-100 text-gray-600 border-gray-200",
    cellBg: "bg-gray-100 border-gray-300 text-gray-600",
  },
  cancelled: {
    label: "キャンセル",
    className: "bg-yellow-50 text-yellow-700 border-yellow-200",
    cellBg: "bg-yellow-50 border-yellow-300 text-yellow-700",
  },
  no_show: {
    label: "無断欠席",
    className: "bg-red-50 text-red-700 border-red-200",
    cellBg: "bg-red-100 border-red-300 text-red-700",
  },
};

// --- Component ---

export default function AdminReservationsPage() {
  const router = useRouter();
  const { user, role, isLoading: authLoading } = useAuth();
  const apiFetch = useApiFetch();
  const queryClient = useQueryClient();
  const [filterDate, setFilterDate] = useState(format(new Date(), "yyyy-MM-dd"));
  const [viewMode, setViewMode] = useState<ViewMode>("list");
  const [selectedSpaceId, setSelectedSpaceId] = useState<string>("all");

  useEffect(() => {
    if (!authLoading) {
      if (!user) router.push("/login");
      else if (role !== "admin") router.push("/");
    }
  }, [authLoading, user, role, router]);

  // List view query
  const { data: reservations, isLoading: listLoading } = useQuery({
    queryKey: ["adminReservations", filterDate],
    queryFn: () =>
      apiFetch<Reservation[]>(`/admin/reservations?date=${filterDate}`),
    enabled: !!user && role === "admin" && viewMode === "list",
  });

  // Timeline view query
  const { data: timeline, isLoading: timelineLoading } = useQuery({
    queryKey: ["adminTimeline", filterDate, selectedSpaceId],
    queryFn: () => {
      const params = new URLSearchParams({ date: filterDate });
      if (selectedSpaceId !== "all") params.set("space_id", selectedSpaceId);
      return apiFetch<TimelineData>(`/admin/reservations/timeline?${params}`);
    },
    enabled: !!user && role === "admin" && viewMode === "timeline",
  });

  // Mutations
  const checkInMutation = useMutation({
    mutationFn: (id: string) =>
      apiFetch<any>(`/admin/reservations/${id}/check-in`, { method: "POST" }),
    onSuccess: () => {
      toast.success("チェックインしました");
      queryClient.invalidateQueries({ queryKey: ["adminReservations"] });
      queryClient.invalidateQueries({ queryKey: ["adminTimeline"] });
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const markUsedMutation = useMutation({
    mutationFn: (id: string) =>
      apiFetch<any>(`/admin/reservations/${id}/mark-used`, { method: "POST" }),
    onSuccess: () => {
      toast.success("利用完了にしました");
      queryClient.invalidateQueries({ queryKey: ["adminReservations"] });
      queryClient.invalidateQueries({ queryKey: ["adminTimeline"] });
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const noShowMutation = useMutation({
    mutationFn: (id: string) =>
      apiFetch<any>(`/admin/reservations/${id}/mark-no-show`, { method: "POST" }),
    onSuccess: () => {
      toast.success("無断欠席として記録しました");
      queryClient.invalidateQueries({ queryKey: ["adminReservations"] });
      queryClient.invalidateQueries({ queryKey: ["adminTimeline"] });
    },
    onError: (err: Error) => toast.error(err.message),
  });

  if (authLoading || !user) return null;

  return (
    <div className="min-h-screen bg-gray-50">
      <Header />
      <main className="max-w-[1400px] mx-auto px-4 py-8">
        {/* Header + Controls */}
        <div className="flex items-center justify-between mb-6 flex-wrap gap-3">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">予約管理</h1>
            <p className="text-muted-foreground mt-1">予約の確認・チェックイン・no_show処理</p>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            {/* View mode toggle */}
            <div className="flex bg-white border rounded-lg overflow-hidden">
              <button
                className={`px-3 py-1.5 text-sm font-medium transition-colors ${
                  viewMode === "list"
                    ? "bg-orange-500 text-white"
                    : "text-gray-600 hover:bg-gray-50"
                }`}
                onClick={() => setViewMode("list")}
              >
                📋 リスト
              </button>
              <button
                className={`px-3 py-1.5 text-sm font-medium transition-colors ${
                  viewMode === "timeline"
                    ? "bg-orange-500 text-white"
                    : "text-gray-600 hover:bg-gray-50"
                }`}
                onClick={() => setViewMode("timeline")}
              >
                📊 タイムライン
              </button>
            </div>

            {/* Space filter (timeline only) */}
            {viewMode === "timeline" && timeline?.spaces && timeline.spaces.length > 1 && (
              <Select value={selectedSpaceId} onValueChange={setSelectedSpaceId}>
                <SelectTrigger className="w-40">
                  <SelectValue placeholder="スペース" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">全スペース</SelectItem>
                  {timeline.spaces.map((s) => (
                    <SelectItem key={s.id} value={s.id}>
                      {s.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}

            <Input
              type="date"
              value={filterDate}
              onChange={(e) => setFilterDate(e.target.value)}
              className="w-40"
            />
          </div>
        </div>

        {/* Content */}
        {viewMode === "list" ? (
          <ListView
            reservations={reservations || []}
            isLoading={listLoading}
            filterDate={filterDate}
            onCheckIn={(id) => checkInMutation.mutate(id)}
            onMarkUsed={(id) => markUsedMutation.mutate(id)}
            onNoShow={(id) => noShowMutation.mutate(id)}
          />
        ) : (
          <TimelineView
            timeline={timeline || null}
            isLoading={timelineLoading}
            filterDate={filterDate}
            onCheckIn={(id) => checkInMutation.mutate(id)}
            onMarkUsed={(id) => markUsedMutation.mutate(id)}
            onNoShow={(id) => noShowMutation.mutate(id)}
          />
        )}
      </main>
    </div>
  );
}

// ===================
// List View (existing)
// ===================

function ListView({
  reservations,
  isLoading,
  filterDate,
  onCheckIn,
  onMarkUsed,
  onNoShow,
}: {
  reservations: Reservation[];
  isLoading: boolean;
  filterDate: string;
  onCheckIn: (id: string) => void;
  onMarkUsed: (id: string) => void;
  onNoShow: (id: string) => void;
}) {
  if (isLoading) {
    return <div className="animate-pulse text-muted-foreground">読み込み中...</div>;
  }

  if (reservations.length === 0) {
    return (
      <Card className="text-center py-12">
        <CardContent>
          <p className="text-muted-foreground">{filterDate} の予約はありません</p>
        </CardContent>
      </Card>
    );
  }

  return (
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
            const statusInfo = STATUS_STYLES[r.status] || {
              label: r.status,
              className: "",
              cellBg: "",
            };
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
                          onClick={() => onCheckIn(r.id)}
                        >
                          チェックイン
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          className="text-red-600 hover:bg-red-50 h-7 text-xs"
                          onClick={() => {
                            if (confirm("無断欠席として記録しますか？ペナルティが付与されます。")) {
                              onNoShow(r.id);
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
                        onClick={() => onMarkUsed(r.id)}
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
  );
}

// ========================
// Timeline View (new)
// ========================

function TimelineView({
  timeline,
  isLoading,
  filterDate,
  onCheckIn,
  onMarkUsed,
  onNoShow,
}: {
  timeline: TimelineData | null;
  isLoading: boolean;
  filterDate: string;
  onCheckIn: (id: string) => void;
  onMarkUsed: (id: string) => void;
  onNoShow: (id: string) => void;
}) {
  if (isLoading) {
    return <div className="animate-pulse text-muted-foreground">読み込み中...</div>;
  }

  if (!timeline || timeline.seats.length === 0 || timeline.time_slots.length === 0) {
    return (
      <Card className="text-center py-12">
        <CardContent>
          <p className="text-muted-foreground">
            {filterDate} のタイムラインデータがありません（スペース・座席・時間帯が未設定の可能性があります）
          </p>
        </CardContent>
      </Card>
    );
  }

  const { seats, time_slots, cells } = timeline;

  // Build lookup: cellMap[timeSlotId][seatId] = cell
  const cellMap: Record<string, Record<string, TimelineCell>> = {};
  for (const cell of cells) {
    if (!cellMap[cell.time_slot_id]) cellMap[cell.time_slot_id] = {};
    cellMap[cell.time_slot_id][cell.seat_id] = cell;
  }

  // Count stats
  const totalCells = cells.length;
  const reservedCells = cells.filter((c) => c.reservation).length;
  const availableCells = totalCells - reservedCells;
  const occupancyRate = totalCells > 0 ? Math.round((reservedCells / totalCells) * 100) : 0;

  return (
    <TooltipProvider delayDuration={200}>
      <div className="space-y-4">
        {/* Summary stats */}
        <div className="flex gap-4 flex-wrap">
          <div className="flex items-center gap-2 text-sm">
            <div className="w-4 h-4 rounded bg-gray-50 border border-gray-200" />
            <span className="text-muted-foreground">空席: {availableCells}</span>
          </div>
          <div className="flex items-center gap-2 text-sm">
            <div className="w-4 h-4 rounded bg-blue-100 border border-blue-300" />
            <span className="text-muted-foreground">予約済み</span>
          </div>
          <div className="flex items-center gap-2 text-sm">
            <div className="w-4 h-4 rounded bg-green-100 border border-green-300" />
            <span className="text-muted-foreground">チェックイン</span>
          </div>
          <div className="flex items-center gap-2 text-sm">
            <div className="w-4 h-4 rounded bg-gray-200 border border-gray-300" />
            <span className="text-muted-foreground">利用完了</span>
          </div>
          <div className="flex items-center gap-2 text-sm">
            <div className="w-4 h-4 rounded bg-red-100 border border-red-300" />
            <span className="text-muted-foreground">無断欠席</span>
          </div>
          <div className="ml-auto text-sm font-medium">
            稼働率: <span className={occupancyRate > 80 ? "text-red-600" : occupancyRate > 50 ? "text-orange-600" : "text-green-600"}>{occupancyRate}%</span>
          </div>
        </div>

        {/* Timeline matrix */}
        <div className="overflow-x-auto border rounded-lg bg-white shadow-sm">
          <table className="w-full text-xs border-collapse">
            <thead className="sticky top-0 z-10 bg-white">
              <tr>
                <th className="sticky left-0 z-20 bg-gray-100 border-b border-r p-2 text-left font-semibold text-gray-600 min-w-[100px]">
                  時間帯
                </th>
                {seats.map((seat) => (
                  <th
                    key={seat.id}
                    className="border-b border-r p-2 text-center font-semibold text-gray-600 min-w-[80px] bg-gray-50"
                  >
                    <div>{seat.label}</div>
                    <div className="text-[10px] font-normal text-gray-400">{seat.seat_type}</div>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {time_slots.map((slot) => (
                <tr key={slot.id} className="hover:bg-gray-50/30">
                  <td className="sticky left-0 z-10 bg-gray-50 border-b border-r p-2 font-medium text-gray-700 whitespace-nowrap">
                    <div>{slot.label}</div>
                    <div className="text-[10px] text-gray-400">
                      {slot.start_time} - {slot.end_time}
                    </div>
                  </td>
                  {seats.map((seat) => {
                    const cell = cellMap[slot.id]?.[seat.id];
                    const res = cell?.reservation;

                    if (!cell) {
                      return (
                        <td key={seat.id} className="border-b border-r p-1 bg-gray-50">
                          <div className="h-10" />
                        </td>
                      );
                    }

                    if (!res) {
                      return (
                        <td key={seat.id} className="border-b border-r p-1">
                          <div className="h-10 rounded bg-gray-50/50 border border-dashed border-gray-200 flex items-center justify-center">
                            <span className="text-gray-300 text-[10px]">空席</span>
                          </div>
                        </td>
                      );
                    }

                    const statusInfo = STATUS_STYLES[res.status] || {
                      label: res.status,
                      cellBg: "bg-gray-100 border-gray-300 text-gray-600",
                    };

                    return (
                      <td key={seat.id} className="border-b border-r p-1">
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <div
                              className={`h-10 rounded border text-[11px] flex flex-col items-center justify-center cursor-pointer transition-shadow hover:shadow-md ${statusInfo.cellBg}`}
                            >
                              <span className="font-medium truncate max-w-[70px]">
                                {res.user_display_name || "-"}
                              </span>
                              <span className="text-[9px] opacity-70">{statusInfo.label}</span>
                            </div>
                          </TooltipTrigger>
                          <TooltipContent side="bottom" className="max-w-[220px]">
                            <div className="space-y-1.5 text-xs">
                              <p className="font-semibold">{res.user_display_name}</p>
                              <p>座席: {seat.label} / {slot.label}</p>
                              <p>ステータス: {statusInfo.label}</p>
                              <div className="flex gap-1 pt-1">
                                {res.status === "booked" && (
                                  <>
                                    <Button
                                      size="sm"
                                      className="h-6 text-[10px] px-2 bg-green-600 hover:bg-green-700"
                                      onClick={() => onCheckIn(res.id)}
                                    >
                                      チェックイン
                                    </Button>
                                    <Button
                                      size="sm"
                                      variant="destructive"
                                      className="h-6 text-[10px] px-2"
                                      onClick={() => {
                                        if (confirm("無断欠席として記録しますか？")) {
                                          onNoShow(res.id);
                                        }
                                      }}
                                    >
                                      No Show
                                    </Button>
                                  </>
                                )}
                                {res.status === "checked_in" && (
                                  <Button
                                    size="sm"
                                    className="h-6 text-[10px] px-2 bg-blue-600 hover:bg-blue-700"
                                    onClick={() => onMarkUsed(res.id)}
                                  >
                                    利用完了
                                  </Button>
                                )}
                              </div>
                            </div>
                          </TooltipContent>
                        </Tooltip>
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </TooltipProvider>
  );
}
