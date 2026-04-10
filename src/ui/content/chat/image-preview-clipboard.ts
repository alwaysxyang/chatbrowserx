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

export async function copyImageToClipboard(src: string): Promise<void> {
  const ClipboardItemConstructor = globalThis.ClipboardItem;

  if (!navigator.clipboard?.write || typeof ClipboardItemConstructor !== 'function') {
    return;
  }

  const blob = await loadImageBlob(src);
  const mimeType = blob.type || 'image/png';
  await navigator.clipboard.write([new ClipboardItemConstructor({ [mimeType]: blob })]);
}
