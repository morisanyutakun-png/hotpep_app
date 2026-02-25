"use client";

import { useEffect, useState, useCallback, useMemo } from "react";
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
import { Building2, Clock, Sunrise, BookOpen, AlertTriangle, LayoutGrid, Settings, Trash2, Inbox, Timer, Zap, PenLine, ClipboardList, X, Check, ChevronRight, ChevronLeft, Plus, Minus, Sparkles, ArrowRight } from "lucide-react";
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

  // ===== Create Wizard State =====
  const [wizardStep, setWizardStep] = useState<1 | 2 | 3>(1);
  const [newName, setNewName] = useState("");
  const [newDesc, setNewDesc] = useState("");
  const [newRows, setNewRows] = useState(8);
  const [newCols, setNewCols] = useState(10);

  // Wizard Step 2: Time slots (local state before API)
  const [wizardSlots, setWizardSlots] = useState<{ start: string; end: string; label: string }[]>([]);
  const [wizardSlotMode, setWizardSlotMode] = useState<"preset" | "custom" | "manual">("preset");
  const [customStart, setCustomStart] = useState("09:00");
  const [customEnd, setCustomEnd] = useState("21:00");
  const [customInterval, setCustomInterval] = useState(120); // minutes
  const [manualStart, setManualStart] = useState("");
  const [manualEnd, setManualEnd] = useState("");
  const [manualLabel, setManualLabel] = useState("");
  const [isCreating, setIsCreating] = useState(false);

  // Settings form
  const [editName, setEditName] = useState("");
  const [editDesc, setEditDesc] = useState("");

  // Time slot form (for existing spaces)
  const [slotLabel, setSlotLabel] = useState("");
  const [slotStart, setSlotStart] = useState("");
  const [slotEnd, setSlotEnd] = useState("");
  const [isApplyingPreset, setIsApplyingPreset] = useState(false);

  // ===== Custom interval generator =====
  const generateCustomSlots = useCallback(() => {
    const slots: { start: string; end: string; label: string }[] = [];
    const [startH, startM] = customStart.split(":").map(Number);
    const [endH, endM] = customEnd.split(":").map(Number);
    const startMin = startH * 60 + startM;
    const endMin = endH * 60 + endM;

    if (startMin >= endMin || customInterval < 15) return;

    for (let t = startMin; t + customInterval <= endMin; t += customInterval) {
      const sh = Math.floor(t / 60).toString().padStart(2, "0");
      const sm = (t % 60).toString().padStart(2, "0");
      const eh = Math.floor((t + customInterval) / 60).toString().padStart(2, "0");
      const em = ((t + customInterval) % 60).toString().padStart(2, "0");
      slots.push({
        start: `${sh}:${sm}`,
        end: `${eh}:${em}`,
        label: `${sh}:${sm}-${eh}:${em}`,
      });
    }
    setWizardSlots(slots);
  }, [customStart, customEnd, customInterval]);

  // Apply preset to wizard
  const applyPresetToWizard = useCallback((preset: (typeof TIME_PRESETS)[0]) => {
    setWizardSlots(preset.slots.map((s) => ({
      start: s.start,
      end: s.end,
      label: `${s.start}-${s.end}`,
    })));
  }, []);

  // Add manual slot to wizard
  const addManualSlot = useCallback(() => {
    if (!manualStart || !manualEnd) return;
    const label = manualLabel || `${manualStart}-${manualEnd}`;
    setWizardSlots((prev) => [...prev, { start: manualStart, end: manualEnd, label }]);
    setManualStart("");
    setManualEnd("");
    setManualLabel("");
  }, [manualStart, manualEnd, manualLabel]);

  // Remove wizard slot
  const removeWizardSlot = useCallback((idx: number) => {
    setWizardSlots((prev) => prev.filter((_, i) => i !== idx));
  }, []);

  // Reset wizard
  const resetWizard = useCallback(() => {
    setWizardStep(1);
    setNewName("");
    setNewDesc("");
    setNewRows(8);
    setNewCols(10);
    setWizardSlots([]);
    setWizardSlotMode("preset");
    setCustomStart("09:00");
    setCustomEnd("21:00");
    setCustomInterval(120);
    setManualStart("");
    setManualEnd("");
    setManualLabel("");
    setIsCreating(false);
  }, []);

  // ===== Create space + time slots =====
  const handleCreateSpace = useCallback(async () => {
    if (!tenantId) return;
    setIsCreating(true);
    try {
      // 1. Create space
      const spaceData = await apiFetch<{ id: string }>(`/tenants/${tenantId}/spaces`, {
        method: "POST",
        body: JSON.stringify({
          name: newName,
          description: newDesc || null,
          grid_rows: newRows,
          grid_cols: newCols,
        }),
      });

      // 2. Add time slots
      for (let i = 0; i < wizardSlots.length; i++) {
        const s = wizardSlots[i];
        await apiFetch(`/spaces/${spaceData.id}/time-slots`, {
          method: "POST",
          body: JSON.stringify({
            label: s.label,
            start_time: s.start,
            end_time: s.end,
            display_order: i,
          }),
        });
      }

      // 3. Success
      toast.success("スペースを作成しました", {
        description: `「${newName}」に ${wizardSlots.length} 件の時間帯を設定しました`,
      });
      queryClient.invalidateQueries({ queryKey: ["adminSpacesSummary"] });
      setCreateOpen(false);
      resetWizard();
    } catch (err: any) {
      toast.error("作成に失敗しました", { description: err.message });
    } finally {
      setIsCreating(false);
    }
  }, [tenantId, newName, newDesc, newRows, newCols, wizardSlots, apiFetch, queryClient, resetWizard]);

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

  // (Space creation handled by handleCreateSpace wizard)

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
            <div className="flex items-center gap-2.5 mb-1">
              <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-primary to-primary/70 flex items-center justify-center shadow-md shadow-primary/20">
                <Building2 className="w-4.5 h-4.5 text-white" />
              </div>
              <h1 className="text-3xl font-bold tracking-tight bg-gradient-to-r from-foreground to-foreground/70 bg-clip-text text-transparent">スペース管理</h1>
            </div>
            <p className="text-muted-foreground mt-1 text-base pl-[46px]">
              スペースの作成・設定・座席レイアウト編集
            </p>
          </div>
          <Button
            className="btn-glow text-base px-6 py-5 rounded-xl font-semibold"
            onClick={() => setCreateOpen(true)}
          >
            <Plus className="w-5 h-5 mr-1.5" /> 新規スペース作成
          </Button>
        </div>

        {/* Space list */}
        {isLoading ? (
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3 stagger-children">
            {[1, 2, 3].map((i) => (
              <Card key={i} className="animate-pulse border-border/50 shadow-premium">
                <CardContent className="p-6">
                  <div className="h-4 bg-muted rounded-lg w-2/3 mb-4" />
                  <div className="aspect-[4/3] bg-muted/50 rounded-xl mb-4" />
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
                className="hover:shadow-premium-hover hover:-translate-y-1 transition-all duration-300 group border-border/60 shadow-premium bg-card/90 backdrop-blur-sm"
              >
                <CardHeader className="pb-3">
                  <div className="flex items-start justify-between">
                    <CardTitle className="text-lg font-bold tracking-tight">{space.name}</CardTitle>
                    <div className="flex gap-1.5">
                      <Badge variant="secondary" className="text-xs font-semibold bg-primary/8 text-primary border border-primary/15">
                        {space.seat_count} 席
                      </Badge>
                      <Badge
                        variant="outline"
                        className={`text-xs font-semibold ${
                          space.time_slot_count === 0
                            ? "border-destructive/40 text-destructive bg-destructive/8"
                            : "border-border/60 text-foreground/60"
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
                      className="w-full flex items-center gap-2.5 bg-amber-50/80 border border-amber-200/60 rounded-xl px-4 py-3 text-left hover:bg-amber-50 hover:border-amber-300/60 transition-all duration-200 shadow-sm"
                    >
                      <div className="w-8 h-8 rounded-lg bg-amber-100 flex items-center justify-center">
                        <AlertTriangle className="w-4 h-4 text-amber-600" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-semibold text-amber-900">
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
                  <div className="grid grid-cols-2 gap-2.5">
                    <Link href={`/admin/spaces/${space.id}/layout`} className="contents">
                      <Button
                        size="sm"
                        className="btn-glow text-xs rounded-lg font-semibold"
                      >
                        <LayoutGrid className="w-3.5 h-3.5 inline-block mr-1 -mt-0.5" /> レイアウト
                      </Button>
                    </Link>
                    <Button
                      size="sm"
                      variant="outline"
                      className={`text-xs rounded-lg font-medium border-border/60 ${
                        space.time_slot_count === 0
                          ? "border-primary/50 text-primary bg-primary/5 hover:bg-primary/10 font-semibold animate-pulse"
                          : "hover:border-primary/40 hover:text-primary"
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
                      className="text-xs rounded-lg font-medium border-border/60 hover:border-foreground/20"
                      onClick={() => openSettings(space)}
                    >
                      <Settings className="w-3.5 h-3.5 inline-block mr-1 -mt-0.5" /> 基本設定
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      className="text-xs rounded-lg font-medium text-destructive/70 hover:bg-destructive/5 hover:text-destructive border-destructive/20 hover:border-destructive/30"
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
          <Card className="py-20 border-border/50 shadow-premium bg-gradient-to-b from-card to-card/80">
            <CardContent className="text-center">
              <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-primary/15 to-primary/5 mx-auto mb-5 flex items-center justify-center">
                <Building2 className="w-8 h-8 text-primary/40" />
              </div>
              <h2 className="text-xl font-bold tracking-tight text-foreground mb-2">
                スペースがまだありません
              </h2>
              <p className="text-muted-foreground mb-8 text-base max-w-sm mx-auto">
                最初のスペースを作成して、座席レイアウトを設定しましょう
              </p>
              <Button
                className="btn-glow text-base px-6 py-5 rounded-xl font-semibold"
                onClick={() => setCreateOpen(true)}
              >
                <Plus className="w-5 h-5 mr-1.5" /> 新規スペース作成
              </Button>
            </CardContent>
          </Card>
        )}
      </main>

      {/* ===== Create Wizard (Multi-step) ===== */}
      <Dialog open={createOpen} onOpenChange={(v) => { if (!v) resetWizard(); setCreateOpen(v); }}>
        <DialogContent className="sm:max-w-2xl max-h-[90vh] p-0 !flex !flex-col overflow-hidden">
          {/* Wizard Header - fixed */}
          <div className="px-6 pt-6 pb-4 border-b border-border/50 shrink-0 bg-gradient-to-b from-background to-background/95">
            <DialogTitle className="text-xl font-bold tracking-tight bg-gradient-to-r from-primary to-primary/70 bg-clip-text text-transparent">新規スペース作成</DialogTitle>
            <DialogDescription className="text-sm mt-1 text-muted-foreground/80">
              {wizardStep === 1 && "基本情報を入力してください"}
              {wizardStep === 2 && "予約可能な時間帯を設定してください"}
              {wizardStep === 3 && "設定内容を確認して作成してください"}
            </DialogDescription>
            {/* Step indicator */}
            <div className="flex items-center gap-1.5 mt-5">
              {[
                { num: 1, label: "基本情報" },
                { num: 2, label: "時間帯" },
                { num: 3, label: "確認" },
              ].map((s, i) => (
                <div key={s.num} className="flex items-center gap-1.5 flex-1">
                  {i > 0 && (
                    <div className={`flex-1 h-[2px] rounded-full transition-all duration-500 ${
                      wizardStep > i ? "bg-gradient-to-r from-primary to-primary/80" : "bg-border"
                    }`} />
                  )}
                  <div className="flex items-center gap-1.5">
                    <div className={`w-8 h-8 rounded-full text-xs flex items-center justify-center font-bold transition-all duration-500 ${
                      wizardStep > s.num
                        ? "bg-gradient-to-br from-primary to-primary/80 text-white shadow-md shadow-primary/30"
                        : wizardStep === s.num
                        ? "bg-gradient-to-br from-primary to-primary/80 text-white shadow-md shadow-primary/30 ring-4 ring-primary/15"
                        : "bg-muted text-muted-foreground/60 border border-border"
                    }`}>
                      {wizardStep > s.num ? <Check className="w-4 h-4" /> : s.num}
                    </div>
                    <span className={`text-xs font-semibold hidden sm:block transition-colors duration-300 ${
                      wizardStep === s.num ? "text-primary" : wizardStep > s.num ? "text-foreground/60" : "text-muted-foreground/50"
                    }`}>
                      {s.label}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Step Content - scrollable */}
          <div className="px-6 py-5 min-h-[280px] overflow-y-auto flex-1">
            {/* ===== Step 1: Basic Info ===== */}
            {wizardStep === 1 && (
              <div className="space-y-5 animate-fade-in-up">
                <div>
                  <Label className="text-sm font-medium text-foreground/80">スペース名 <span className="text-destructive">*</span></Label>
                  <Input
                    value={newName}
                    onChange={(e) => setNewName(e.target.value)}
                    placeholder="例: 3Fコワーキングエリア"
                    className="mt-1.5"
                    autoFocus
                  />
                </div>
                <div>
                  <Label className="text-sm font-medium text-foreground/80">説明</Label>
                  <Input
                    value={newDesc}
                    onChange={(e) => setNewDesc(e.target.value)}
                    placeholder="例: 静かな作業スペース、Wi-Fi完備"
                    className="mt-1.5"
                  />
                </div>
                <div>
                  <Label className="text-sm font-medium text-foreground/80 mb-2 block">座席グリッドサイズ</Label>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="bg-secondary/30 rounded-xl p-3">
                      <Label className="text-xs text-muted-foreground">行数</Label>
                      <div className="flex items-center gap-2 mt-1.5">
                        <Button size="sm" variant="outline" className="w-8 h-8 p-0 rounded-lg" onClick={() => setNewRows(Math.max(1, newRows - 1))}><Minus className="w-3.5 h-3.5" /></Button>
                        <span className="text-lg font-bold w-8 text-center">{newRows}</span>
                        <Button size="sm" variant="outline" className="w-8 h-8 p-0 rounded-lg" onClick={() => setNewRows(Math.min(20, newRows + 1))}><Plus className="w-3.5 h-3.5" /></Button>
                      </div>
                    </div>
                    <div className="bg-secondary/30 rounded-xl p-3">
                      <Label className="text-xs text-muted-foreground">列数</Label>
                      <div className="flex items-center gap-2 mt-1.5">
                        <Button size="sm" variant="outline" className="w-8 h-8 p-0 rounded-lg" onClick={() => setNewCols(Math.max(1, newCols - 1))}><Minus className="w-3.5 h-3.5" /></Button>
                        <span className="text-lg font-bold w-8 text-center">{newCols}</span>
                        <Button size="sm" variant="outline" className="w-8 h-8 p-0 rounded-lg" onClick={() => setNewCols(Math.min(20, newCols + 1))}><Plus className="w-3.5 h-3.5" /></Button>
                      </div>
                    </div>
                  </div>
                  <p className="text-[11px] text-muted-foreground mt-2">レイアウトは作成後に詳細編集できます</p>
                </div>
              </div>
            )}

            {/* ===== Step 2: Time Slots ===== */}
            {wizardStep === 2 && (
              <div className="space-y-5 animate-fade-in-up">
                {/* Mode tabs */}
                <div className="flex bg-secondary/40 rounded-xl p-1 gap-1">
                  {[
                    { key: "preset" as const, label: "プリセット", icon: <Zap className="w-3.5 h-3.5" /> },
                    { key: "custom" as const, label: "カスタム区間", icon: <Sparkles className="w-3.5 h-3.5" /> },
                    { key: "manual" as const, label: "手動追加", icon: <PenLine className="w-3.5 h-3.5" /> },
                  ].map((tab) => (
                    <button
                      key={tab.key}
                      onClick={() => setWizardSlotMode(tab.key)}
                      className={`flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg text-xs font-semibold transition-all duration-200 ${
                        wizardSlotMode === tab.key
                          ? "bg-card text-primary shadow-sm"
                          : "text-muted-foreground hover:text-foreground"
                      }`}
                    >
                      {tab.icon} {tab.label}
                    </button>
                  ))}
                </div>

                {/* Preset mode */}
                {wizardSlotMode === "preset" && (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                    {TIME_PRESETS.map((preset) => {
                      const isSelected = wizardSlots.length === preset.slots.length &&
                        wizardSlots.every((ws, i) => ws.start === preset.slots[i].start && ws.end === preset.slots[i].end);
                      return (
                        <button
                          key={preset.name}
                          onClick={() => applyPresetToWizard(preset)}
                          className={`flex items-start gap-3 rounded-xl px-4 py-3.5 text-left transition-all duration-200 border ${
                            isSelected
                              ? "bg-primary/8 border-primary/40 ring-2 ring-primary/20 shadow-sm"
                              : "bg-card border-border/40 hover:border-primary/30 hover:bg-primary/5"
                          }`}
                        >
                          <span className={`mt-0.5 ${isSelected ? "text-primary" : "text-foreground/35"}`}>{preset.icon}</span>
                          <div className="flex-1 min-w-0">
                            <p className={`text-sm font-medium ${isSelected ? "text-primary" : "text-foreground"}`}>{preset.name}</p>
                            <p className="text-[11px] text-muted-foreground mt-0.5">
                              {preset.slots.length}枠 · {preset.slots.map((s) => `${s.start}`).join(", ")}
                            </p>
                          </div>
                          {isSelected && <Check className="w-4 h-4 text-primary mt-0.5 flex-shrink-0" />}
                        </button>
                      );
                    })}
                  </div>
                )}

                {/* Custom interval mode */}
                {wizardSlotMode === "custom" && (
                  <div className="space-y-4">
                    <div className="bg-secondary/30 rounded-xl p-4 space-y-4">
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <Label className="text-xs text-foreground/60">営業開始</Label>
                          <Input type="time" value={customStart} onChange={(e) => setCustomStart(e.target.value)} className="mt-1 h-10" />
                        </div>
                        <div>
                          <Label className="text-xs text-foreground/60">営業終了</Label>
                          <Input type="time" value={customEnd} onChange={(e) => setCustomEnd(e.target.value)} className="mt-1 h-10" />
                        </div>
                      </div>
                      <div>
                        <Label className="text-xs text-foreground/60 mb-2 block">1枠の長さ</Label>
                        <div className="flex gap-2 flex-wrap">
                          {[30, 45, 60, 90, 120, 180].map((min) => (
                            <button
                              key={min}
                              onClick={() => setCustomInterval(min)}
                              className={`px-3.5 py-2 rounded-xl text-sm font-medium transition-all duration-200 ${
                                customInterval === min
                                  ? "bg-primary text-white shadow-sm shadow-primary/25"
                                  : "bg-card border border-border/40 hover:border-primary/30"
                              }`}
                            >
                              {min < 60 ? `${min}分` : `${min / 60}時間`}
                            </button>
                          ))}
                        </div>
                      </div>
                      <Button
                        className="btn-glow w-full"
                        onClick={generateCustomSlots}
                      >
                        <Sparkles className="w-4 h-4 mr-1.5" /> 時間帯を自動生成
                      </Button>
                    </div>
                  </div>
                )}

                {/* Manual mode */}
                {wizardSlotMode === "manual" && (
                  <div className="bg-secondary/30 rounded-xl p-4 space-y-3">
                    <div className="grid grid-cols-5 gap-2 items-end">
                      <div className="col-span-2">
                        <Label className="text-xs text-foreground/60">開始</Label>
                        <Input type="time" value={manualStart} onChange={(e) => setManualStart(e.target.value)} className="mt-1 h-9" />
                      </div>
                      <div className="col-span-2">
                        <Label className="text-xs text-foreground/60">終了</Label>
                        <Input type="time" value={manualEnd} onChange={(e) => setManualEnd(e.target.value)} className="mt-1 h-9" />
                      </div>
                      <Button size="sm" className="btn-glow h-9" onClick={addManualSlot} disabled={!manualStart || !manualEnd}>
                        <Plus className="w-4 h-4" />
                      </Button>
                    </div>
                    <div>
                      <Label className="text-xs text-foreground/60">ラベル（任意）</Label>
                      <Input
                        value={manualLabel}
                        onChange={(e) => setManualLabel(e.target.value)}
                        placeholder="例: 午前の部"
                        className="mt-1 h-9"
                      />
                    </div>
                  </div>
                )}

                {/* Current wizard slots preview */}
                {wizardSlots.length > 0 ? (
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <h4 className="text-sm font-medium text-foreground/80 flex items-center gap-1.5">
                        <ClipboardList className="w-4 h-4 opacity-50" /> 設定される時間帯
                        <Badge variant="secondary" className="text-[11px]">{wizardSlots.length}枠</Badge>
                      </h4>
                      <Button size="sm" variant="ghost" className="text-xs text-destructive h-7" onClick={() => setWizardSlots([])}>
                        クリア
                      </Button>
                    </div>
                    {/* Timeline visual */}
                    <div className="bg-secondary/20 rounded-xl p-3">
                      <div className="flex gap-1 items-stretch h-9">
                        {wizardSlots.map((slot, idx) => {
                          const colors = [
                            "bg-primary/20 border-primary/30 text-primary",
                            "bg-blue-100/80 border-blue-200 text-blue-800",
                            "bg-green-100/80 border-green-200 text-green-800",
                            "bg-violet-100/80 border-violet-200 text-violet-800",
                            "bg-pink-100/80 border-pink-200 text-pink-800",
                            "bg-cyan-100/80 border-cyan-200 text-cyan-800",
                            "bg-amber-100/80 border-amber-200 text-amber-800",
                          ];
                          return (
                            <div key={idx} className={`flex-1 rounded-lg border flex items-center justify-center text-[10px] font-medium truncate ${colors[idx % colors.length]}`}>
                              {slot.start}
                            </div>
                          );
                        })}
                      </div>
                    </div>
                    {/* Individual slots */}
                    <div className="max-h-36 overflow-y-auto space-y-1">
                      {wizardSlots.map((slot, idx) => (
                        <div key={idx} className="flex items-center gap-2 bg-secondary/30 rounded-lg px-3 py-1.5 group">
                          <span className="w-5 h-5 rounded-full bg-primary/10 text-primary text-[10px] font-bold flex items-center justify-center flex-shrink-0">{idx + 1}</span>
                          <span className="text-sm font-medium flex-1">{slot.label}</span>
                          <span className="text-xs text-muted-foreground">{slot.start} → {slot.end}</span>
                          <button onClick={() => removeWizardSlot(idx)} className="opacity-0 group-hover:opacity-100 transition-opacity text-destructive/50 hover:text-destructive">
                            <X className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                ) : (
                  <div className="text-center py-4 bg-secondary/20 rounded-xl border border-dashed border-border/60">
                    <Clock className="w-6 h-6 text-muted-foreground/25 mx-auto mb-1.5" />
                    <p className="text-xs text-muted-foreground">
                      プリセットを選択するか、カスタムで生成してください
                    </p>
                  </div>
                )}
              </div>
            )}

            {/* ===== Step 3: Confirmation ===== */}
            {wizardStep === 3 && (
              <div className="space-y-5 animate-fade-in-up">
                <div className="bg-secondary/20 rounded-2xl p-5 space-y-4">
                  <div className="flex items-center gap-3">
                    <div className="w-11 h-11 rounded-xl bg-primary/10 flex items-center justify-center">
                      <Building2 className="w-5 h-5 text-primary" />
                    </div>
                    <div>
                      <p className="text-lg font-bold tracking-tight">{newName}</p>
                      <p className="text-sm text-muted-foreground">{newDesc || "説明なし"}</p>
                    </div>
                  </div>

                  <div className="grid grid-cols-3 gap-3">
                    <div className="bg-card rounded-xl p-3 text-center border border-border/40">
                      <p className="text-xl font-bold text-foreground">{newRows}×{newCols}</p>
                      <p className="text-[11px] text-muted-foreground mt-0.5">グリッドサイズ</p>
                    </div>
                    <div className="bg-card rounded-xl p-3 text-center border border-border/40">
                      <p className="text-xl font-bold text-primary">{wizardSlots.length}</p>
                      <p className="text-[11px] text-muted-foreground mt-0.5">時間帯</p>
                    </div>
                    <div className="bg-card rounded-xl p-3 text-center border border-border/40">
                      <p className="text-xl font-bold text-foreground">
                        {wizardSlots.length > 0 ? `${wizardSlots[0].start}` : "-"}
                      </p>
                      <p className="text-[11px] text-muted-foreground mt-0.5">
                        {wizardSlots.length > 0 ? `〜${wizardSlots[wizardSlots.length - 1].end}` : "未設定"}
                      </p>
                    </div>
                  </div>

                  {wizardSlots.length > 0 && (
                    <div className="bg-card rounded-xl p-3 border border-border/40">
                      <p className="text-xs text-muted-foreground mb-2 font-medium">タイムライン</p>
                      <div className="flex gap-1 items-stretch h-8">
                        {wizardSlots.map((slot, idx) => {
                          const colors = [
                            "bg-primary/20 border-primary/30 text-primary",
                            "bg-blue-100/80 border-blue-200 text-blue-800",
                            "bg-green-100/80 border-green-200 text-green-800",
                            "bg-violet-100/80 border-violet-200 text-violet-800",
                            "bg-pink-100/80 border-pink-200 text-pink-800",
                          ];
                          return (
                            <div key={idx} className={`flex-1 rounded-md border flex items-center justify-center text-[9px] font-medium truncate ${colors[idx % colors.length]}`}>
                              {slot.start}
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </div>

                <div className="bg-primary/5 border border-primary/20 rounded-xl p-4 flex items-start gap-3">
                  <Check className="w-5 h-5 text-primary flex-shrink-0 mt-0.5" />
                  <div>
                    <p className="text-sm font-medium text-foreground">作成後すぐに利用開始できます</p>
                    <p className="text-xs text-muted-foreground mt-0.5">座席レイアウトはスペース一覧から編集できます</p>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Footer with navigation - fixed */}
          <div className="px-6 py-4 border-t border-border/50 flex items-center justify-between bg-gradient-to-t from-secondary/20 to-secondary/5 shrink-0">
            <div>
              {wizardStep > 1 ? (
                <Button variant="ghost" className="text-foreground/60 hover:text-foreground" onClick={() => setWizardStep((s) => Math.max(1, s - 1) as 1 | 2 | 3)}>
                  <ChevronLeft className="w-4 h-4 mr-1" /> 戻る
                </Button>
              ) : (
                <Button variant="ghost" className="text-muted-foreground" onClick={() => { setCreateOpen(false); resetWizard(); }}>
                  キャンセル
                </Button>
              )}
            </div>
            <div className="flex items-center gap-3">
              {wizardStep === 2 && wizardSlots.length === 0 && (
                <span className="text-xs text-muted-foreground/60 hidden sm:block">あとから設定も可能です</span>
              )}
              {wizardStep < 3 ? (
                <Button
                  className="btn-glow min-w-[140px]"
                  disabled={wizardStep === 1 && !newName.trim()}
                  onClick={() => setWizardStep((s) => Math.min(3, s + 1) as 1 | 2 | 3)}
                >
                  {wizardStep === 1 ? "時間帯の設定へ" : "確認へ"}
                  <ChevronRight className="w-4 h-4 ml-1" />
                </Button>
              ) : (
                <Button
                  className="btn-glow min-w-[160px] text-base py-5"
                  onClick={handleCreateSpace}
                  disabled={isCreating}
                >
                  {isCreating ? (
                    <>
                      <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin mr-2" />
                      作成中...
                    </>
                  ) : (
                    <>
                      <Sparkles className="w-4 h-4 mr-1.5" /> スペースを作成
                    </>
                  )}
                </Button>
              )}
            </div>
          </div>
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
                <h3 className="font-medium text-sm text-foreground/80 flex items-center gap-1.5">
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
