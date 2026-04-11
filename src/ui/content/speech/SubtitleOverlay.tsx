import { useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { translateMessage } from '../../../shared/i18n/i18n';
import './subtitle-overlay.css';

interface SubtitleOverlayProps {
  sourceText: string;
  translationText: string;
  isVisible: boolean;
}

export function SubtitleOverlay({ sourceText, translationText, isVisible }: SubtitleOverlayProps) {
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const dragStartPos = useRef({ x: 0, y: 0 });
  const [container] = useState(() => {
    const div = document.createElement('div');
    div.id = 'chatbrowserx-subtitle-container';
    return div;
  });

  useEffect(() => {
    document.body.appendChild(container);

    // Inject styles into the main document
    const styleId = 'chatbrowserx-subtitle-styles';
    if (!document.getElementById(styleId)) {
      const styleElement = document.createElement('style');
      styleElement.id = styleId;
      styleElement.textContent = `
        .subtitle-overlay {
          position: fixed;
          bottom: 60px;
          left: 50%;
          transform: translateX(-50%);
          background: rgba(0, 0, 0, 0.45);
          color: white;
          padding: 8px 20px;
          border-radius: 30px;
          max-width: 600px;
          min-width: 300px;
          z-index: 2147483647;
          cursor: move;
          user-select: none;
          backdrop-filter: blur(10px);
          box-shadow: 0 4px 16px rgba(0, 0, 0, 0.3);
          transition: padding 0.2s ease;
          pointer-events: auto;
          display: flex;
          align-items: center;
          gap: 12px;
        }
        .subtitle-overlay:has(.subtitle-overlay__translation) {
          padding: 12px 24px;
        }
        .subtitle-overlay__indicator {
          width: 8px;
          height: 8px;
          border-radius: 50%;
          background: #22c55e;
          flex-shrink: 0;
          animation: subtitle-pulse 1.5s ease-in-out infinite;
        }
        @keyframes subtitle-pulse {
          0%, 100% {
            opacity: 1;
          }
          50% {
            opacity: 0.3;
          }
        }
        .subtitle-overlay__content {
          flex: 1;
          min-width: 0;
        }
        .subtitle-overlay__source {
          font-size: 18px;
          font-weight: 500;
          line-height: 1.4;
          text-align: center;
          margin: 0;
        }
        .subtitle-overlay__translation {
          font-size: 14px;
          font-weight: 400;
          line-height: 1.4;
          text-align: center;
          color: rgba(255, 255, 255, 0.85);
          margin-top: 6px;
        }
        .subtitle-overlay__translation:empty {
          display: none;
        }
      `;
      document.head.appendChild(styleElement);
    }

    return () => {
      container.remove();
    };
  }, [container]);

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

  if (!isVisible) {
    return null;
  }

  const style: React.CSSProperties = {
    transform: `translate(calc(-50% + ${position.x}px), ${position.y}px)`,
  };

  const content = (
    <div
      className="subtitle-overlay"
      style={style}
      onMouseDown={handleMouseDown}
    >
      <div className="subtitle-overlay__indicator" />
      <div className="subtitle-overlay__content">
        <div className="subtitle-overlay__source">
          {sourceText || translateMessage('subtitle.listening')}
        </div>
        {translationText && (
          <div className="subtitle-overlay__translation">{translationText}</div>
        )}
      </div>
    </div>
  );

  return createPortal(content, container);
}
