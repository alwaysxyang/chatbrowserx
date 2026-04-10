import {
  screenshotCaptureRequestType,
  type ScreenshotCaptureRuntimeResponse,
} from '../../shared/types/runtime-messages';
import { translateMessage } from '../../shared/i18n/i18n';

export async function requestVisibleTabScreenshot(): Promise<string> {
  const response = (await chrome.runtime.sendMessage({
    type: screenshotCaptureRequestType,
  })) as ScreenshotCaptureRuntimeResponse;

  if (!response?.ok) {
    throw new Error(response?.error || translateMessage('error.request.failed'));
  }

  return response.data.dataUrl;
}
