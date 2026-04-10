import { useState, useRef, useEffect } from 'react';
import './subtitle-overlay.css';

export interface SubtitleOverlayProps {
  sourceText: string;
  translationText: string;
  isVisible: boolean;
}

export function SubtitleOverlay({ sourceText, translationText, isVisible }: SubtitleOverlayProps) {
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const dragStartPos = useRef({ x: 0, y: 0 });
  const overlayRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!isDragging) {
      return;
    }

    const handleMouseMove = (e: MouseEvent) => {
      const deltaX = e.clientX - dragStartPos.current.x;
      const deltaY = e.clientY - dragStartPos.current.y;

      setPosition((prev) => ({
        x: prev.x + deltaX,
        y: prev.y + deltaY,
      }));

      dragStartPos.current = { x: e.clientX, y: e.clientY };
    };

    const handleMouseUp = () => {
      setIsDragging(false);
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);

    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isDragging]);

  const handleMouseDown = (e: React.MouseEvent) => {
    setIsDragging(true);
    dragStartPos.current = { x: e.clientX, y: e.clientY };
  };

  if (!isVisible || !sourceText) {
    return null;
  }

  const style: React.CSSProperties = {
    transform: `translate(calc(-50% + ${position.x}px), ${position.y}px)`,
  };

  return (
    <div
      ref={overlayRef}
      className="subtitle-overlay"
      style={style}
      onMouseDown={handleMouseDown}
    >
      <div className="subtitle-overlay__source">{sourceText}</div>
      {translationText && (
        <div className="subtitle-overlay__translation">{translationText}</div>
      )}
    </div>
  );
}
