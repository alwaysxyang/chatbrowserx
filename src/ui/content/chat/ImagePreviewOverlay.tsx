import { useEffect } from 'react';
import { translateMessage } from '../../../shared/i18n/i18n';

interface ImagePreviewOverlayProps {
  src: string;
  onClose: () => void;
}

function dataUrlToBlob(dataUrl: string): Blob | null {
  if (!dataUrl.startsWith('data:')) {
    return null;
  }

  const commaIndex = dataUrl.indexOf(',');
  if (commaIndex < 0) {
    return null;
  }

  const metadata = dataUrl.slice(5, commaIndex);
  const mimeType = metadata.split(';')[0] || 'image/png';
  const rawData = dataUrl.slice(commaIndex + 1);
  const binary = metadata.split(';').includes('base64') ? atob(rawData) : decodeURIComponent(rawData);
  const bytes = new Uint8Array(binary.length);

  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }

  return new Blob([bytes], { type: mimeType });
}

async function loadImageBlob(src: string): Promise<Blob> {
  const dataUrlBlob = dataUrlToBlob(src);
  if (dataUrlBlob) {
    return dataUrlBlob;
  }

  const response = await fetch(src);
  if (!response.ok) {
    throw new Error('Failed to load preview image for clipboard copy.');
  }
  return response.blob();
}

async function copyImageToClipboard(src: string): Promise<void> {
  const ClipboardItemConstructor = globalThis.ClipboardItem;

  if (!navigator.clipboard?.write || typeof ClipboardItemConstructor !== 'function') {
    return;
  }

  const blob = await loadImageBlob(src);
  const mimeType = blob.type || 'image/png';
  await navigator.clipboard.write([new ClipboardItemConstructor({ [mimeType]: blob })]);
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
      <button
        type="button"
        className="image-preview-close"
        aria-label={closeLabel}
        onClick={(event) => {
          event.stopPropagation();
          onClose();
        }}
      >
        ×
      </button>
      <img
        className="image-preview-image"
        src={src}
        alt={label}
        onClick={(event) => {
          event.stopPropagation();
        }}
      />
    </div>
  );
}
