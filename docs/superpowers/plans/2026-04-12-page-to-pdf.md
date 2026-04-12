# Page to PDF Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a page-to-PDF conversion feature that captures the entire scrollable page and opens a preview in a new tab with a print button.

**Architecture:** Independent PDF module in `src/ui/content/pdf/` that reuses the existing `scanPage` scroll utility. Captures screenshots during scroll, stitches them into a long image, and opens a preview page via chrome.tabs API.

**Tech Stack:** React, TypeScript, Chrome Extension APIs (tabs.captureVisibleTab, tabs.create), Canvas API for image stitching

---

## Task 1: Add Internationalization Messages

**Files:**
- Modify: `src/shared/i18n/message-catalog.ts`

- [ ] **Step 1: Add PDF-related message keys to MessageKey type**

Add these keys to the `MessageKey` union type (after line 88):

```typescript
  | 'shell.rail.pdf'
  | 'pdf.preview.title'
  | 'pdf.preview.print'
  | 'pdf.error.permission'
  | 'pdf.error.failed';
```

- [ ] **Step 2: Add translations to messages object**

Add these entries to the `messages` object (after line 193):

```typescript
  'shell.rail.pdf': { zh: '转PDF', en: 'To PDF', ja: 'PDF化' },
  'pdf.preview.title': { zh: 'PDF 预览', en: 'PDF Preview', ja: 'PDF プレビュー' },
  'pdf.preview.print': { zh: '打印', en: 'Print', ja: '印刷' },
  'pdf.error.permission': {
    zh: '截图权限被拒绝',
    en: 'Screenshot permission denied',
    ja: 'スクリーンショット権限が拒否されました',
  },
  'pdf.error.failed': {
    zh: '页面捕获失败',
    en: 'Page capture failed',
    ja: 'ページのキャプチャに失敗しました',
  },
```

- [ ] **Step 3: Verify TypeScript compiles**

Run: `npm run build`
Expected: No TypeScript errors

- [ ] **Step 4: Commit**

```bash
git add src/shared/i18n/message-catalog.ts
git commit -m "feat: add i18n messages for PDF feature"
```

---

## Task 2: Create PDF Capture Module

**Files:**
- Create: `src/ui/content/pdf/pdf-capture.ts`

- [ ] **Step 1: Create pdf directory**

```bash
mkdir -p src/ui/content/pdf
```

- [ ] **Step 2: Write pdf-capture.ts with image loading utility**

Create `src/ui/content/pdf/pdf-capture.ts`:

```typescript
/**
 * Load an image from a data URL.
 */
function loadImage(dataUrl: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error('Failed to load screenshot image'));
    image.src = dataUrl;
  });
}
```

- [ ] **Step 3: Add screenshot stitching function**

Add to `src/ui/content/pdf/pdf-capture.ts`:

```typescript
/**
 * Stitch multiple screenshot data URLs into a single vertical image.
 */
async function stitchScreenshots(dataUrls: string[]): Promise<string> {
  if (dataUrls.length === 0) {
    throw new Error('No screenshots to stitch');
  }

  const images = await Promise.all(dataUrls.map(loadImage));
  const width = Math.max(...images.map((img) => img.naturalWidth), 1);
  const height = images.reduce((sum, img) => sum + img.naturalHeight, 0) || 1;

  const canvas = document.createElement('canvas');
  const context = canvas.getContext('2d');

  if (!context) {
    throw new Error('Canvas context not available');
  }

  canvas.width = width;
  canvas.height = height;

  let offsetY = 0;
  for (const image of images) {
    context.drawImage(image, 0, offsetY);
    offsetY += image.naturalHeight;
  }

  return canvas.toDataURL('image/png');
}
```

- [ ] **Step 4: Add main capture function**

Add to `src/ui/content/pdf/pdf-capture.ts`:

