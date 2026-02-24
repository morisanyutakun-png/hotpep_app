"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/lib/auth";
import { useApiFetch } from "@/hooks/use-api";
import { Header } from "@/components/header";
import { SpaceMiniMap } from "@/components/space-mini-map";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import Link from "next/link";

interface SpaceSummary {
  id: string;
  name: string;
  description: string | null;
  is_active: boolean;
  grid_rows: number;
  grid_cols: number;
  seat_count: number;
  time_slot_count: number;
  layout_json: any | null;
}

interface TimeSlot {
  id: string;
  label: string;
  start_time: string;
  end_time: string;
  display_order: number;
  is_active: boolean;
}

// プリセットテンプレート
const TIME_PRESETS = [
  {
    name: "2時間区切り（9時〜21時）",
    icon: "🏢",
    slots: [
      { start: "09:00", end: "11:00" },
      { start: "11:00", end: "13:00" },
      { start: "13:00", end: "15:00" },
      { start: "15:00", end: "17:00" },
      { start: "17:00", end: "19:00" },
      { start: "19:00", end: "21:00" },
    ],
  },
  {
    name: "1時間区切り（9時〜18時）",
    icon: "⏰",
    slots: [
      { start: "09:00", end: "10:00" },
      { start: "10:00", end: "11:00" },
      { start: "11:00", end: "12:00" },
      { start: "12:00", end: "13:00" },
      { start: "13:00", end: "14:00" },
      { start: "14:00", end: "15:00" },
      { start: "15:00", end: "16:00" },
      { start: "16:00", end: "17:00" },
      { start: "17:00", end: "18:00" },
    ],
  },
  {
    name: "午前・午後・夜（3区分）",
    icon: "🌅",
    slots: [
      { start: "09:00", end: "12:00" },
      { start: "13:00", end: "17:00" },
      { start: "18:00", end: "21:00" },
    ],
  },
  {
    name: "塾向け（16時〜22時）",
    icon: "📚",
    slots: [
      { start: "16:00", end: "18:00" },
      { start: "18:00", end: "20:00" },
      { start: "20:00", end: "22:00" },
    ],
  },
];

