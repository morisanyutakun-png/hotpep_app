"use client";

interface LayoutJson {
  grid_rows: number;
  grid_cols: number;
  cells: { type: string; label?: string | null }[][];
}

interface SpaceMiniMapProps {
  layoutJson: LayoutJson | null;
  gridRows: number;
  gridCols: number;
}

export function SpaceMiniMap({ layoutJson, gridRows, gridCols }: SpaceMiniMapProps) {
  if (!layoutJson?.cells) {
    return (
      <div className="w-full aspect-[4/3] bg-secondary/40 rounded-xl border border-dashed border-border/60 flex items-center justify-center">
        <span className="text-xs text-muted-foreground">未設定</span>
      </div>
    );
  }

  const rows = layoutJson.cells.length;
  const cols = rows > 0 ? layoutJson.cells[0].length : 0;

  return (
    <div className="w-full aspect-[4/3] bg-secondary/30 rounded-xl border border-border/40 p-2 flex items-center justify-center">
      <div
        className="inline-grid gap-px"
        style={{
          gridTemplateColumns: `repeat(${cols}, 1fr)`,
          maxWidth: "100%",
          maxHeight: "100%",
        }}
      >
        {layoutJson.cells.flat().map((cell, idx) => (
          <div
            key={idx}
            className={`rounded-[2px] ${
              cell.type === "seat"
                ? "bg-primary/70"
                : cell.type === "blocked"
                ? "bg-muted-foreground/20"
                : "bg-transparent"
            }`}
            style={{ width: "6px", height: "6px" }}
          />
        ))}
      </div>
    </div>
  );
}
