"use client";

import { useEffect, useState, useMemo } from "react";
import { useParams, useRouter } from "next/navigation";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { format, addDays } from "date-fns";
import { ja } from "date-fns/locale";
import { useAuth } from "@/lib/auth";
import { useApiFetch } from "@/hooks/use-api";
import { Header } from "@/components/header";
import { SeatMap } from "@/components/seat-map";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";

interface Space {
  id: string;
  name: string;
  description: string | null;
  grid_rows: number;
  grid_cols: number;
}

interface TimeSlot {
  id: string;
  label: string;
  start_time: string;
  end_time: string;
  display_order: number;
}

interface LayoutData {
  layout: { layout_json: any } | null;
  seats: any[];
  grid_rows: number;
  grid_cols: number;
}

interface SeatAvailability {
  seat_id: string;
  label: string;
  row: number;
  col: number;
  seat_type: string;
  is_enabled: boolean;
  status: string;
}

interface AvailabilityData {
  date: string;
  time_slot: TimeSlot | null;
  seats: SeatAvailability[];
}

// ステップの進捗状態を判定するヘルパー
function getStepState(
  step: number,
  selectedDate: string,
  selectedTimeSlotId: string | null,
  selectedSeatId: string | null
): "completed" | "active" | "upcoming" {
  if (step === 1) return selectedDate ? "completed" : "active";
  if (step === 2) {
    if (selectedTimeSlotId) return "completed";
    return selectedDate ? "active" : "upcoming";
  }
  if (step === 3) {
    if (selectedSeatId) return "completed";
    return selectedTimeSlotId ? "active" : "upcoming";
  }
  return "upcoming";
}

