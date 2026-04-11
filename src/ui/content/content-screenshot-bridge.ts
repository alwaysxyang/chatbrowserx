import {
  getRuntimeResponseData,
} from '../../shared/types/runtime-messages';
import {
  screenshotCaptureRequestType,
  type ScreenshotCaptureRuntimeResponse,
} from '../../shared/types/chat';
import { translateMessage } from '../../shared/i18n/i18n';

export async function requestVisibleTabScreenshot(): Promise<string> {
  const response = (await chrome.runtime.sendMessage({
    type: screenshotCaptureRequestType,
  })) as ScreenshotCaptureRuntimeResponse;

  return getRuntimeResponseData(response, translateMessage('error.request.failed')).dataUrl;
}
