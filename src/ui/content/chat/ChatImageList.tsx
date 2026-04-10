import { translateMessage } from '../../../shared/i18n/i18n';

interface ChatImageListProps {
  imageUrls: string[];
  disabled: boolean;
  onRemoveImage: (index: number) => void;
  onPreviewImage?: (src: string) => void;
}

export function ChatImageList({
  imageUrls,
  disabled,
  onRemoveImage,
  onPreviewImage,
}: ChatImageListProps) {
  if (!imageUrls.length) {
    return null;
  }

  return (
    <div className="chat-screenshot-preview-list">
      {imageUrls.map((imageUrl, index) => (
        <div className="chat-screenshot-preview" key={`${imageUrl}-${index}`}>
          <img
            className="chat-screenshot-preview-image"
            src={imageUrl}
            alt={translateMessage('chat.screenshot.previewAlt')}
            onDoubleClick={() => {
              onPreviewImage?.(imageUrl);
            }}
          />
          <button
            className="chat-screenshot-remove"
            type="button"
            aria-label={translateMessage('chat.screenshot.remove')}
            onMouseDown={(event) => event.preventDefault()}
            onClick={() => onRemoveImage(index)}
            disabled={disabled}
          >
            ×
          </button>
        </div>
      ))}
    </div>
  );
}
