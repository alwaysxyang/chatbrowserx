export interface ScreenshotRect {
  left: number;
  top: number;
  width: number;
  height: number;
}

export interface ScreenshotDocumentRange {
  startY: number;
  endY: number;
}

export interface CapturedLongScreenshotChunk extends ScreenshotDocumentRange {
  dataUrl: string;
}