export default function SpaceReservationPage() {
  const params = useParams();
  const router = useRouter();
  const spaceId = params.spaceId as string;
  const { user, isLoading: authLoading } = useAuth();
  const apiFetch = useApiFetch();
  const queryClient = useQueryClient();

  // 日付候補（今日から7日間）
  const dateOptions = useMemo(
    () =>
      Array.from({ length: 7 }, (_, i) => {
        const d = addDays(new Date(), i);
        return {
          value: format(d, "yyyy-MM-dd"),
          label: format(d, "M/d (EEE)", { locale: ja }),
          dayLabel: format(d, "d"),
          weekday: format(d, "EEE", { locale: ja }),
          isToday: i === 0,
        };
      }),
    []
  );

  const [selectedDate, setSelectedDate] = useState(dateOptions[0].value);
  const [selectedTimeSlotId, setSelectedTimeSlotId] = useState<string | null>(null);
  const [selectedSeatId, setSelectedSeatId] = useState<string | null>(null);
  const [selectedSeatLabel, setSelectedSeatLabel] = useState<string | null>(null);
  const [isConfirming, setIsConfirming] = useState(false);

  useEffect(() => {
    if (!authLoading && !user) router.push("/login");
  }, [authLoading, user, router]);

  // スペース情報
  const { data: space } = useQuery({
    queryKey: ["space", spaceId],
    queryFn: () => apiFetch<Space>(`/spaces/${spaceId}`),
    enabled: !!user,
  });

  // レイアウト
  const { data: layoutData } = useQuery({
    queryKey: ["layout", spaceId],
    queryFn: () => apiFetch<LayoutData>(`/spaces/${spaceId}/layout`),
    enabled: !!user,
  });

  // 時間帯一覧
  const {
    data: timeSlots,
    isLoading: slotsLoading,
    isError: slotsError,
    refetch: refetchSlots,
  } = useQuery({
    queryKey: ["timeSlots", spaceId],
    queryFn: () => apiFetch<TimeSlot[]>(`/spaces/${spaceId}/time-slots`),
    enabled: !!user,
    retry: 2,
  });

  // 空き状況
  const {
    data: availability,
    isLoading: availLoading,
    isError: availError,
  } = useQuery({
    queryKey: ["availability", spaceId, selectedDate, selectedTimeSlotId],
    queryFn: () =>
      apiFetch<AvailabilityData>(
        `/spaces/${spaceId}/availability?date=${selectedDate}&time_slot_id=${selectedTimeSlotId}`
      ),
    enabled: !!user && !!selectedTimeSlotId,
    retry: 1,
  });

  // 自動選択: 最初の時間帯
  useEffect(() => {
    if (timeSlots && timeSlots.length > 0 && !selectedTimeSlotId) {
      setSelectedTimeSlotId(timeSlots[0].id);
    }
  }, [timeSlots, selectedTimeSlotId]);

  // 日付変更時: 座席選択のみリセット（時間帯はそのまま）
  useEffect(() => {
    setSelectedSeatId(null);
    setSelectedSeatLabel(null);
    setIsConfirming(false);
  }, [selectedDate, selectedTimeSlotId]);

  // 予約実行
  const reservationMutation = useMutation({
    mutationFn: () =>
      apiFetch<any>("/reservations", {
        method: "POST",
        body: JSON.stringify({
          space_id: spaceId,
          seat_id: selectedSeatId,
          time_slot_id: selectedTimeSlotId,
          date: selectedDate,
        }),
      }),
    onSuccess: () => {
      toast.success("予約が完了しました！", {
        description: `${format(new Date(selectedDate), "M月d日", { locale: ja })} ${selectedTimeSlot?.label} - ${selectedSeatLabel} 席`,
      });
      setSelectedSeatId(null);
      setSelectedSeatLabel(null);
      setIsConfirming(false);
      queryClient.invalidateQueries({ queryKey: ["availability"] });
    },
    onError: (err: Error) => {
      toast.error("予約に失敗しました", { description: err.message });
      setIsConfirming(false);
    },
  });

  const selectedTimeSlot = timeSlots?.find((t) => t.id === selectedTimeSlotId);
  const hasTimeSlots = timeSlots && timeSlots.length > 0;
  const canReserve = selectedDate && selectedTimeSlotId && selectedSeatId;

  // 空席数カウント
  const availableCount = availability?.seats?.filter((s) => s.status === "available").length ?? 0;

  if (authLoading || !user) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-pulse text-muted-foreground">読み込み中...</div>
      </div>
    );
  }

  const step1State = getStepState(1, selectedDate, selectedTimeSlotId, selectedSeatId);
  const step2State = getStepState(2, selectedDate, selectedTimeSlotId, selectedSeatId);
  const step3State = getStepState(3, selectedDate, selectedTimeSlotId, selectedSeatId);

  const stepBadgeClass = (state: "completed" | "active" | "upcoming") => {
    if (state === "completed") return "bg-emerald-500 text-white shadow-sm shadow-emerald-200";
    if (state === "active") return "bg-primary text-white shadow-sm shadow-primary/30";
    return "bg-muted text-muted-foreground";
  };

  const stepIcon = (state: "completed" | "active" | "upcoming", num: number) => {
    if (state === "completed") return "✓";
    return String(num);
  };

  return (
    <div className="min-h-screen bg-warm-gradient">
      <Header />

      <main className="max-w-7xl mx-auto px-6 py-8">
        {/* スペース情報 */}
        <div className="mb-8 animate-fade-in-up">
          <Button variant="ghost" size="sm" onClick={() => router.push("/")} className="mb-3 -ml-3 text-muted-foreground hover:text-foreground">
            ← スペース一覧に戻る
          </Button>
          <h1 className="text-3xl font-bold tracking-tight text-foreground">{space?.name || "読み込み中..."}</h1>
          {space?.description && (
            <p className="text-muted-foreground mt-2 text-base">{space.description}</p>
          )}
        </div>

        <div className="grid lg:grid-cols-[1fr_340px] gap-6">
          {/* 左: メインエリア */}
          <div className="space-y-5">
            {/* Step 1: 日付選択 */}
            <Card className={`border-border/40 transition-all duration-300 ${step1State === "active" ? "ring-2 ring-primary/20 shadow-premium" : ""}`}>
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center gap-2.5">
                  <span className={`w-7 h-7 rounded-full text-xs flex items-center justify-center font-bold transition-all duration-300 ${stepBadgeClass(step1State)}`}>
                    {stepIcon(step1State, 1)}
                  </span>
                  日付を選択
                  {selectedDate && (
                    <span className="text-xs font-normal text-muted-foreground ml-auto">
                      {format(new Date(selectedDate), "M月d日 (EEE)", { locale: ja })}
                    </span>
                  )}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex gap-2.5 overflow-x-auto pb-1 -mx-1 px-1">
                  {dateOptions.map((d) => (
                    <button
                      key={d.value}
                      onClick={() => setSelectedDate(d.value)}
                      className={`
                        flex-shrink-0 w-[4.25rem] py-3 rounded-2xl text-center transition-all duration-200
                        ${selectedDate === d.value
                          ? "bg-primary text-white shadow-md shadow-primary/25 scale-105"
                          : "bg-card border border-border/60 hover:border-primary/30 hover:bg-accent/40"
                        }
                      `}
                    >
                      <span className={`block text-[11px] font-medium ${selectedDate === d.value ? "text-white/70" : "text-muted-foreground"}`}>
                        {d.isToday ? "今日" : d.weekday}
                      </span>
                      <span className="block text-lg font-bold leading-tight mt-0.5">{d.dayLabel}</span>
                    </button>
                  ))}
                </div>
              </CardContent>
            </Card>

            {/* Step 2: 時間帯選択 */}
            <Card className={`border-border/40 transition-all duration-300 ${step2State === "active" ? "ring-2 ring-primary/20 shadow-premium" : ""}`}>
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center gap-2.5">
                  <span className={`w-7 h-7 rounded-full text-xs flex items-center justify-center font-bold transition-all duration-300 ${stepBadgeClass(step2State)}`}>
                    {stepIcon(step2State, 2)}
                  </span>
                  時間帯を選択
                  {selectedTimeSlot && (
                    <span className="text-xs font-normal text-muted-foreground ml-auto">
                      {selectedTimeSlot.label}
                    </span>
                  )}
                </CardTitle>
              </CardHeader>
              <CardContent>
                {slotsLoading ? (
                  <div className="flex items-center gap-2 py-6 justify-center text-sm text-muted-foreground">
                    <div className="w-4 h-4 border-2 border-primary border-t-transparent rounded-full animate-spin" />
                    時間帯を読み込み中...
                  </div>
                ) : slotsError ? (
                  <div className="text-center py-6 space-y-3">
                    <p className="text-sm text-destructive">時間帯の読み込みに失敗しました</p>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => refetchSlots()}
                    >
                      再読み込み
                    </Button>
                  </div>
                ) : hasTimeSlots ? (
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
                    {timeSlots.map((slot) => {
                      const isSelected = selectedTimeSlotId === slot.id;
                      return (
                        <button
                          key={slot.id}
                          onClick={() => setSelectedTimeSlotId(slot.id)}
                          className={`
                            relative px-3 py-3.5 rounded-2xl text-sm font-semibold transition-all duration-200
                            ${isSelected
                              ? "bg-primary text-white shadow-md shadow-primary/25 scale-[1.02]"
                              : "bg-card border border-border/60 hover:border-primary/30 hover:bg-accent/40"
                            }
                          `}
                        >
                          <span className="block">{slot.label}</span>
                          {isSelected && (
                            <span className="absolute -top-1 -right-1 w-5 h-5 bg-emerald-500 rounded-full flex items-center justify-center text-[10px] text-white shadow-sm">
                              ✓
                            </span>
                          )}
                        </button>
                      );
                    })}
                  </div>
                ) : (
                  <div className="text-center py-6 space-y-2">
                    <div className="text-3xl">🕐</div>
                    <p className="text-sm text-muted-foreground">
                      このスペースにはまだ時間帯が設定されていません
                    </p>
                    <p className="text-xs text-muted-foreground">
                      管理者に時間帯の追加を依頼してください
                    </p>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Step 3: 座席選択 */}
            <Card className={`border-border/40 transition-all duration-300 ${step3State === "active" ? "ring-2 ring-primary/20 shadow-premium" : ""}`}>
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center gap-2.5">
                  <span className={`w-7 h-7 rounded-full text-xs flex items-center justify-center font-bold transition-all duration-300 ${stepBadgeClass(step3State)}`}>
                    {stepIcon(step3State, 3)}
                  </span>
                  座席を選択
                  {selectedSeatLabel && (
                    <Badge className="bg-blue-50 text-blue-600 border border-blue-200/60 ml-auto text-xs font-medium">
                      {selectedSeatLabel}
                    </Badge>
                  )}
                  {!selectedSeatId && selectedTimeSlotId && availability && (
                    <span className="text-xs font-normal text-muted-foreground ml-auto">
                      空席 {availableCount} 席
                    </span>
                  )}
                </CardTitle>
              </CardHeader>
              <CardContent>
                {!selectedTimeSlotId ? (
                  <div className="text-center py-8 space-y-2">
                    <div className="text-3xl opacity-50">👆</div>
                    <p className="text-sm text-muted-foreground">
                      上の時間帯を選択すると座席マップが表示されます
                    </p>
                  </div>
                ) : availLoading ? (
                  <div className="flex items-center gap-2 py-8 justify-center text-sm text-muted-foreground">
                    <div className="w-4 h-4 border-2 border-primary border-t-transparent rounded-full animate-spin" />
                    空き状況を確認中...
                  </div>
                ) : availError ? (
                  <div className="text-center py-8 space-y-2">
                    <p className="text-sm text-red-500">空き状況の取得に失敗しました</p>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() =>
                        queryClient.invalidateQueries({
                          queryKey: ["availability", spaceId, selectedDate, selectedTimeSlotId],
                        })
                      }
                      className="text-xs"
                    >
                      再読み込み
                    </Button>
                  </div>
                ) : availableCount === 0 && !selectedSeatId ? (
                  <div className="text-center py-8 space-y-2">
                    <div className="text-3xl">😢</div>
                    <p className="text-sm text-muted-foreground">
                      この時間帯は満席です
                    </p>
                    <p className="text-xs text-muted-foreground">
                      別の時間帯や日付をお試しください
                    </p>
                  </div>
                ) : (
                  <SeatMap
                    layoutJson={layoutData?.layout?.layout_json || null}
                    availability={availability?.seats || []}
                    selectedSeatId={selectedSeatId}
                    onSelectSeat={(id, label) => {
                      if (selectedSeatId === id) {
                        setSelectedSeatId(null);
                        setSelectedSeatLabel(null);
                      } else {
                        setSelectedSeatId(id);
                        setSelectedSeatLabel(label);
                      }
                    }}
                  />
                )}
              </CardContent>
            </Card>
          </div>

          {/* 右: 予約サマリー (Sticky) */}
          <div className="lg:sticky lg:top-20 lg:self-start">
            <Card className={`shadow-premium-lg transition-all duration-300 border-border/40 ${canReserve ? "ring-2 ring-primary/20" : ""}`}>
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center gap-2">
                  📋 予約内容
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="space-y-2.5 text-sm">
                  <div className="flex justify-between items-center">
                    <span className="text-muted-foreground">スペース</span>
                    <span className="font-medium">{space?.name || "-"}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-muted-foreground">日付</span>
                    <span className="font-medium">
                      {format(new Date(selectedDate), "M月d日 (EEE)", { locale: ja })}
                    </span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-muted-foreground">時間帯</span>
                    <span className={`font-medium ${selectedTimeSlot ? "" : "text-muted-foreground/50"}`}>
                      {selectedTimeSlot ? (
                        <Badge variant="secondary" className="bg-primary/10 text-primary border border-primary/15 font-medium">
                          {selectedTimeSlot.label}
                        </Badge>
                      ) : (
                        "未選択"
                      )}
                    </span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-muted-foreground">座席</span>
                    <span className="font-medium">
                      {selectedSeatLabel ? (
                        <Badge className="bg-blue-50 text-blue-600 border border-blue-200/60 font-medium">
                          {selectedSeatLabel}
                        </Badge>
                      ) : (
                        <span className="text-muted-foreground/50">未選択</span>
                      )}
                    </span>
                  </div>
                </div>

                <div className="pt-3 border-t">
                  {!canReserve && (
                    <p className="text-xs text-muted-foreground mb-3 text-center">
                      {!hasTimeSlots
                        ? "時間帯が設定されていません"
                        : !selectedTimeSlotId
                        ? "② 時間帯を選択してください"
                        : !selectedSeatId
                        ? "③ 座席を選択してください"
                        : ""}
                    </p>
                  )}

                  {isConfirming ? (
                    <div className="space-y-3">
                      <div className="bg-primary/8 rounded-xl px-4 py-3 text-center">
                        <p className="text-sm font-semibold text-primary">
                          この内容で予約しますか？
                        </p>
                      </div>
                      <div className="flex gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          className="flex-1"
                          onClick={() => setIsConfirming(false)}
                          disabled={reservationMutation.isPending}
                        >
                          戻る
                        </Button>
                        <Button
                          size="sm"
                          className="flex-1 btn-glow"
                          onClick={() => reservationMutation.mutate()}
                          disabled={reservationMutation.isPending}
                        >
                          {reservationMutation.isPending ? (
                            <span className="flex items-center gap-1.5">
                              <span className="w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin" />
                              処理中...
                            </span>
                          ) : (
                            "確定する"
                          )}
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <Button
                      className={`w-full transition-all duration-300 ${
                        canReserve
                          ? "btn-glow"
                          : "bg-muted text-muted-foreground cursor-not-allowed"
                      }`}
                      disabled={!canReserve}
                      onClick={() => setIsConfirming(true)}
                    >
                      予約する
                    </Button>
                  )}
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </main>
    </div>
  );
}