```typescript
import { scanPage } from '../../tools/scroll';

const MAX_SCREENSHOTS = 50;

/**
 * Capture the entire page as a long screenshot and open preview in new tab.
 */
export async function capturePage(): Promise<void> {
  const screenshots: string[] = [];

  await scanPage({
    callback: async () => {
      if (screenshots.length === 0) {
        throw new Error('No screenshots captured');
      }

      const stitchedImage = await stitchScreenshots(screenshots);
      const previewUrl = chrome.runtime.getURL('src/ui/content/pdf/pdf-preview.html');
      const fullUrl = `${previewUrl}#${encodeURIComponent(stitchedImage)}`;

      await chrome.tabs.create({ url: fullUrl });
    },
    delayMs: 1000,
    onStep: () => {
      if (screenshots.length >= MAX_SCREENSHOTS) {
        return false;
      }

      chrome.tabs.captureVisibleTab({ format: 'png' }, (dataUrl) => {
        if (chrome.runtime.lastError) {
          console.error('Capture error:', chrome.runtime.lastError);
          return;
        }
        if (dataUrl) {
          screenshots.push(dataUrl);
        }
      });

      return undefined;
    },
  });
}
```

- [ ] **Step 5: Verify TypeScript compiles**

Run: `npm run build`
Expected: No TypeScript errors

- [ ] **Step 6: Commit**

```bash
git add src/ui/content/pdf/pdf-capture.ts
git commit -m "feat: add PDF capture logic with screenshot stitching"
```

---

## Task 3: Create PDF Preview Page HTML

**Files:**
- Create: `src/ui/content/pdf/pdf-preview.html`

- [ ] **Step 1: Write pdf-preview.html**

Create `src/ui/content/pdf/pdf-preview.html`:

```html
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>PDF Preview</title>
  <style>
    * {
      margin: 0;
      padding: 0;
      box-sizing: border-box;
    }

    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      background: #ffffff;
      display: flex;
      flex-direction: column;
      align-items: center;
      min-height: 100vh;
      padding: 20px;
    }

    #preview-image {
      max-width: 100%;
      height: auto;
      box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
      margin-bottom: 80px;
    }

    #print-button {
      position: fixed;
      bottom: 30px;
      left: 50%;
      transform: translateX(-50%);
      padding: 12px 32px;
      font-size: 16px;
      font-weight: 500;
      color: #ffffff;
      background: #2563eb;
      border: none;
      border-radius: 8px;
      cursor: pointer;
      box-shadow: 0 4px 12px rgba(37, 99, 235, 0.3);
      transition: background 0.2s;
    }

    #print-button:hover {
      background: #1d4ed8;
    }

    #print-button:active {
      background: #1e40af;
    }

    #error-message {
      color: #dc2626;
      font-size: 16px;
      text-align: center;
      padding: 20px;
    }

    @media print {
      body {
        padding: 0;
      }

      #print-button {
        display: none;
      }

      #preview-image {
        max-width: 100%;
        box-shadow: none;
        margin: 0;
      }
    }
  </style>
</head>
<body>
  <img id="preview-image" alt="Page preview" style="display: none;" />
  <button id="print-button" style="display: none;">Print</button>
  <div id="error-message" style="display: none;"></div>
  <script src="pdf-preview-page.js"></script>
</body>
</html>
```

- [ ] **Step 2: Verify file created**

Run: `ls -la src/ui/content/pdf/pdf-preview.html`
Expected: File exists

- [ ] **Step 3: Commit**

```bash
git add src/ui/content/pdf/pdf-preview.html
git commit -m "feat: add PDF preview page HTML template"
```

---

## Task 4: Create PDF Preview Page Script

**Files:**
- Create: `src/ui/content/pdf/pdf-preview-page.ts`

- [ ] **Step 1: Write pdf-preview-page.ts**

Create `src/ui/content/pdf/pdf-preview-page.ts`:

```typescript
/**
 * PDF Preview Page Script
 * Loads the captured page image from URL hash and provides print functionality.
 */

function showError(message: string): void {
  const errorElement = document.getElementById('error-message');
  if (errorElement) {
    errorElement.textContent = message;
    errorElement.style.display = 'block';
  }
}

