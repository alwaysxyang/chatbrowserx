import {
  isScreenshotCaptureRequestMessage,
  type ScreenshotCaptureRuntimeResponse,
  toRuntimeResponse,
} from '../../shared/types/runtime-messages';

async function captureVisibleTab(sender: chrome.runtime.MessageSender): Promise<string> {
  const dataUrl =
    sender.tab?.windowId == null
      ? await chrome.tabs.captureVisibleTab({ format: 'png' })
      : await chrome.tabs.captureVisibleTab(sender.tab.windowId, { format: 'png' });

  if (!dataUrl) {
    throw new Error('Screenshot capture returned an empty image.');
  }

  return dataUrl;
}

export function registerScreenshotCaptureHandler(): void {
  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (!isScreenshotCaptureRequestMessage(message)) {
      return undefined;
    }

    void toRuntimeResponse(captureVisibleTab(sender).then((dataUrl) => ({ dataUrl }))).then((response) => {
      sendResponse(response satisfies ScreenshotCaptureRuntimeResponse);
    });

    return true;
  });
}
