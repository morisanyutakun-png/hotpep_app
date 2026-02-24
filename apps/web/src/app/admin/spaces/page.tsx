"use client";

import { useEffect, useState } from "react";
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

export default function AdminSpacesPage() {
  const router = useRouter();
  const { user, role, tenantId, isLoading: authLoading } = useAuth();
  const apiFetch = useApiFetch();
  const queryClient = useQueryClient();

  // Dialog states
  const [createOpen, setCreateOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
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

  // Time slots for selected space
  const { data: timeSlots, isLoading: slotsLoading } = useQuery({
    queryKey: ["timeSlots", selectedSpace?.id],
    queryFn: () => apiFetch<TimeSlot[]>(`/spaces/${selectedSpace!.id}/time-slots`),
    enabled: !!selectedSpace && settingsOpen,
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
    mutationFn: () => {
      const existingSlots = timeSlots || [];
      return apiFetch(`/spaces/${selectedSpace!.id}/time-slots`, {
        method: "POST",
        body: JSON.stringify({
          label: slotLabel || `${slotStart}-${slotEnd}`,
          start_time: slotStart,
          end_time: slotEnd,
          display_order: existingSlots.length,
        }),
      });
    },
    onSuccess: () => {
      toast.success("タイムスロットを追加しました");
      setSlotLabel("");
      setSlotStart("");
      setSlotEnd("");
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

  const openSettings = (space: SpaceSummary) => {
    setSelectedSpace(space);
    setEditName(space.name);
    setEditDesc(space.description || "");
    setSettingsOpen(true);
  };

  const openDelete = (space: SpaceSummary) => {
    setSelectedSpace(space);
    setDeleteOpen(true);
  };

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
                      <Badge variant="outline" className="text-xs">
                        {space.time_slot_count} 枠
                      </Badge>
                    </div>
                  </div>
                  <p className="text-sm text-muted-foreground line-clamp-2">
                    {space.description || "説明なし"}
                  </p>
                </CardHeader>
                <CardContent className="space-y-4">
                  {/* Mini map */}
                  <Link href={`/admin/spaces/${space.id}/layout`} className="block">
                    <SpaceMiniMap
                      layoutJson={space.layout_json}
                      gridRows={space.grid_rows}
                      gridCols={space.grid_cols}
                    />
                  </Link>

                  {/* Actions */}
                  <div className="grid grid-cols-3 gap-2">
                    <Link href={`/admin/spaces/${space.id}/layout`} className="contents">
                      <Button
                        size="sm"
                        className="bg-orange-500 hover:bg-orange-600 text-xs"
                      >
                        レイアウト
                      </Button>
                    </Link>
                    <Button
                      size="sm"
                      variant="outline"
                      className="text-xs"
                      onClick={() => openSettings(space)}
                    >
                      設定
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      className="text-xs text-red-600 hover:bg-red-50 hover:text-red-700 border-red-200"
                      onClick={() => openDelete(space)}
                    >
                      削除
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

      {/* Settings Dialog */}
      <Dialog open={settingsOpen} onOpenChange={setSettingsOpen}>
        <DialogContent className="sm:max-w-xl">
          <DialogHeader>
            <DialogTitle>スペース設定</DialogTitle>
            <DialogDescription>
              スペースの基本情報とタイムスロットを管理します
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-6">
            {/* Basic info */}
            <div className="space-y-3">
              <h3 className="font-medium text-sm text-gray-700">基本情報</h3>
              <div>
                <Label className="text-xs">スペース名</Label>
                <Input
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  className="mt-1"
                />
              </div>
              <div>
                <Label className="text-xs">説明</Label>
                <Input
                  value={editDesc}
                  onChange={(e) => setEditDesc(e.target.value)}
                  className="mt-1"
                />
              </div>
              <Button
                size="sm"
                className="bg-orange-500 hover:bg-orange-600"
                onClick={() => updateMutation.mutate()}
                disabled={!editName.trim() || updateMutation.isPending}
              >
                {updateMutation.isPending ? "保存中..." : "保存"}
              </Button>
            </div>

            {/* Time slots */}
            <div className="space-y-3 border-t pt-4">
              <h3 className="font-medium text-sm text-gray-700">タイムスロット</h3>

              {slotsLoading ? (
                <p className="text-sm text-muted-foreground animate-pulse">
                  読み込み中...
                </p>
              ) : timeSlots && timeSlots.length > 0 ? (
                <div className="space-y-2">
                  {timeSlots.map((slot) => (
                    <div
                      key={slot.id}
                      className="flex items-center justify-between bg-gray-50 rounded-md px-3 py-2"
                    >
                      <div className="text-sm">
                        <span className="font-medium">{slot.label}</span>
                        <span className="text-muted-foreground ml-2">
                          {slot.start_time} - {slot.end_time}
                        </span>
                      </div>
                      <Button
                        size="sm"
                        variant="ghost"
                        className="text-red-500 hover:text-red-700 hover:bg-red-50 h-7 px-2"
                        onClick={() => deleteSlotMutation.mutate(slot.id)}
                        disabled={deleteSlotMutation.isPending}
                      >
                        削除
                      </Button>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">
                  タイムスロットがありません
                </p>
              )}

              {/* Add slot form */}
              <div className="bg-gray-50 rounded-md p-3 space-y-2">
                <p className="text-xs font-medium text-gray-600">
                  タイムスロット追加
                </p>
                <div className="grid grid-cols-3 gap-2">
                  <div>
                    <Label className="text-xs">開始</Label>
                    <Input
                      type="time"
                      value={slotStart}
                      onChange={(e) => setSlotStart(e.target.value)}
                      className="mt-1 h-8 text-sm"
                    />
                  </div>
                  <div>
                    <Label className="text-xs">終了</Label>
                    <Input
                      type="time"
                      value={slotEnd}
                      onChange={(e) => setSlotEnd(e.target.value)}
                      className="mt-1 h-8 text-sm"
                    />
                  </div>
                  <div>
                    <Label className="text-xs">ラベル(任意)</Label>
                    <Input
                      value={slotLabel}
                      onChange={(e) => setSlotLabel(e.target.value)}
                      placeholder="午前"
                      className="mt-1 h-8 text-sm"
                    />
                  </div>
                </div>
                <Button
                  size="sm"
                  variant="outline"
                  className="w-full"
                  onClick={() => createSlotMutation.mutate()}
                  disabled={!slotStart || !slotEnd || createSlotMutation.isPending}
                >
                  {createSlotMutation.isPending ? "追加中..." : "+ 追加"}
                </Button>
              </div>
            </div>
          </div>
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
