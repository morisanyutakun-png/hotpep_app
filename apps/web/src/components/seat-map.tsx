"use client";

interface SeatData {
  seat_id: string;
  label: string;
  row: number;
  col: number;
  seat_type: string;
  is_enabled: boolean;
  status: string; // available, reserved, my_reservation, disabled
}

interface LayoutCell {
  type: string;
  label: string | null;
  seat_type: string | null;
  is_enabled: boolean;
}

interface SeatMapProps {
  layoutJson: {
    grid_rows: number;
    grid_cols: number;
    cells: LayoutCell[][];
  } | null;
  availability: SeatData[];
  selectedSeatId: string | null;
  onSelectSeat: (seatId: string, label: string) => void;
  disabled?: boolean;
}

const STATUS_STYLES: Record<string, { bg: string; text: string; border: string; cursor: string }> = {
  available: {
    bg: "bg-emerald-50 hover:bg-emerald-100",
    text: "text-emerald-700",
    border: "border-emerald-300",
    cursor: "cursor-pointer",
  },
  reserved: {
    bg: "bg-gray-100",
    text: "text-gray-400",
    border: "border-gray-200",
    cursor: "cursor-not-allowed",
  },
  my_reservation: {
    bg: "bg-purple-50",
    text: "text-purple-700",
    border: "border-purple-300",
    cursor: "cursor-not-allowed",
  },
  disabled: {
    bg: "bg-gray-200",
    text: "text-gray-400",
    border: "border-gray-300",
    cursor: "cursor-not-allowed",
  },
  selected: {
    bg: "bg-blue-100",
    text: "text-blue-700",
    border: "border-blue-500 ring-2 ring-blue-300",
    cursor: "cursor-pointer",
  },
};

const SEAT_TYPE_ICONS: Record<string, string> = {
  quiet: "🤫",
  outlet: "🔌",
  normal: "",
};

export function SeatMap({
  layoutJson,
  availability,
  selectedSeatId,
  onSelectSeat,
  disabled = false,
}: SeatMapProps) {
  if (!layoutJson) {
    return (
      <div className="text-center py-12 text-muted-foreground">
        座席レイアウトが設定されていません
      </div>
    );
  }

  const seatMap = new Map(availability.map((s) => [`${s.row}-${s.col}`, s]));

  const handleClick = (seat: SeatData) => {
    if (disabled) return;
    if (seat.status !== "available") return;
    onSelectSeat(seat.seat_id, seat.label);
  };

  return (
    <div className="space-y-4">
      {/* 凡例 */}
      <div className="flex flex-wrap gap-3 text-xs">
        <div className="flex items-center gap-1.5">
          <div className="w-4 h-4 rounded bg-emerald-50 border border-emerald-300" />
          <span>空席</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-4 h-4 rounded bg-blue-100 border-2 border-blue-500" />
          <span>選択中</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-4 h-4 rounded bg-gray-100 border border-gray-200" />
          <span>予約済み</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-4 h-4 rounded bg-purple-50 border border-purple-300" />
          <span>自分の予約</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-4 h-4 rounded bg-gray-200 border border-gray-300">
            <div className="w-full h-full bg-[repeating-linear-gradient(45deg,transparent,transparent_2px,rgba(0,0,0,0.1)_2px,rgba(0,0,0,0.1)_4px)]" />
          </div>
          <span>使用不可</span>
        </div>
        <div className="flex items-center gap-1.5 ml-2 border-l pl-2">
          <span>🤫 静か席</span>
          <span>🔌 コンセント</span>
        </div>
      </div>

      {/* 座席マップ */}
      <div className="overflow-x-auto pb-2">
        <div className="inline-grid gap-1.5" style={{
          gridTemplateColumns: `repeat(${layoutJson.grid_cols}, minmax(0, 1fr))`,
        }}>
          {layoutJson.cells.map((row, rowIdx) =>
            row.map((cell, colIdx) => {
              if (cell.type === "aisle") {
                return (
                  <div
                    key={`${rowIdx}-${colIdx}`}
                    className="w-12 h-12 sm:w-14 sm:h-14"
                  />
                );
              }

              if (cell.type === "blocked") {
                return (
                  <div
                    key={`${rowIdx}-${colIdx}`}
                    className="w-12 h-12 sm:w-14 sm:h-14 bg-gray-200 rounded-md border border-gray-300"
                  >
                    <div className="w-full h-full bg-[repeating-linear-gradient(45deg,transparent,transparent_2px,rgba(0,0,0,0.1)_2px,rgba(0,0,0,0.1)_4px)] rounded-md" />
                  </div>
                );
              }

              // seat
              const seatData = seatMap.get(`${rowIdx}-${colIdx}`);
              if (!seatData) {
                return (
                  <div
                    key={`${rowIdx}-${colIdx}`}
                    className="w-12 h-12 sm:w-14 sm:h-14"
                  />
                );
              }

              const isSelected = selectedSeatId === seatData.seat_id;
              const status = isSelected ? "selected" : seatData.status;
              const style = STATUS_STYLES[status] || STATUS_STYLES.disabled;
              const icon = SEAT_TYPE_ICONS[seatData.seat_type] || "";

              return (
                <button
                  key={`${rowIdx}-${colIdx}`}
                  onClick={() => handleClick(seatData)}
                  disabled={disabled || (seatData.status !== "available" && !isSelected)}
                  className={`
                    w-12 h-12 sm:w-14 sm:h-14 rounded-md border text-xs font-medium
                    flex flex-col items-center justify-center gap-0.5
                    transition-all duration-150
                    ${style.bg} ${style.text} ${style.border} ${style.cursor}
                    ${disabled ? "opacity-60" : ""}
                  `}
                  title={`${seatData.label} (${seatData.seat_type})`}
                >
                  <span className="font-semibold text-[11px] sm:text-xs">{seatData.label}</span>
                  {icon && <span className="text-[10px] leading-none">{icon}</span>}
                </button>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}
