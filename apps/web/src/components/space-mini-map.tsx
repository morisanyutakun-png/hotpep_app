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
      <div className="w-full aspect-[4/3] bg-gray-50 rounded-md border border-dashed border-gray-200 flex items-center justify-center">
        <span className="text-xs text-muted-foreground">未設定</span>
      </div>
    );
  }

  const rows = layoutJson.cells.length;
  const cols = rows > 0 ? layoutJson.cells[0].length : 0;

  return (
    <div className="w-full aspect-[4/3] bg-gray-50 rounded-md border border-gray-200 p-2 flex items-center justify-center">
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
            className={`rounded-[1px] ${
              cell.type === "seat"
                ? "bg-emerald-400"
                : cell.type === "blocked"
                ? "bg-gray-300"
                : "bg-transparent"
            }`}
            style={{ width: "6px", height: "6px" }}
          />
        ))}
      </div>
    </div>
  );
}