export default function AdminSpacesPage() {
  const router = useRouter();
  const { user, role, tenantId, isLoading: authLoading } = useAuth();
  const apiFetch = useApiFetch();
  const queryClient = useQueryClient();

  // Dialog states
  const [createOpen, setCreateOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [timeSlotsOpen, setTimeSlotsOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [selectedSpace, setSelectedSpace] = useState<SpaceSummary | null>(null);

  // Create form
  const [newName, setNewName] = useState("");
  const [newDesc, setNewDesc] = useState("");
  const [newRows, setNewRows] = useState(8);
  const [newCols, setNewCols] = useState(10);

  // Settings form
  const [editName, setEditName] = useState("");
  const [editDesc, setEditDesc] = useState("");

  // Time slot form
  const [slotLabel, setSlotLabel] = useState("");
  const [slotStart, setSlotStart] = useState("");
  const [slotEnd, setSlotEnd] = useState("");
  const [isApplyingPreset, setIsApplyingPreset] = useState(false);

  useEffect(() => {
    if (!authLoading) {
      if (!user) router.push("/login");
      else if (role !== "admin") router.push("/");
    }
  }, [authLoading, user, role, router]);

  // Spaces list
  const { data: spaces, isLoading } = useQuery({
    queryKey: ["adminSpacesSummary", tenantId],
    queryFn: () => apiFetch<SpaceSummary[]>(`/tenants/${tenantId}/spaces/summary`),
    enabled: !!user && !!tenantId && role === "admin",
  });

  // Time slots for selected space (enabled for both settings and timeslots dialogs)
  const { data: timeSlots, isLoading: slotsLoading } = useQuery({
    queryKey: ["timeSlots", selectedSpace?.id],
    queryFn: () => apiFetch<TimeSlot[]>(`/spaces/${selectedSpace!.id}/time-slots`),
    enabled: !!selectedSpace && (settingsOpen || timeSlotsOpen),
  });

  // Create space
  const createMutation = useMutation({
    mutationFn: () =>
      apiFetch<{ id: string }>(`/tenants/${tenantId}/spaces`, {
        method: "POST",
        body: JSON.stringify({
          name: newName,
          description: newDesc || null,
          grid_rows: newRows,
          grid_cols: newCols,
        }),
      }),
    onSuccess: (data) => {
      toast.success("スペースを作成しました");
      setCreateOpen(false);
      setNewName("");
      setNewDesc("");
      setNewRows(8);
      setNewCols(10);
      queryClient.invalidateQueries({ queryKey: ["adminSpacesSummary"] });
      router.push(`/admin/spaces/${data.id}/layout`);
    },
    onError: (err: Error) => {
      toast.error("作成に失敗しました", { description: err.message });
    },
  });

  // Update space
  const updateMutation = useMutation({
    mutationFn: () =>
      apiFetch(`/spaces/${selectedSpace!.id}`, {
        method: "PUT",
        body: JSON.stringify({ name: editName, description: editDesc || null }),
      }),
    onSuccess: () => {
      toast.success("スペース情報を更新しました");
      queryClient.invalidateQueries({ queryKey: ["adminSpacesSummary"] });
    },
    onError: (err: Error) => {
      toast.error("更新に失敗しました", { description: err.message });
    },
  });

  // Delete space
  const deleteMutation = useMutation({
    mutationFn: () =>
      apiFetch(`/spaces/${selectedSpace!.id}`, { method: "DELETE" }),
    onSuccess: () => {
      toast.success("スペースを削除しました");
      setDeleteOpen(false);
      setSelectedSpace(null);
      queryClient.invalidateQueries({ queryKey: ["adminSpacesSummary"] });
    },
    onError: (err: Error) => {
      toast.error("削除に失敗しました", { description: err.message });
    },
  });

  // Create time slot
  const createSlotMutation = useMutation({
    mutationFn: (params: { label: string; start_time: string; end_time: string; display_order: number }) =>
      apiFetch(`/spaces/${selectedSpace!.id}/time-slots`, {
        method: "POST",
        body: JSON.stringify(params),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["timeSlots", selectedSpace?.id] });
      queryClient.invalidateQueries({ queryKey: ["adminSpacesSummary"] });
    },
    onError: (err: Error) => {
      toast.error("追加に失敗しました", { description: err.message });
    },
  });

  // Delete time slot
  const deleteSlotMutation = useMutation({
    mutationFn: (slotId: string) =>
      apiFetch(`/spaces/${selectedSpace!.id}/time-slots/${slotId}`, {
        method: "DELETE",
      }),
    onSuccess: () => {
      toast.success("タイムスロットを削除しました");
      queryClient.invalidateQueries({ queryKey: ["timeSlots", selectedSpace?.id] });
      queryClient.invalidateQueries({ queryKey: ["adminSpacesSummary"] });
    },
    onError: (err: Error) => {
      toast.error("削除に失敗しました", { description: err.message });
    },
  });

  // 個別スロット追加
  const handleAddSlot = () => {
    const existingSlots = timeSlots || [];
    const label = slotLabel || `${slotStart}-${slotEnd}`;
    createSlotMutation.mutate(
      {
        label,
        start_time: slotStart,
        end_time: slotEnd,
        display_order: existingSlots.length,
      },
      {
        onSuccess: () => {
          toast.success(`${label} を追加しました`);
          setSlotLabel("");
          setSlotStart("");
          setSlotEnd("");
        },
      }
    );
  };

  // プリセット一括適用
  const applyPreset = useCallback(
    async (preset: (typeof TIME_PRESETS)[0]) => {
      if (!selectedSpace) return;
      setIsApplyingPreset(true);
      try {
        for (let i = 0; i < preset.slots.length; i++) {
          const s = preset.slots[i];
          await apiFetch(`/spaces/${selectedSpace.id}/time-slots`, {
            method: "POST",
            body: JSON.stringify({
              label: `${s.start}-${s.end}`,
              start_time: s.start,
              end_time: s.end,
              display_order: i,
            }),
          });
        }
        toast.success(`「${preset.name}」を適用しました（${preset.slots.length}枠）`);
        queryClient.invalidateQueries({ queryKey: ["timeSlots", selectedSpace.id] });
        queryClient.invalidateQueries({ queryKey: ["adminSpacesSummary"] });
      } catch (err: any) {
        toast.error("プリセット適用に失敗しました", { description: err.message });
      } finally {
        setIsApplyingPreset(false);
      }
    },
    [selectedSpace, apiFetch, queryClient]
  );

  // 全スロット削除
  const deleteAllSlots = useCallback(async () => {
    if (!selectedSpace || !timeSlots) return;
    try {
      for (const slot of timeSlots) {
        await apiFetch(`/spaces/${selectedSpace.id}/time-slots/${slot.id}`, {
          method: "DELETE",
        });
      }
      toast.success("すべてのタイムスロットを削除しました");
      queryClient.invalidateQueries({ queryKey: ["timeSlots", selectedSpace.id] });
      queryClient.invalidateQueries({ queryKey: ["adminSpacesSummary"] });
    } catch (err: any) {
      toast.error("削除に失敗しました", { description: err.message });
    }
  }, [selectedSpace, timeSlots, apiFetch, queryClient]);

  const openSettings = (space: SpaceSummary) => {
    setSelectedSpace(space);
    setEditName(space.name);
    setEditDesc(space.description || "");
    setSettingsOpen(true);
  };

  const openTimeSlots = (space: SpaceSummary) => {
    setSelectedSpace(space);
    setSlotLabel("");
    setSlotStart("");
    setSlotEnd("");
    setTimeSlotsOpen(true);
  };

  const openDelete = (space: SpaceSummary) => {
    setSelectedSpace(space);
    setDeleteOpen(true);
  };

  // 時間のフォーマット (HH:MM:SS → HH:MM)
  const fmtTime = (t: string) => t?.slice(0, 5) || t;

  if (authLoading || !user) return null;

  return (
    <div className="min-h-screen bg-gradient-to-br from-orange-50/50 to-amber-50/50">
      <Header />
      <main className="max-w-7xl mx-auto px-4 py-8">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">スペース管理</h1>
            <p className="text-muted-foreground mt-1">
              スペースの作成・設定・座席レイアウト編集
            </p>
          </div>
          <Button
            className="bg-orange-500 hover:bg-orange-600 shadow-sm"
            onClick={() => setCreateOpen(true)}
          >
            + 新規スペース作成
          </Button>
        </div>

        {/* Space list */}
        {isLoading ? (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {[1, 2, 3].map((i) => (
              <Card key={i} className="animate-pulse">
                <CardContent className="p-6">
                  <div className="h-4 bg-gray-200 rounded w-2/3 mb-4" />
                  <div className="aspect-[4/3] bg-gray-100 rounded mb-4" />
                  <div className="h-3 bg-gray-200 rounded w-1/2" />
                </CardContent>
              </Card>
            ))}
          </div>
        ) : spaces && spaces.length > 0 ? (
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {spaces.map((space) => (
              <Card
                key={space.id}
                className="hover:shadow-lg transition-all duration-200 group"
              >
                <CardHeader className="pb-3">
                  <div className="flex items-start justify-between">
                    <CardTitle className="text-lg">{space.name}</CardTitle>
                    <div className="flex gap-1.5">
                      <Badge variant="secondary" className="text-xs">
                        {space.seat_count} 席
                      </Badge>
                      <Badge
                        variant="outline"
                        className={`text-xs ${
                          space.time_slot_count === 0
                            ? "border-red-300 text-red-600 bg-red-50"
                            : ""
                        }`}
                      >
                        {space.time_slot_count} 枠
                      </Badge>
                    </div>
                  </div>
                  <p className="text-sm text-muted-foreground line-clamp-2">
                    {space.description || "説明なし"}
                  </p>
                </CardHeader>
                <CardContent className="space-y-4">
                  {/* 時間帯未設定の警告 */}
                  {space.time_slot_count === 0 && (
                    <button
                      onClick={() => openTimeSlots(space)}
                      className="w-full flex items-center gap-2 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 text-left hover:bg-amber-100 transition-colors"
                    >
                      <span className="text-lg">⚠️</span>
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-medium text-amber-800">
                          時間帯が未設定です
                        </p>
                        <p className="text-[11px] text-amber-600">
                          タップして時間帯を設定 →
                        </p>
                      </div>
                    </button>
                  )}

                  {/* Mini map */}
                  <Link href={`/admin/spaces/${space.id}/layout`} className="block">
                    <SpaceMiniMap
                      layoutJson={space.layout_json}
                      gridRows={space.grid_rows}
                      gridCols={space.grid_cols}
                    />
                  </Link>

                  {/* Actions */}
                  <div className="grid grid-cols-2 gap-2">
                    <Link href={`/admin/spaces/${space.id}/layout`} className="contents">
                      <Button
                        size="sm"
                        className="bg-orange-500 hover:bg-orange-600 text-xs"
                      >
                        🪑 レイアウト
                      </Button>
                    </Link>
                    <Button
                      size="sm"
                      variant="outline"
                      className={`text-xs ${
                        space.time_slot_count === 0
                          ? "border-amber-400 text-amber-700 bg-amber-50 hover:bg-amber-100 hover:text-amber-800 font-semibold animate-pulse"
                          : ""
                      }`}
                      onClick={() => openTimeSlots(space)}
                    >
                      🕐 時間帯 {space.time_slot_count > 0 && `(${space.time_slot_count})`}
                    </Button>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <Button
                      size="sm"
                      variant="outline"
                      className="text-xs"
                      onClick={() => openSettings(space)}
                    >
                      ⚙️ 基本設定
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      className="text-xs text-red-600 hover:bg-red-50 hover:text-red-700 border-red-200"
                      onClick={() => openDelete(space)}
                    >
                      🗑 削除
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        ) : (
          /* Empty state */
          <Card className="py-16">
            <CardContent className="text-center">
              <div className="text-6xl mb-4">🏢</div>
              <h2 className="text-xl font-semibold text-gray-700 mb-2">
                スペースがまだありません
              </h2>
              <p className="text-muted-foreground mb-6">
                最初のスペースを作成して、座席レイアウトを設定しましょう
              </p>
              <Button
                className="bg-orange-500 hover:bg-orange-600"
                onClick={() => setCreateOpen(true)}
              >
                + 新規スペース作成
              </Button>
            </CardContent>
          </Card>
        )}
      </main>

      {/* Create Dialog */}
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>新規スペース作成</DialogTitle>
            <DialogDescription>
              スペースの基本情報を入力してください。作成後にレイアウト編集画面へ進みます。
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>スペース名 *</Label>
              <Input
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                placeholder="例: 3Fコワーキングエリア"
                className="mt-1"
              />
            </div>
            <div>
              <Label>説明</Label>
              <Input
                value={newDesc}
                onChange={(e) => setNewDesc(e.target.value)}
                placeholder="例: 静かな作業スペース、Wi-Fi完備"
                className="mt-1"
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>グリッド行数</Label>
                <Input
                  type="number"
                  min={1}
                  max={20}
                  value={newRows}
                  onChange={(e) => setNewRows(Number(e.target.value))}
                  className="mt-1"
                />
              </div>
              <div>
                <Label>グリッド列数</Label>
                <Input
                  type="number"
                  min={1}
                  max={20}
                  value={newCols}
                  onChange={(e) => setNewCols(Number(e.target.value))}
                  className="mt-1"
                />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateOpen(false)}>
              キャンセル
            </Button>
            <Button
              className="bg-orange-500 hover:bg-orange-600"
              onClick={() => createMutation.mutate()}
              disabled={!newName.trim() || createMutation.isPending}
            >
              {createMutation.isPending ? "作成中..." : "作成してレイアウト編集へ"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ===== Time Slots Dialog (専用ダイアログ) ===== */}
      <Dialog open={timeSlotsOpen} onOpenChange={setTimeSlotsOpen}>
        <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              🕐 時間帯の設定
              {selectedSpace && (
                <Badge variant="secondary" className="font-normal ml-1">
                  {selectedSpace.name}
                </Badge>
              )}
            </DialogTitle>
            <DialogDescription>
              予約時に選べる時間帯を設定します。プリセットから一括設定するか、手動で追加できます。
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-6">
            {/* 現在の時間帯一覧 */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="font-medium text-sm text-gray-700 flex items-center gap-1.5">
                  📋 現在の時間帯
                  {timeSlots && (
                    <Badge variant="outline" className="text-[11px] font-normal">
                      {timeSlots.length}枠
                    </Badge>
                  )}
                </h3>
                {timeSlots && timeSlots.length > 0 && (
                  <Button
                    size="sm"
                    variant="ghost"
                    className="text-xs text-red-500 hover:text-red-700 hover:bg-red-50 h-7"
                    onClick={deleteAllSlots}
                  >
                    すべて削除
                  </Button>
                )}
              </div>

              {slotsLoading ? (
                <div className="flex items-center gap-2 py-6 justify-center text-sm text-muted-foreground">
                  <div className="w-4 h-4 border-2 border-orange-400 border-t-transparent rounded-full animate-spin" />
                  読み込み中...
                </div>
              ) : timeSlots && timeSlots.length > 0 ? (
                <div className="space-y-1.5">
                  {timeSlots.map((slot, idx) => (
                    <div
                      key={slot.id}
                      className="flex items-center gap-3 bg-gray-50 hover:bg-gray-100 rounded-lg px-3 py-2.5 transition-colors group"
                    >
                      <span className="w-5 h-5 rounded-full bg-orange-100 text-orange-600 text-[11px] font-bold flex items-center justify-center flex-shrink-0">
                        {idx + 1}
                      </span>
                      <div className="flex-1 min-w-0">
                        <span className="font-medium text-sm">{slot.label}</span>
                      </div>
                      <div className="text-xs text-muted-foreground">
                        {fmtTime(slot.start_time)} → {fmtTime(slot.end_time)}
                      </div>
                      <Button
                        size="sm"
                        variant="ghost"
                        className="text-red-400 hover:text-red-600 hover:bg-red-50 h-7 w-7 p-0 opacity-0 group-hover:opacity-100 transition-opacity"
                        onClick={() => deleteSlotMutation.mutate(slot.id)}
                        disabled={deleteSlotMutation.isPending}
                      >
                        ✕
                      </Button>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-6 bg-gray-50 rounded-lg border-2 border-dashed border-gray-200">
                  <div className="text-3xl mb-2">📭</div>
                  <p className="text-sm text-muted-foreground">
                    時間帯がまだ設定されていません
                  </p>
                  <p className="text-xs text-muted-foreground mt-1">
                    下のプリセットから選ぶか、手動で追加してください
                  </p>
                </div>
              )}
            </div>

            {/* タイムラインのビジュアルプレビュー */}
            {timeSlots && timeSlots.length > 0 && (
              <div className="space-y-2">
                <h3 className="font-medium text-sm text-gray-700">⏱ タイムライン</h3>
                <div className="bg-gray-50 rounded-lg p-3">
                  <div className="flex gap-1 items-stretch h-10">
                    {timeSlots.map((slot, idx) => {
                      const colors = [
                        "bg-orange-200 border-orange-300 text-orange-800",
                        "bg-blue-200 border-blue-300 text-blue-800",
                        "bg-green-200 border-green-300 text-green-800",
                        "bg-purple-200 border-purple-300 text-purple-800",
                        "bg-pink-200 border-pink-300 text-pink-800",
                        "bg-cyan-200 border-cyan-300 text-cyan-800",
                        "bg-amber-200 border-amber-300 text-amber-800",
                        "bg-indigo-200 border-indigo-300 text-indigo-800",
                        "bg-teal-200 border-teal-300 text-teal-800",
                      ];
                      return (
                        <div
                          key={slot.id}
                          className={`flex-1 rounded-md border flex items-center justify-center text-[10px] sm:text-xs font-medium px-1 truncate ${colors[idx % colors.length]}`}
                          title={`${slot.label} (${fmtTime(slot.start_time)}〜${fmtTime(slot.end_time)})`}
                        >
                          {fmtTime(slot.start_time)}–{fmtTime(slot.end_time)}
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            )}

            {/* プリセットから一括設定 */}
            <div className="space-y-3 border-t pt-4">
              <h3 className="font-medium text-sm text-gray-700 flex items-center gap-1.5">
                ⚡ プリセットから一括設定
              </h3>
              <p className="text-xs text-muted-foreground -mt-1">
                よくあるパターンからワンクリックで設定できます
                {timeSlots && timeSlots.length > 0 && (
                  <span className="text-amber-600 font-medium">
                    （既存の時間帯に追加されます）
                  </span>
                )}
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {TIME_PRESETS.map((preset) => (
                  <button
                    key={preset.name}
                    onClick={() => applyPreset(preset)}
                    disabled={isApplyingPreset}
                    className="flex items-start gap-3 bg-white border border-gray-200 rounded-lg px-3 py-3 text-left hover:border-orange-300 hover:bg-orange-50 transition-all disabled:opacity-50"
                  >
                    <span className="text-xl mt-0.5">{preset.icon}</span>
                    <div>
                      <p className="text-sm font-medium text-gray-800">{preset.name}</p>
                      <p className="text-[11px] text-muted-foreground mt-0.5">
                        {preset.slots.map((s) => `${s.start}-${s.end}`).join("、")}
                      </p>
                    </div>
                  </button>
                ))}
              </div>
              {isApplyingPreset && (
                <div className="flex items-center gap-2 justify-center text-sm text-orange-600 py-1">
                  <div className="w-4 h-4 border-2 border-orange-400 border-t-transparent rounded-full animate-spin" />
                  適用中...
                </div>
              )}
            </div>

            {/* 手動追加 */}
            <div className="space-y-3 border-t pt-4">
              <h3 className="font-medium text-sm text-gray-700 flex items-center gap-1.5">
                ✏️ 手動で追加
              </h3>
              <div className="bg-gray-50 rounded-lg p-4 space-y-3">
                <div className="grid grid-cols-5 gap-2 items-end">
                  <div className="col-span-2">
                    <Label className="text-xs text-gray-600">開始時刻</Label>
                    <Input
                      type="time"
                      value={slotStart}
                      onChange={(e) => setSlotStart(e.target.value)}
                      className="mt-1 h-9"
                    />
                  </div>
                  <div className="col-span-2">
                    <Label className="text-xs text-gray-600">終了時刻</Label>
                    <Input
                      type="time"
                      value={slotEnd}
                      onChange={(e) => setSlotEnd(e.target.value)}
                      className="mt-1 h-9"
                    />
                  </div>
                  <Button
                    size="sm"
                    className="bg-orange-500 hover:bg-orange-600 h-9"
                    onClick={handleAddSlot}
                    disabled={!slotStart || !slotEnd || createSlotMutation.isPending}
                  >
                    {createSlotMutation.isPending ? "..." : "追加"}
                  </Button>
                </div>
                <div>
                  <Label className="text-xs text-gray-600">ラベル（任意 — 空欄で「開始-終了」が自動設定）</Label>
                  <Input
                    value={slotLabel}
                    onChange={(e) => setSlotLabel(e.target.value)}
                    placeholder="例: 午前の部、1限目"
                    className="mt-1 h-9"
                  />
                </div>
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Settings Dialog (基本情報のみ、シンプルに) */}
      <Dialog open={settingsOpen} onOpenChange={setSettingsOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              ⚙️ 基本設定
              {selectedSpace && (
                <Badge variant="secondary" className="font-normal ml-1">
                  {selectedSpace.name}
                </Badge>
              )}
            </DialogTitle>
            <DialogDescription>
              スペースの名前と説明を変更できます
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label className="text-sm">スペース名</Label>
              <Input
                value={editName}
                onChange={(e) => setEditName(e.target.value)}
                className="mt-1"
              />
            </div>
            <div>
              <Label className="text-sm">説明</Label>
              <Input
                value={editDesc}
                onChange={(e) => setEditDesc(e.target.value)}
                placeholder="スペースの説明を入力"
                className="mt-1"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setSettingsOpen(false)}>
              キャンセル
            </Button>
            <Button
              className="bg-orange-500 hover:bg-orange-600"
              onClick={() => {
                updateMutation.mutate(undefined, {
                  onSuccess: () => setSettingsOpen(false),
                });
              }}
              disabled={!editName.trim() || updateMutation.isPending}
            >
              {updateMutation.isPending ? "保存中..." : "保存する"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>スペースの削除</DialogTitle>
            <DialogDescription>
              「{selectedSpace?.name}」を削除しますか？この操作は元に戻せません。
              関連する座席レイアウトや予約データも無効になります。
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteOpen(false)}>
              キャンセル
            </Button>
            <Button
              variant="destructive"
              onClick={() => deleteMutation.mutate()}
              disabled={deleteMutation.isPending}
            >
              {deleteMutation.isPending ? "削除中..." : "削除する"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
