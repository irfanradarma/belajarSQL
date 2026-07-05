import { useEffect, useRef } from "react";

export interface ContextMenuAction {
  label: string;
  onSelect: () => void;
}

interface TableContextMenuProps {
  x: number;
  y: number;
  actions: ContextMenuAction[];
  onClose: () => void;
}

export function TableContextMenu({ x, y, actions, onClose }: TableContextMenuProps) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handlePointerDown(e: PointerEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose();
    }
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    document.addEventListener("pointerdown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("pointerdown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [onClose]);

  return (
    <div
      ref={ref}
      style={{ position: "fixed", left: x, top: y, zIndex: 50 }}
      className="min-w-[10rem] rounded border border-border bg-surface py-1 text-sm shadow-lg"
    >
      {actions.map((action) => (
        <button
          key={action.label}
          type="button"
          onClick={() => {
            action.onSelect();
            onClose();
          }}
          className="block w-full px-3 py-1.5 text-left hover:bg-accent/10"
        >
          {action.label}
        </button>
      ))}
    </div>
  );
}
