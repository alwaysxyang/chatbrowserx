# Page to PDF Feature Design

## Overview

Add a page-to-PDF conversion feature that allows users to capture the entire page (including scrollable content) and preview it in a new tab with a print button.

## Requirements

1. Add a "转PDF" button in the left rail below the voice button
2. Capture the entire page including scrollable content
3. Hide the extension sidebar during capture
4. Show preview in a new browser tab with a print button at the bottom
5. Use browser's native print functionality
6. Place implementation in `src/ui/content/pdf/` module
7. Reuse `scroll.ts` utilities for scrolling with 1s delay
8. Restore sidebar visibility after capture completes

## Architecture

### Module Structure

```
src/ui/content/pdf/
├── pdf-capture.ts          # Capture logic: scanPage + screenshot stitching
├── pdf-preview.html         # Preview page template
└── pdf-preview-page.ts      # Preview page script
```

### Modified Files

- `src/ui/content/ShellRail.tsx` - Add PDF button
- `src/ui/content/ContentApp.tsx` - Add capture state management
- `src/shared/i18n/message-catalog.ts` - Add translations

## User Flow

1. User clicks "转PDF" button in ShellRail
2. Extension sidebar hides (using existing `sidebar-shell-hidden-for-screenshot` class)
3. Page scrolls automatically with 1s delay between steps
4. Each viewport is captured via `chrome.tabs.captureVisibleTab()`
5. All screenshots are stitched into a single long image
6. New tab opens showing the preview image
7. Extension sidebar becomes visible again
8. User can click "打印" button to print using `window.print()`

## Component Design

### ShellRail Button

**Location**: Between voice button and settings button (after voice, before the spacer)

**Visual Design**:
- Icon: `FileText` from lucide-react (h-3 w-3, strokeWidth 2.2)
- Style: Reuse existing `rail-button` class
- Label: Translated text for "转PDF"

**Props Addition**:
```typescript
interface ShellRailProps {
  // ... existing props
  onPdfCapture?: () => void;
  isPdfCapturing?: boolean;
}
```

### ContentApp State

**New State**:
```typescript
const [isPdfCapturing, setIsPdfCapturing] = useState(false);
```

**Sidebar Visibility**:
- Apply `sidebar-shell-hidden-for-screenshot` class when `isPdfCapturing` is true
- Reuse existing pattern from screenshot functionality

**Handler**:
```typescript
const handlePdfCapture = async () => {
  setIsPdfCapturing(true);
  try {
    await capturePage();
  } finally {
    setIsPdfCapturing(false);
  }
};
```

## Data Flow

### Capture Process

1. **Initialization**
   - Hide sidebar by setting `isPdfCapturing = true`
   - Wait briefly (100ms) for DOM to update

2. **Scrolling & Capturing**
   - Call `scanPage` from `src/ui/tools/scroll.ts` with:
     - `delayMs: 1000` (1 second delay between scrolls)
     - `onStep` callback to capture each viewport
   - In each `onStep`:
     - Call `chrome.tabs.captureVisibleTab()` to get current viewport screenshot
     - Store dataURL in array

3. **Stitching**
   - Calculate total height = sum of all screenshot heights
   - Calculate width = max width of all screenshots
   - Create canvas with calculated dimensions
   - Draw each screenshot vertically with cumulative offsetY
   - Export as single dataURL via `canvas.toDataURL('image/png')`

4. **Preview**
   - Open new tab with `chrome.tabs.create({ url: 'pdf-preview.html#<dataURL>' })`
   - Pass image dataURL via URL hash
   - Restore sidebar by setting `isPdfCapturing = false`

### Preview Page

**Data Loading**:
```typescript
const dataUrl = decodeURIComponent(location.hash.slice(1));
```

**Display**:
- Center image on white background
- Fixed print button at bottom center
- Responsive layout

**Print Action**:
- Button calls `window.print()`
- Print CSS hides button, shows only image

## Implementation Details

### pdf-capture.ts

**Exports**:
```typescript
export async function capturePage(): Promise<void>
```

**Algorithm**:
1. Collect screenshots using `scanPage` with `onStep` callback
2. Stitch screenshots using canvas API
3. Open preview tab with image dataURL in hash

**Error Handling**:
- Permission denied: Log error, show toast (future enhancement)
- Capture failed: Log error, restore sidebar
- Memory limit: Limit max screenshots to 50

