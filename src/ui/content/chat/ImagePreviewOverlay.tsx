import { useEffect } from 'react';
import { copyImageToClipboard } from './clipboard/image-clipboard';
import { translateMessage } from '../../../shared/i18n/i18n';

interface ImagePreviewOverlayProps {
  src: string;
  onClose: () => void;
}

export function ImagePreviewOverlay({ src, onClose }: ImagePreviewOverlayProps) {
  const label = translateMessage('chat.imagePreview.label');
  const closeLabel = translateMessage('chat.imagePreview.close');

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        onClose();
        return;
      }

      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'c') {
        event.preventDefault();
        void copyImageToClipboard(src);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose, src]);

  return (
    <div
      className="image-preview-dialog"
      data-testid="image-preview-dialog"
      role="dialog"
      aria-label={label}
      aria-modal="true"
      onClick={onClose}
    >
      <div
        className="image-preview-stage"
        data-testid="image-preview-stage"
        onClick={(event) => {
          event.stopPropagation();
        }}
      >
        <button
          type="button"
          className="image-preview-close"
          aria-label={closeLabel}
          style={{ position: 'absolute', top: 0, right: 0, borderRadius: '999px', caretColor: 'transparent' }}
          onMouseDown={(event) => event.preventDefault()}
          onClick={(event) => {
            event.stopPropagation();
            onClose();
          }}
        >
          ×
        </button>
        <img className="image-preview-image" src={src} alt={label} />
      </div>
    </div>
  );
}
