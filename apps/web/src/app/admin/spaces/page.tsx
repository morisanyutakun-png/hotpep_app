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
import { Building2, Clock, Sunrise, BookOpen, AlertTriangle, LayoutGrid, Settings, Trash2, Inbox, Timer, Zap, PenLine, ClipboardList, X } from "lucide-react";
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
    icon: <Building2 className="w-5 h-5" />,
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
    icon: <Clock className="w-5 h-5" />,
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
    icon: <Sunrise className="w-5 h-5" />,
    slots: [
      { start: "09:00", end: "12:00" },
      { start: "13:00", end: "17:00" },
      { start: "18:00", end: "21:00" },
    ],
  },
  {
    name: "塾向け（16時〜22時）",
    icon: <BookOpen className="w-5 h-5" />,
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
    <div className="min-h-screen bg-warm-gradient">
      <Header />
      <main className="max-w-7xl mx-auto px-6 py-10">
        {/* Header */}
        <div className="flex items-center justify-between mb-10 animate-fade-in-up">
          <div>
            <h1 className="text-3xl font-bold tracking-tight text-foreground">スペース管理</h1>
            <p className="text-muted-foreground mt-2 text-base">
              スペースの作成・設定・座席レイアウト編集
            </p>
          </div>
          <Button
            className="btn-glow"
            onClick={() => setCreateOpen(true)}
          >
            + 新規スペース作成
          </Button>
        </div>

        {/* Space list */}
        {isLoading ? (
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3 stagger-children">
            {[1, 2, 3].map((i) => (
              <Card key={i} className="animate-pulse border-border/40">
                <CardContent className="p-6">
                  <div className="h-4 bg-muted rounded-lg w-2/3 mb-4" />
                  <div className="aspect-[4/3] bg-muted/60 rounded-xl mb-4" />
                  <div className="h-3 bg-muted/40 rounded-lg w-1/2" />
                </CardContent>
              </Card>
            ))}
          </div>
        ) : spaces && spaces.length > 0 ? (
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3 stagger-children">
            {spaces.map((space) => (
              <Card
                key={space.id}
                className="hover:shadow-premium-hover hover:-translate-y-0.5 transition-all duration-300 group border-border/40"
              >
                <CardHeader className="pb-3">
                  <div className="flex items-start justify-between">
                    <CardTitle className="text-lg">{space.name}</CardTitle>
                    <div className="flex gap-1.5">
                      <Badge variant="secondary" className="text-xs font-medium">
                        {space.seat_count} 席
                      </Badge>
                      <Badge
                        variant="outline"
                        className={`text-xs font-medium ${
                          space.time_slot_count === 0
                            ? "border-destructive/30 text-destructive bg-destructive/5"
                            : ""
                        }`}
                      >
                        {space.time_slot_count} 枠
                      </Badge>
                    </div>
                  </div>
                  <p className="text-sm text-muted-foreground line-clamp-2 leading-relaxed">
                    {space.description || "説明なし"}
                  </p>
                </CardHeader>
                <CardContent className="space-y-4">
                  {/* 時間帯未設定の警告 */}
                  {space.time_slot_count === 0 && (
                    <button
                      onClick={() => openTimeSlots(space)}
                      className="w-full flex items-center gap-2.5 bg-accent/60 border border-border/40 rounded-xl px-4 py-3 text-left hover:bg-accent transition-all duration-200"
                    >
                      <AlertTriangle className="w-5 h-5 text-amber-500" />
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-semibold text-foreground/70">
                          時間帯が未設定です
                        </p>
                        <p className="text-[11px] text-muted-foreground">
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
                  <div className="grid grid-cols-2 gap-2.5">
                    <Link href={`/admin/spaces/${space.id}/layout`} className="contents">
                      <Button
                        size="sm"
                        className="btn-glow text-xs"
                      >
                        <LayoutGrid className="w-3.5 h-3.5 inline-block mr-1 -mt-0.5" /> レイアウト
                      </Button>
                    </Link>
                    <Button
                      size="sm"
                      variant="outline"
                      className={`text-xs ${
                        space.time_slot_count === 0
                          ? "border-primary/40 text-primary bg-primary/5 hover:bg-primary/10 font-semibold animate-pulse"
                          : ""
                      }`}
                      onClick={() => openTimeSlots(space)}
                    >
                      <Clock className="w-3.5 h-3.5 inline-block mr-1 -mt-0.5" /> 時間帯 {space.time_slot_count > 0 && `(${space.time_slot_count})`}
                    </Button>
                  </div>
                  <div className="grid grid-cols-2 gap-2.5">
                    <Button
                      size="sm"
                      variant="outline"
                      className="text-xs"
                      onClick={() => openSettings(space)}
                    >
                      <Settings className="w-3.5 h-3.5 inline-block mr-1 -mt-0.5" /> 基本設定
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      className="text-xs text-destructive hover:bg-destructive/5 hover:text-destructive border-destructive/20"
                      onClick={() => openDelete(space)}
                    >
                      <Trash2 className="w-3.5 h-3.5 inline-block mr-1 -mt-0.5" /> 削除
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        ) : (
          /* Empty state */
          <Card className="py-20 border-border/40">
            <CardContent className="text-center">
              <Building2 className="w-14 h-14 text-muted-foreground/25 mx-auto mb-5" />
              <h2 className="text-xl font-semibold tracking-tight text-foreground mb-2">
                スペースがまだありません
              </h2>
              <p className="text-muted-foreground mb-8 text-base">
                最初のスペースを作成して、座席レイアウトを設定しましょう
              </p>
              <Button
                className="btn-glow"
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
              className="btn-glow"
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
              <Clock className="w-5 h-5 opacity-60" /> 時間帯の設定
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
                  <ClipboardList className="w-4 h-4 opacity-50" /> 現在の時間帯
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
                  <div className="w-4 h-4 border-2 border-primary border-t-transparent rounded-full animate-spin" />
                  読み込み中...
                </div>
              ) : timeSlots && timeSlots.length > 0 ? (
                <div className="space-y-1.5">
                  {timeSlots.map((slot, idx) => (
                    <div
                      key={slot.id}
                      className="flex items-center gap-3 bg-secondary/40 hover:bg-secondary/60 rounded-xl px-3 py-2.5 transition-colors group"
                    >
                      <span className="w-5 h-5 rounded-full bg-primary/10 text-primary text-[11px] font-bold flex items-center justify-center flex-shrink-0">
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
                        <X className="w-3.5 h-3.5" />
                      </Button>
                    </div>
                  ))}
                </div>
              ) : (
                  <div className="text-center py-6 bg-secondary/40 rounded-xl border-2 border-dashed border-border/60">
                  <Inbox className="w-8 h-8 text-muted-foreground/30 mx-auto mb-2" />
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
                <h3 className="font-medium text-sm text-foreground/80"><Timer className="w-4 h-4 inline-block mr-1.5 -mt-0.5 opacity-50" />タイムライン</h3>
                <div className="bg-secondary/30 rounded-xl p-3">
                  <div className="flex gap-1 items-stretch h-10">
                    {timeSlots.map((slot, idx) => {
                      const colors = [
                        "bg-primary/20 border-primary/30 text-primary",
                        "bg-blue-100/80 border-blue-200 text-blue-800",
                        "bg-green-100/80 border-green-200 text-green-800",
                        "bg-violet-100/80 border-violet-200 text-violet-800",
                        "bg-pink-100/80 border-pink-200 text-pink-800",
                        "bg-cyan-100/80 border-cyan-200 text-cyan-800",
                        "bg-amber-100/80 border-amber-200 text-amber-800",
                        "bg-indigo-100/80 border-indigo-200 text-indigo-800",
                        "bg-teal-100/80 border-teal-200 text-teal-800",
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
              <h3 className="font-medium text-sm text-foreground/80 flex items-center gap-1.5">
                <Zap className="w-4 h-4 opacity-50" /> プリセットから一括設定
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
                    className="flex items-start gap-3 bg-card border border-border/40 rounded-xl px-3 py-3 text-left hover:border-primary/40 hover:bg-primary/5 transition-all disabled:opacity-50"
                  >
                    <span className="text-xl mt-0.5 text-foreground/40">{preset.icon}</span>
                    <div>
                      <p className="text-sm font-medium text-foreground">{preset.name}</p>
                      <p className="text-[11px] text-muted-foreground mt-0.5">
                        {preset.slots.map((s) => `${s.start}-${s.end}`).join("、")}
                      </p>
                    </div>
                  </button>
                ))}
              </div>
              {isApplyingPreset && (
                  <div className="flex items-center gap-2 justify-center text-sm text-primary py-1">
                  <div className="w-4 h-4 border-2 border-primary border-t-transparent rounded-full animate-spin" />
                  適用中...
                </div>
              )}
            </div>

            {/* 手動追加 */}
            <div className="space-y-3 border-t pt-4">
              <h3 className="font-medium text-sm text-foreground/80 flex items-center gap-1.5">
                <PenLine className="w-4 h-4 opacity-50" /> 手動で追加
              </h3>
              <div className="bg-secondary/30 rounded-xl p-4 space-y-3">
                <div className="grid grid-cols-5 gap-2 items-end">
                  <div className="col-span-2">
                    <Label className="text-xs text-foreground/60">開始時刻</Label>
                    <Input
                      type="time"
                      value={slotStart}
                      onChange={(e) => setSlotStart(e.target.value)}
                      className="mt-1 h-9"
                    />
                  </div>
                  <div className="col-span-2">
                    <Label className="text-xs text-foreground/60">終了時刻</Label>
                    <Input
                      type="time"
                      value={slotEnd}
                      onChange={(e) => setSlotEnd(e.target.value)}
                      className="mt-1 h-9"
                    />
                  </div>
                  <Button
                    size="sm"
                    className="btn-glow h-9"
                    onClick={handleAddSlot}
                    disabled={!slotStart || !slotEnd || createSlotMutation.isPending}
                  >
                    {createSlotMutation.isPending ? "..." : "追加"}
                  </Button>
                </div>
                <div>
                  <Label className="text-xs text-foreground/60">ラベル（任意 — 空欄で「開始-終了」が自動設定）</Label>
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
              <Settings className="w-5 h-5 opacity-60" /> 基本設定
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
              className="btn-glow"
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
