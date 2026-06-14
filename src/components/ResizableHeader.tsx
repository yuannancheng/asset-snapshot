import React, { useCallback, useEffect, useRef, useState } from "react";

type ResizeState = {
  index: number;
  startX: number;
  startWidth: number;
} | null;

type ResizableHeaderProps = {
  labels: string[];
  widths: number[];
  onResize: (widths: number[]) => void;
};

const MIN_WIDTH = 60;

export function ResizableHeader({ labels, widths, onResize }: ResizableHeaderProps) {
  const [resize, setResize] = useState<ResizeState>(null);
  const widthsRef = useRef(widths);
  const onResizeRef = useRef(onResize);
  widthsRef.current = widths;
  onResizeRef.current = onResize;

  const handleMouseDown = useCallback(
    (index: number, e: React.MouseEvent) => {
      e.preventDefault();
      setResize({ index, startX: e.clientX, startWidth: widthsRef.current[index] });
    },
    [],
  );

  useEffect(() => {
    if (!resize) return;

    const handleMouseMove = (e: MouseEvent) => {
      const delta = e.clientX - resize.startX;
      const newWidth = Math.max(MIN_WIDTH, resize.startWidth + delta);
      const next = [...widthsRef.current];
      next[resize.index] = newWidth;
      onResizeRef.current(next);
    };

    const handleMouseUp = () => {
      setResize(null);
    };

    document.addEventListener("mousemove", handleMouseMove);
    document.addEventListener("mouseup", handleMouseUp);
    return () => {
      document.removeEventListener("mousemove", handleMouseMove);
      document.removeEventListener("mouseup", handleMouseUp);
    };
  }, [resize]);

  return (
    <div
      className="grid gap-3 text-xs font-medium text-ink/45"
      style={{
        gridTemplateColumns: widths.map((w) => `${w}px`).join(" "),
        userSelect: resize ? "none" : undefined,
        cursor: resize ? "col-resize" : undefined,
      }}
    >
      {labels.map((label, idx) => (
        <div key={idx} className="flex items-center">
          <span>{label}</span>
          {idx < labels.length - 1 ? (
            <div
              className="ml-auto h-4 w-1 shrink-0 cursor-col-resize rounded hover:bg-ink/20"
              onMouseDown={(e) => handleMouseDown(idx, e)}
            />
          ) : null}
        </div>
      ))}
    </div>
  );
}
