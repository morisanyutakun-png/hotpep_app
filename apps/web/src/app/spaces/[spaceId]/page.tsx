"use client";

import { useEffect, useState } from "react";
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

export default function SpaceReservationPage() {
  const params = useParams();
  const router = useRouter();
  const spaceId = params.spaceId as string;
  const { user, isLoading: authLoading } = useAuth();
  const apiFetch = useApiFetch();
  const queryClient = useQueryClient();

  // 日付候補（今日から7日間）
  const dateOptions = Array.from({ length: 7 }, (_, i) => {
    const d = addDays(new Date(), i);
    return {
      value: format(d, "yyyy-MM-dd"),
      label: format(d, "M/d (EEE)", { locale: ja }),
      isToday: i === 0,
    };
  });

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
  const { data: timeSlots } = useQuery({
    queryKey: ["timeSlots", spaceId],
    queryFn: () => apiFetch<TimeSlot[]>(`/spaces/${spaceId}/time-slots`),
    enabled: !!user,
  });

  // 空き状況
  const { data: availability, isLoading: availLoading } = useQuery({
    queryKey: ["availability", spaceId, selectedDate, selectedTimeSlotId],
    queryFn: () =>
      apiFetch<AvailabilityData>(
        `/spaces/${spaceId}/availability?date=${selectedDate}&time_slot_id=${selectedTimeSlotId}`
      ),
    enabled: !!user && !!selectedTimeSlotId,
  });

  // 自動選択: 最初の時間帯
  useEffect(() => {
    if (timeSlots && timeSlots.length > 0 && !selectedTimeSlotId) {
      setSelectedTimeSlotId(timeSlots[0].id);
    }
  }, [timeSlots, selectedTimeSlotId]);

  // 日付・時間帯変更時に座席選択をリセット
  useEffect(() => {
    setSelectedSeatId(null);
    setSelectedSeatLabel(null);
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
        description: `${selectedSeatLabel} 席を予約しました`,
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
  const canReserve = selectedDate && selectedTimeSlotId && selectedSeatId;

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

      <main className="max-w-7xl mx-auto px-4 py-6">
        {/* スペース情報 */}
        <div className="mb-6">
          <Button variant="ghost" size="sm" onClick={() => router.push("/")} className="mb-2 -ml-2">
            ← スペース一覧に戻る
          </Button>
          <h1 className="text-2xl font-bold text-gray-900">{space?.name || "読み込み中..."}</h1>
          {space?.description && (
            <p className="text-muted-foreground mt-1">{space.description}</p>
          )}
        </div>

        <div className="grid lg:grid-cols-[1fr_320px] gap-6">
          {/* 左: メインエリア */}
          <div className="space-y-6">
            {/* Step 1: 日付選択 */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center gap-2">
                  <span className="w-6 h-6 rounded-full bg-orange-500 text-white text-xs flex items-center justify-center font-bold">1</span>
                  日付を選択
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex gap-2 overflow-x-auto pb-1">
                  {dateOptions.map((d) => (
                    <button
                      key={d.value}
                      onClick={() => setSelectedDate(d.value)}
                      className={`
                        flex-shrink-0 px-4 py-2 rounded-lg text-sm font-medium transition-all
                        ${selectedDate === d.value
                          ? "bg-orange-500 text-white shadow-sm"
                          : "bg-white border hover:border-orange-300 hover:bg-orange-50"
                        }
                      `}
                    >
                      {d.label}
                      {d.isToday && (
                        <span className="block text-[10px] opacity-80">今日</span>
                      )}
                    </button>
                  ))}
                </div>
              </CardContent>
            </Card>

            {/* Step 2: 時間帯選択 */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center gap-2">
                  <span className="w-6 h-6 rounded-full bg-orange-500 text-white text-xs flex items-center justify-center font-bold">2</span>
                  時間帯を選択
                </CardTitle>
              </CardHeader>
              <CardContent>
                {timeSlots ? (
                  <div className="flex flex-wrap gap-2">
                    {timeSlots.map((slot) => (
                      <button
                        key={slot.id}
                        onClick={() => setSelectedTimeSlotId(slot.id)}
                        className={`
                          px-4 py-2 rounded-lg text-sm font-medium transition-all
                          ${selectedTimeSlotId === slot.id
                            ? "bg-orange-500 text-white shadow-sm"
                            : "bg-white border hover:border-orange-300 hover:bg-orange-50"
                          }
                        `}
                      >
                        {slot.label}
                      </button>
                    ))}
                  </div>
                ) : (
                  <div className="text-muted-foreground text-sm">時間帯を読み込み中...</div>
                )}
              </CardContent>
            </Card>

            {/* Step 3: 座席選択 */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center gap-2">
                  <span className="w-6 h-6 rounded-full bg-orange-500 text-white text-xs flex items-center justify-center font-bold">3</span>
                  座席を選択
                </CardTitle>
              </CardHeader>
              <CardContent>
                {!selectedTimeSlotId ? (
                  <div className="text-center py-8 text-muted-foreground">
                    時間帯を選択すると座席マップが表示されます
                  </div>
                ) : availLoading ? (
                  <div className="text-center py-8 text-muted-foreground animate-pulse">
                    空き状況を確認中...
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
            <Card className="shadow-lg border-orange-200">
              <CardHeader className="pb-3">
                <CardTitle className="text-base">予約内容</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">スペース</span>
                    <span className="font-medium">{space?.name || "-"}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">日付</span>
                    <span className="font-medium">
                      {format(new Date(selectedDate), "M月d日 (EEE)", { locale: ja })}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">時間帯</span>
                    <span className="font-medium">
                      {selectedTimeSlot?.label || "未選択"}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">座席</span>
                    <span className="font-medium">
                      {selectedSeatLabel ? (
                        <Badge className="bg-blue-100 text-blue-700 border-blue-300">
                          {selectedSeatLabel}
                        </Badge>
                      ) : (
                        "未選択"
                      )}
                    </span>
                  </div>
                </div>

                <div className="pt-2 border-t">
                  {!canReserve && (
                    <p className="text-xs text-muted-foreground mb-2 text-center">
                      {!selectedTimeSlotId
                        ? "時間帯を選択してください"
                        : !selectedSeatId
                        ? "座席を選択してください"
                        : ""}
                    </p>
                  )}

                  {isConfirming ? (
                    <div className="space-y-2">
                      <p className="text-sm text-center font-medium text-orange-600">
                        この内容で予約しますか？
                      </p>
                      <div className="flex gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          className="flex-1"
                          onClick={() => setIsConfirming(false)}
                        >
                          戻る
                        </Button>
                        <Button
                          size="sm"
                          className="flex-1 bg-orange-500 hover:bg-orange-600"
                          onClick={() => reservationMutation.mutate()}
                          disabled={reservationMutation.isPending}
                        >
                          {reservationMutation.isPending ? "処理中..." : "確定する"}
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <Button
                      className="w-full bg-orange-500 hover:bg-orange-600"
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
