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
