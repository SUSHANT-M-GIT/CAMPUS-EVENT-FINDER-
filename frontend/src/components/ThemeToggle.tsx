import { useRef, useState } from 'react';
import { Moon, Sun } from 'lucide-react';
import { useTheme } from '../context/ThemeContext';

const POSITION_KEY = 'campus-event-theme-toggle-position';
type TogglePosition = { left: number; top: number };

export default function ThemeToggle() {
  const { toggleTheme, isDark } = useTheme();
  const [position, setPosition] = useState<TogglePosition | null>(() => {
    try {
      const saved = localStorage.getItem(POSITION_KEY);
      return saved ? JSON.parse(saved) as TogglePosition : null;
    } catch {
      return null;
    }
  });
  const [isDragging, setIsDragging] = useState(false);
  const dragStart = useRef<{ pointerX: number; pointerY: number; left: number; top: number } | null>(null);
  const moved = useRef(false);

  const handlePointerDown = (event: React.PointerEvent<HTMLButtonElement>) => {
    if (event.pointerType === 'mouse' && event.button !== 0) return;

    const rect = event.currentTarget.getBoundingClientRect();
    dragStart.current = {
      pointerX: event.clientX,
      pointerY: event.clientY,
      left: rect.left,
      top: rect.top,
    };
    moved.current = false;
    setIsDragging(true);
    event.currentTarget.setPointerCapture(event.pointerId);
  };

  const handlePointerMove = (event: React.PointerEvent<HTMLButtonElement>) => {
    if (!dragStart.current) return;

    const button = event.currentTarget;
    const nextLeft = dragStart.current.left + event.clientX - dragStart.current.pointerX;
    const nextTop = dragStart.current.top + event.clientY - dragStart.current.pointerY;
    const left = Math.max(0, Math.min(nextLeft, window.innerWidth - button.offsetWidth));
    const top = Math.max(0, Math.min(nextTop, window.innerHeight - button.offsetHeight));

    if (Math.abs(event.clientX - dragStart.current.pointerX) > 4 || Math.abs(event.clientY - dragStart.current.pointerY) > 4) {
      moved.current = true;
    }

    const nextPosition = { left, top };
    setPosition(nextPosition);
    try {
      localStorage.setItem(POSITION_KEY, JSON.stringify(nextPosition));
    } catch {
      // Position persistence is optional.
    }
  };

  const handlePointerUp = (event: React.PointerEvent<HTMLButtonElement>) => {
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
    dragStart.current = null;
    setIsDragging(false);
  };

  const handleClick = () => {
    if (moved.current) {
      moved.current = false;
      return;
    }
    toggleTheme();
  };

  return (
    <button
      type="button"
      onClick={handleClick}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerCancel={handlePointerUp}
      className={`theme-toggle global-theme-toggle${isDragging ? ' is-dragging' : ''}`}
      style={position ? { left: position.left, top: position.top, right: 'auto' } : undefined}
      aria-label={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
      title="Drag to move or click to change theme"
    >
      {isDark ? <Sun size={17} /> : <Moon size={17} />}
    </button>
  );
}
