"use client";

import { useEffect, useState, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/lib/auth";
import { useApiFetch } from "@/hooks/use-api";
import { Header } from "@/components/header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Save, Armchair, Square, Ban, VolumeX, Plug } from "lucide-react";
import { toast } from "sonner";

type CellType = "seat" | "aisle" | "blocked";
type SeatType = "normal" | "quiet" | "outlet";

interface Cell {
  type: CellType;
  label: string | null;
  seat_type: SeatType | null;
  is_enabled: boolean;
}

interface LayoutData {
  layout: { layout_json: any; version: number } | null;
  seats: any[];
  grid_rows: number;
  grid_cols: number;
}

function createEmptyGrid(rows: number, cols: number): Cell[][] {
  return Array.from({ length: rows }, () =>
    Array.from({ length: cols }, () => ({
      type: "aisle" as CellType,
      label: null,
      seat_type: null,
      is_enabled: true,
    }))
  );
}

function autoLabel(row: number, col: number): string {
  return `${String.fromCharCode(65 + row)}${col + 1}`;
}

const CELL_TYPE_STYLES: Record<CellType, string> = {
  seat: "bg-emerald-50 border-emerald-300/80 text-emerald-800 shadow-sm",
  aisle: "bg-card/60 border-dashed border-border/80",
  blocked: "bg-muted/80 border-border text-muted-foreground",
};

const SEAT_TYPE_DISPLAY: Record<SeatType, { label: string; icon: React.ReactNode }> = {
  normal: { label: "通常", icon: null },
  quiet: { label: "静か席", icon: <VolumeX className="w-3.5 h-3.5" /> },
  outlet: { label: "コンセント", icon: <Plug className="w-3.5 h-3.5" /> },
};

export default function LayoutEditorPage() {
  const params = useParams();
  const router = useRouter();
  const spaceId = params.spaceId as string;
  const { user, role, isLoading: authLoading } = useAuth();
  const apiFetch = useApiFetch();
  const queryClient = useQueryClient();

  const [gridRows, setGridRows] = useState(8);
  const [gridCols, setGridCols] = useState(10);
  const [grid, setGrid] = useState<Cell[][]>(() => createEmptyGrid(8, 10));
  const [activeTool, setActiveTool] = useState<CellType>("seat");
  const [activeSeatType, setActiveSeatType] = useState<SeatType>("normal");
  const [selectedCell, setSelectedCell] = useState<{ row: number; col: number } | null>(null);
  const [isDrawing, setIsDrawing] = useState(false);

  useEffect(() => {
    if (!authLoading) {
      if (!user) router.push("/login");
      else if (role !== "admin") router.push("/");
    }
  }, [authLoading, user, role, router]);

  // レイアウト読み込み
  const { data: layoutData, isLoading } = useQuery({
    queryKey: ["layout", spaceId],
    queryFn: () => apiFetch<LayoutData>(`/spaces/${spaceId}/layout`),
    enabled: !!user && role === "admin",
  });

  // 読み込み時にグリッドを復元
  useEffect(() => {
    if (layoutData) {
      const rows = layoutData.grid_rows;
      const cols = layoutData.grid_cols;
      setGridRows(rows);
      setGridCols(cols);

      if (layoutData.layout?.layout_json?.cells) {
        setGrid(layoutData.layout.layout_json.cells);
      } else {
        setGrid(createEmptyGrid(rows, cols));
      }
    }
  }, [layoutData]);

  // グリッドサイズ変更
  const resizeGrid = useCallback(() => {
    setGrid((prev) => {
      const newGrid = createEmptyGrid(gridRows, gridCols);
      for (let r = 0; r < Math.min(prev.length, gridRows); r++) {
        for (let c = 0; c < Math.min(prev[r].length, gridCols); c++) {
          newGrid[r][c] = prev[r][c];
        }
      }
      return newGrid;
    });
  }, [gridRows, gridCols]);

  // セルクリック
  const handleCellClick = (row: number, col: number) => {
    setSelectedCell({ row, col });
    setGrid((prev) => {
      const newGrid = prev.map((r) => [...r]);
      if (activeTool === "seat") {
        newGrid[row][col] = {
          type: "seat",
          label: autoLabel(row, col),
          seat_type: activeSeatType,
          is_enabled: true,
        };
      } else {
        newGrid[row][col] = {
          type: activeTool,
          label: null,
          seat_type: null,
          is_enabled: true,
        };
      }
      return newGrid;
    });
  };

  // ドラッグ描画
  const handleCellEnter = (row: number, col: number) => {
    if (!isDrawing) return;
    handleCellClick(row, col);
  };

  // 選択セルのプロパティ変更
  const updateSelectedCell = (updates: Partial<Cell>) => {
    if (!selectedCell) return;
    setGrid((prev) => {
      const newGrid = prev.map((r) => [...r]);
      newGrid[selectedCell.row][selectedCell.col] = {
        ...newGrid[selectedCell.row][selectedCell.col],
        ...updates,
      };
      return newGrid;
    });
  };

  // 保存
  const saveMutation = useMutation({
    mutationFn: () =>
      apiFetch<any>(`/spaces/${spaceId}/layout`, {
        method: "PUT",
        body: JSON.stringify({
          grid_rows: gridRows,
          grid_cols: gridCols,
          cells: grid,
        }),
      }),
    onSuccess: () => {
      toast.success("レイアウトを保存しました");
      queryClient.invalidateQueries({ queryKey: ["layout", spaceId] });
    },
    onError: (err: Error) => {
      toast.error("保存に失敗しました", { description: err.message });
    },
  });

  // 全席かぞえ
  const seatCount = grid.flat().filter((c) => c.type === "seat").length;
  const selectedCellData = selectedCell ? grid[selectedCell.row]?.[selectedCell.col] : null;

  if (authLoading || !user) return null;

  return (
    <div className="min-h-screen bg-warm-gradient">
      <Header />
      <main className="max-w-[1400px] mx-auto px-4 py-6">
        <div className="mb-4 flex items-center justify-between flex-wrap gap-3">
          <div>
            <Button variant="ghost" size="sm" onClick={() => router.push("/admin/spaces")} className="-ml-2 mb-1 text-foreground/60 hover:text-foreground">
              ← スペース管理に戻る
            </Button>
            <h1 className="text-xl font-bold tracking-tight text-foreground">座席レイアウト編集</h1>
          </div>
          <div className="flex items-center gap-2">
            <Badge variant="secondary">{seatCount} 席</Badge>
            <Button
              className="btn-glow"
              onClick={() => saveMutation.mutate()}
              disabled={saveMutation.isPending}
            >
              {saveMutation.isPending ? "保存中..." : <><Save className="w-4 h-4 mr-1.5 inline-block -mt-0.5" />保存</>}
            </Button>
          </div>
        </div>

        <div className="grid lg:grid-cols-[200px_1fr_260px] gap-4">
          {/* 左: ツール */}
          <Card className="h-fit">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">ツール</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="space-y-1.5">
                <p className="text-xs text-muted-foreground font-medium">セル種別</p>
                {(["seat", "aisle", "blocked"] as CellType[]).map((type) => (
                  <button
                    key={type}
                    onClick={() => setActiveTool(type)}
                    className={`w-full text-left px-3 py-1.5 rounded-lg text-sm transition-colors ${
                      activeTool === type
                        ? "bg-primary/10 text-primary font-medium"
                        : "hover:bg-secondary/60"
                    }`}
                  >
                    {type === "seat" ? <><Armchair className="w-3.5 h-3.5 inline-block mr-1 -mt-0.5" /> 座席</> : type === "aisle" ? <><Square className="w-3.5 h-3.5 inline-block mr-1 -mt-0.5" /> 通路</> : <><Ban className="w-3.5 h-3.5 inline-block mr-1 -mt-0.5" /> ブロック</>}
                  </button>
                ))}
              </div>

              {activeTool === "seat" && (
                <div className="space-y-1.5">
                  <p className="text-xs text-muted-foreground font-medium">席タイプ</p>
                  {(["normal", "quiet", "outlet"] as SeatType[]).map((type) => (
                    <button
                      key={type}
                      onClick={() => setActiveSeatType(type)}
                      className={`w-full text-left px-3 py-1.5 rounded-lg text-sm transition-colors ${
                        activeSeatType === type
                          ? "bg-primary/10 text-primary font-medium"
                          : "hover:bg-secondary/60"
                      }`}
                    >
                      {SEAT_TYPE_DISPLAY[type].icon} {SEAT_TYPE_DISPLAY[type].label}
                    </button>
                  ))}
                </div>
              )}

              <div className="space-y-2 pt-2 border-t">
                <p className="text-xs text-muted-foreground font-medium">グリッドサイズ</p>
                <div className="flex gap-2">
                  <div>
                    <Label className="text-xs">行</Label>
                    <Input
                      type="number"
                      min={1}
                      max={20}
                      value={gridRows}
                      onChange={(e) => setGridRows(Number(e.target.value))}
                      className="h-8 text-sm"
                    />
                  </div>
                  <div>
                    <Label className="text-xs">列</Label>
                    <Input
                      type="number"
                      min={1}
                      max={20}
                      value={gridCols}
                      onChange={(e) => setGridCols(Number(e.target.value))}
                      className="h-8 text-sm"
                    />
                  </div>
                </div>
                <Button variant="outline" size="sm" className="w-full" onClick={resizeGrid}>
                  サイズ変更
                </Button>
              </div>

              <div className="space-y-1 pt-2 border-t">
                <p className="text-xs text-muted-foreground font-medium">凡例</p>
                <div className="flex items-center gap-2 text-xs">
                  <div className="w-4 h-4 rounded-md bg-emerald-50 border-[1.5px] border-emerald-300/80" />
                  <span>座席</span>
                </div>
                <div className="flex items-center gap-2 text-xs">
                  <div className="w-4 h-4 rounded-md bg-card/60 border-[1.5px] border-dashed border-border/80" />
                  <span>通路</span>
                </div>
                <div className="flex items-center gap-2 text-xs">
                  <div className="w-4 h-4 rounded-md bg-muted/80 border-[1.5px] border-border" />
                  <span>ブロック</span>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* 中央: グリッド */}
          <Card>
            <CardContent className="p-4 overflow-x-auto">
              {isLoading ? (
                <div className="text-center py-12 text-muted-foreground animate-pulse">読み込み中...</div>
              ) : (
                <div
                  className="inline-grid gap-1.5 p-2 bg-secondary/20 rounded-xl border border-border/60"
                  style={{
                    gridTemplateColumns: `repeat(${gridCols}, minmax(0, 1fr))`,
                  }}
                  onMouseLeave={() => setIsDrawing(false)}
                >
                  {grid.map((row, rowIdx) =>
                    row.map((cell, colIdx) => {
                      const isSelected =
                        selectedCell?.row === rowIdx && selectedCell?.col === colIdx;

                      return (
                        <button
                          key={`${rowIdx}-${colIdx}`}
                          onMouseDown={() => {
                            setIsDrawing(true);
                            handleCellClick(rowIdx, colIdx);
                          }}
                          onMouseUp={() => setIsDrawing(false)}
                          onMouseEnter={() => handleCellEnter(rowIdx, colIdx)}
                          onClick={() => setSelectedCell({ row: rowIdx, col: colIdx })}
                          className={`
                            w-11 h-11 sm:w-12 sm:h-12 rounded-lg border-[1.5px] text-[10px] sm:text-xs
                            flex flex-col items-center justify-center transition-all duration-200 select-none
                            ${CELL_TYPE_STYLES[cell.type]}
                            ${isSelected ? "ring-2 ring-primary ring-offset-2 shadow-md" : ""}
                            ${!cell.is_enabled && cell.type === "seat" ? "opacity-50" : ""}
                          `}
                        >
                          {cell.type === "seat" && (
                            <>
                              <span className="font-semibold leading-tight">{cell.label}</span>
                              {cell.seat_type && cell.seat_type !== "normal" && (
                                <span className="text-[9px] leading-none">
                                  {SEAT_TYPE_DISPLAY[cell.seat_type as SeatType]?.icon}
                                </span>
                              )}
                            </>
                          )}
                          {cell.type === "blocked" && (
                            <span className="text-muted-foreground/60">✕</span>
                          )}
                        </button>
                      );
                    })
                  )}
                </div>
              )}
            </CardContent>
          </Card>

          {/* 右: プロパティ */}
          <Card className="h-fit">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">プロパティ</CardTitle>
            </CardHeader>
            <CardContent>
              {selectedCell && selectedCellData ? (
                <div className="space-y-3">
                  <p className="text-xs text-muted-foreground">
                    位置: 行{selectedCell.row + 1} / 列{selectedCell.col + 1}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    種別: {selectedCellData.type === "seat" ? "座席" : selectedCellData.type === "aisle" ? "通路" : "ブロック"}
                  </p>

                  {selectedCellData.type === "seat" && (
                    <>
                      <div>
                        <Label className="text-xs">ラベル</Label>
                        <Input
                          value={selectedCellData.label || ""}
                          onChange={(e) => updateSelectedCell({ label: e.target.value })}
                          className="h-8 text-sm mt-1"
                        />
                      </div>
                      <div>
                        <Label className="text-xs">席タイプ</Label>
                        <select
                          value={selectedCellData.seat_type || "normal"}
                          onChange={(e) =>
                            updateSelectedCell({
                              seat_type: e.target.value as SeatType,
                            })
                          }
                          className="mt-1 w-full h-8 text-sm border border-border/60 rounded-lg px-2 bg-card/50 focus:outline-none focus:ring-2 focus:ring-primary/30"
                        >
                          <option value="normal">通常</option>
                          <option value="quiet">静か席</option>
                          <option value="outlet">コンセント</option>
                        </select>
                      </div>
                      <div className="flex items-center gap-2">
                        <input
                          type="checkbox"
                          checked={selectedCellData.is_enabled}
                          onChange={(e) =>
                            updateSelectedCell({ is_enabled: e.target.checked })
                          }
                          className="rounded"
                        />
                        <Label className="text-xs">有効</Label>
                      </div>
                    </>
                  )}
                </div>
              ) : (
                <p className="text-xs text-muted-foreground">
                  セルをクリックして選択してください
                </p>
              )}
            </CardContent>
          </Card>
        </div>
      </main>
    </div>
  );
}
