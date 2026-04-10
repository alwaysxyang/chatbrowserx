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

function loadImageBlob(src: string): Promise<Blob> {
  const dataUrlBlob = dataUrlToBlob(src);
  if (dataUrlBlob) {
    return Promise.resolve(dataUrlBlob);
  }

  return fetch(src).then((response) => {
    if (!response.ok) {
      throw new Error('Failed to load preview image for clipboard copy.');
    }

    return response.blob();
  });
}

export function readImageFileAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();

    reader.onload = () => {
      if (typeof reader.result === 'string') {
        resolve(reader.result);
        return;
      }

      reject(new Error('Pasted image could not be read as a data URL.'));
    };
    reader.onerror = () => reject(new Error('Pasted image could not be read.'));
    reader.readAsDataURL(file);
  });
}

export function getClipboardImageFiles(clipboardData: DataTransfer): File[] {
  const itemFiles = Array.from(clipboardData.items ?? [])
    .filter((item) => item.kind === 'file' && item.type.startsWith('image/'))
    .map((item) => item.getAsFile())
    .filter((file): file is File => file instanceof File);

  if (itemFiles.length) {
    return itemFiles;
  }

  return Array.from(clipboardData.files ?? []).filter((file) => file.type.startsWith('image/'));
}

export function readClipboardImagesAsDataUrls(clipboardData: DataTransfer): Promise<string[]> {
  return Promise.all(getClipboardImageFiles(clipboardData).map(readImageFileAsDataUrl));
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
