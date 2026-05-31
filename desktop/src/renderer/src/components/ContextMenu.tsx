import { useEffect, useLayoutEffect, useRef, useState } from 'react';

export interface MenuItem {
  label?: string;
  onClick?: () => void;
  danger?: boolean;
  disabled?: boolean;
  separator?: boolean;
}

export default function ContextMenu({
  x,
  y,
  items,
  onClose,
}: {
  x: number;
  y: number;
  items: MenuItem[];
  onClose: () => void;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState({ left: x, top: y });

  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const left = Math.min(x, window.innerWidth - rect.width - 6);
    const top = Math.min(y, window.innerHeight - rect.height - 6);
    setPos({ left: Math.max(4, left), top: Math.max(4, top) });
  }, [x, y]);

  useEffect(() => {
    const onDown = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose();
    };
    const onEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onEsc);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('keydown', onEsc);
    };
  }, [onClose]);

  return (
    <div className="ctx-menu" ref={ref} style={{ left: pos.left, top: pos.top }}>
      {items.map((it, i) =>
        it.separator ? (
          <div key={i} className="ctx-sep" />
        ) : (
          <button
            key={i}
            className={'ctx-item' + (it.danger ? ' danger' : '')}
            disabled={it.disabled}
            onClick={() => {
              it.onClick?.();
              onClose();
            }}
          >
            {it.label}
          </button>
        ),
      )}
    </div>
  );
}