### pdf-preview.html

**Structure**:
```html
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>PDF Preview</title>
  <style>
    /* Styles for preview and print */
  </style>
</head>
<body>
  <img id="preview-image" alt="Page preview" />
  <button id="print-button">打印</button>
  <script src="pdf-preview-page.js"></script>
</body>
</html>
```

**Styles**:
- Body: white background, centered content
- Image: max-width 100%, auto height, centered
- Button: fixed bottom center, styled with padding and border-radius
- Print media query: hide button, show only image

### pdf-preview-page.ts

**Responsibilities**:
1. Read dataURL from `location.hash`
2. Set image src
3. Attach print button click handler
4. Handle errors (missing data, invalid image)

## Internationalization

**New Message Keys**:

```typescript
'shell.rail.pdf': { zh: '转PDF', en: 'To PDF', ja: 'PDF化' }
'pdf.preview.title': { zh: 'PDF 预览', en: 'PDF Preview', ja: 'PDF プレビュー' }
'pdf.preview.print': { zh: '打印', en: 'Print', ja: '印刷' }
'pdf.error.permission': { 
  zh: '截图权限被拒绝', 
  en: 'Screenshot permission denied', 
  ja: 'スクリーンショット権限が拒否されました' 
}
'pdf.error.failed': { 
  zh: '页面捕获失败', 
  en: 'Page capture failed', 
  ja: 'ページのキャプチャに失敗しました' 
}
```

**Usage**:
- ShellRail button: `shell.rail.pdf`
- Preview page title: `pdf.preview.title`
- Print button: `pdf.preview.print`
- Error messages: `pdf.error.*` (for future toast notifications)

## Technical Considerations

### Permissions

Required Chrome extension permissions (should already exist):
- `activeTab` - for capturing visible tab
- `tabs` - for creating new tab

### Performance

**Memory Management**:
- Each screenshot is a dataURL (base64 encoded PNG)
- Typical viewport: ~1920x1080 = ~500KB per screenshot
- Long page (10 screens): ~5MB total
- Limit: Max 50 screenshots to prevent memory issues

**Optimization**:
- Use 1s delay to ensure content loads
- Canvas operations are synchronous and fast
- dataURL transfer via hash is instant (no network)

### Browser Compatibility

- Canvas API: Supported in all modern browsers
- `chrome.tabs.captureVisibleTab`: Chrome extension API
- `window.print()`: Universal browser API
- URL hash: Universal

### Edge Cases

1. **Very long pages**: Limit to 50 screenshots max
2. **Dynamic content**: 1s delay should handle most lazy-loading
3. **Popup blockers**: New tab may be blocked (user must allow)
4. **Infinite scroll**: `scanPage` has max iterations (128)
5. **Fixed elements**: Will appear in each screenshot (expected behavior)

## Testing Strategy

**Manual Testing**:
1. Short page (no scroll): Single screenshot
2. Long page (multiple screens): Multiple screenshots stitched
3. Very long page: Verify max limit works
4. Dynamic content: Verify 1s delay loads content
5. Print functionality: Verify browser print dialog works
6. Sidebar visibility: Verify hide/show works correctly

**Test Cases**:
- Button appears in correct position
- Button triggers capture
- Sidebar hides during capture
- Sidebar restores after capture
- Preview opens in new tab
- Image displays correctly
- Print button works
- Translations display correctly

## Future Enhancements

1. **Settings**: Allow user to configure delay time
2. **Progress indicator**: Show capture progress (X/Y screenshots)
3. **Error toasts**: User-friendly error messages
4. **PDF generation**: Generate actual PDF instead of image
5. **Watermark**: Optional watermark on generated PDF
6. **Crop options**: Allow user to select capture area

## Why This Design

**Independent Module**: PDF conversion is a standalone feature, not tied to chat functionality. Separate module improves maintainability.

**Reuse scanPage**: Existing scroll logic is well-tested and handles edge cases (dynamic content, scroll containers, etc.).

**Image Preview**: Simpler than PDF generation, works universally, and browser print can convert to PDF if needed.

**New Tab Preview**: Allows user to review before printing, doesn't interrupt current page context, and provides clean print experience.

**1s Delay**: Balances capture speed with content loading time. User can see progress, and dynamic content has time to render.