function initPreview(): void {
  const hash = window.location.hash.slice(1);
  
  if (!hash) {
    showError('No image data provided');
    return;
  }

  const dataUrl = decodeURIComponent(hash);
  
  if (!dataUrl.startsWith('data:image/')) {
    showError('Invalid image data');
    return;
  }

  const imageElement = document.getElementById('preview-image') as HTMLImageElement;
  const printButton = document.getElementById('print-button') as HTMLButtonElement;

  if (!imageElement || !printButton) {
    showError('Page elements not found');
    return;
  }

  imageElement.onload = () => {
    imageElement.style.display = 'block';
    printButton.style.display = 'block';
  };

  imageElement.onerror = () => {
    showError('Failed to load image');
  };

  imageElement.src = dataUrl;

  printButton.addEventListener('click', () => {
    window.print();
  });
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initPreview);
} else {
  initPreview();
}
```

- [ ] **Step 2: Verify TypeScript compiles**

Run: `npm run build`
Expected: No TypeScript errors

- [ ] **Step 3: Commit**

```bash
git add src/ui/content/pdf/pdf-preview-page.ts
git commit -m "feat: add PDF preview page script"
```

---

## Task 5: Update Vite Config for Preview Page

**Files:**
- Modify: `vite.config.ts`

- [ ] **Step 1: Add pdf-preview to rollup inputs**

Modify the `build.rollupOptions.input` object (around line 29):

```typescript
  build: {
    rollupOptions: {
      input: {
        offscreen: 'src/background/speech/offscreen.html',
        'audio-processor': 'src/background/speech/audio-processor.js',
        'pdf-preview-page': 'src/ui/content/pdf/pdf-preview-page.ts',
      },
    },
  },
```

- [ ] **Step 2: Verify TypeScript compiles**

Run: `npm run build`
Expected: No TypeScript errors, pdf-preview-page.js generated in dist

- [ ] **Step 3: Commit**

```bash
git add vite.config.ts
git commit -m "build: add PDF preview page to vite build config"
```

---

## Task 6: Update Manifest for Preview Page

**Files:**
- Modify: `manifest.config.ts`

- [ ] **Step 1: Add pdf-preview.html to web_accessible_resources**

Modify the `web_accessible_resources` array (around line 33):

```typescript
  web_accessible_resources: [
    {
      resources: [
        'src/background/speech/offscreen.html',
        'src/background/speech/audio-processor.js',
        'src/ui/content/pdf/pdf-preview.html',
      ],
      matches: ['<all_urls>'],
    },
  ],
```

- [ ] **Step 2: Verify build works**

Run: `npm run build`
Expected: No errors, manifest includes pdf-preview.html

- [ ] **Step 3: Commit**

```bash
git add manifest.config.ts
git commit -m "build: add PDF preview page to web accessible resources"
```

---

## Task 7: Update ShellRail Component

**Files:**
- Modify: `src/ui/content/ShellRail.tsx`

- [ ] **Step 1: Add FileText icon import**

Modify the import statement at line 1:

```typescript
import { MessageCircleMore, Settings2, Mic, Square, FileText } from 'lucide-react';
```

- [ ] **Step 2: Add props to ShellRailProps interface**

Modify the interface (around line 4):

```typescript
interface ShellRailProps {
  activeView: 'chat' | 'settings';
  onSelectView: (view: 'chat' | 'settings') => void;
  onVoiceToggle?: (isActive: boolean) => void;
  isVoiceActive?: boolean;
  onPdfCapture?: () => void;
  isPdfCapturing?: boolean;
}
```

- [ ] **Step 3: Update function signature**

Modify the function signature (around line 11):

```typescript
export function ShellRail({ 
  activeView, 
  onSelectView, 
  onVoiceToggle, 
  isVoiceActive = false,
  onPdfCapture,
  isPdfCapturing = false,
}: ShellRailProps) {
```

- [ ] **Step 4: Add PDF button after voice button**

Add this button after the voice button (after line 44, before the spacer):

```typescript
      <button
        aria-label={translateMessage('shell.rail.pdf')}
        aria-pressed={isPdfCapturing}
        className={`rail-button ${isPdfCapturing ? 'rail-button-active' : ''}`}
        data-tooltip={translateMessage('shell.rail.pdf')}
        type="button"
        onClick={() => onPdfCapture?.()}
        disabled={isPdfCapturing}
      >
        <span className="rail-icon">
          <FileText className="h-3 w-3" strokeWidth={2.2} />
        </span>
        <span>{translateMessage('shell.rail.pdf')}</span>
      </button>
```

- [ ] **Step 5: Verify TypeScript compiles**

Run: `npm run build`
Expected: No TypeScript errors

- [ ] **Step 6: Commit**

```bash
git add src/ui/content/ShellRail.tsx
git commit -m "feat: add PDF button to ShellRail"
```

---

## Task 8: Update ContentApp Component

**Files:**
- Modify: `src/ui/content/ContentApp.tsx`

- [ ] **Step 1: Add import for capturePage**

Add import at the top (after line 14):

```typescript
import { capturePage } from './pdf/pdf-capture';
```

- [ ] **Step 2: Add import for useState**

Modify the React import at line 1:

```typescript
import { useMemo, useState } from 'react';
```

- [ ] **Step 3: Add isPdfCapturing state**

Add state after line 39 (after the useContentShell hook):

```typescript
  const [isPdfCapturing, setIsPdfCapturing] = useState(false);
```

- [ ] **Step 4: Add handlePdfCapture function**

Add this function after the handleVoiceToggle function (after line 47):

```typescript
  const handlePdfCapture = async () => {
    setIsPdfCapturing(true);
    try {
      await new Promise((resolve) => setTimeout(resolve, 100));
      await capturePage();
    } catch (error) {
      console.error('PDF capture error:', error);
    } finally {
      setIsPdfCapturing(false);
    }
  };
```

- [ ] **Step 5: Update sidebar className to include PDF capturing state**

Modify the className at line 54:

```typescript
          className={`sidebar-shell ${screenshotSession || isPdfCapturing ? 'sidebar-shell-hidden-for-screenshot' : ''}`}
```

- [ ] **Step 6: Pass PDF props to ShellRail**

Modify the ShellRail component (around line 115):

```typescript
              <ShellRail
                activeView={activeView}
                onSelectView={setActiveView}
                onVoiceToggle={handleVoiceToggle}
                isVoiceActive={subtitle.isActive}
                onPdfCapture={handlePdfCapture}
                isPdfCapturing={isPdfCapturing}
              />
```

- [ ] **Step 7: Verify TypeScript compiles**

Run: `npm run build`
Expected: No TypeScript errors

- [ ] **Step 8: Commit**

```bash
git add src/ui/content/ContentApp.tsx
git commit -m "feat: integrate PDF capture into ContentApp"
```

---

## Task 9: Manual Testing

**Files:**
- None (testing only)

- [ ] **Step 1: Build the extension**

Run: `npm run build`
Expected: Build completes successfully

- [ ] **Step 2: Load extension in Chrome**

1. Open Chrome and go to `chrome://extensions/`
2. Enable "Developer mode"
3. Click "Load unpacked"
4. Select the `dist` folder
Expected: Extension loads without errors

- [ ] **Step 3: Test on a short page**

1. Navigate to a short webpage (e.g., `example.com`)
2. Open the extension sidebar
3. Click the "转PDF" button
Expected: 
- Sidebar hides
- Page doesn't scroll (already fits in viewport)
- New tab opens with preview
- Print button appears at bottom

- [ ] **Step 4: Test print functionality**

1. In the preview tab, click "打印" button
Expected: Browser print dialog opens

- [ ] **Step 5: Test on a long page**

1. Navigate to a long webpage (e.g., a long article or documentation page)
2. Open the extension sidebar
3. Click the "转PDF" button
Expected:
- Sidebar hides
- Page scrolls automatically with 1s delays
- Toast shows "滚动中..." during scroll
- New tab opens with full page preview
- Image shows entire scrolled content

- [ ] **Step 6: Verify sidebar restoration**

After PDF capture completes:
Expected: Sidebar becomes visible again

- [ ] **Step 7: Test translations**

1. Change UI language in settings to English
2. Click PDF button
Expected: Button shows "To PDF"

3. Change to Japanese
Expected: Button shows "PDF化"

- [ ] **Step 8: Document test results**

Create a test summary noting:
- Which pages were tested
- Any issues encountered
- Performance observations

---

## Implementation Notes

**Testing Strategy:**
- Manual testing only (no automated tests for this feature initially)
- Test on various page lengths and content types
- Verify memory usage on very long pages

**Error Handling:**
- Console logging for debugging
- Future enhancement: user-facing error toasts

**Performance Considerations:**
- 1s delay balances speed vs content loading
- Max 50 screenshots prevents memory issues
- Canvas operations are synchronous and fast

**Future Enhancements:**
- Configurable delay time in settings
- Progress indicator during capture
- Actual PDF generation instead of image
- User-facing error messages
