import { scanPage } from '../../tools/page-content/page-scanner';
import { requestVisibleTabScreenshot } from '../content-screenshot-bridge';

const MAX_SCREENSHOTS = 50;

/**
 * Capture the entire page as a long screenshot and open preview in new tab.
 */
export async function capturePage(): Promise<void> {
  const screenshots: string[] = [];

  try {
    await scanPage({
      callback: async () => {
        if (screenshots.length === 0) {
          throw new Error('No screenshots captured');
        }

        console.log(`Captured ${screenshots.length} screenshots, opening preview...`);

        // Open preview in new window with inline HTML
        const win = window.open('', '_blank');
        if (win) {
          win.document.write(`
            <html>
              <head>
                <title>PDF Preview - ChatBrowserX</title>
                <style>
                  body {
                    margin: 0;
                    padding: 20px;
                    background: #f0f2f5;
                    display: flex;
                    flex-direction: column;
                    align-items: center;
                    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
                  }
                  .page-container {
                    background: white;
                    box-shadow: 0 4px 6px rgba(0,0,0,0.1);
                    margin-bottom: 20px;
                    max-width: 100%;
                  }
                  img {
                    display: block;
                    max-width: 100%;
                    width: auto;
                  }
                  @media print {
                    body { background: white; padding: 0; display: block; }
                    .page-container { box-shadow: none; margin: 0; page-break-after: always; width: 100%; }
                    .page-container:last-child { page-break-after: auto; }
                    img { width: 100%; height: auto; }
                    .toolbar { display: none !important; }
                  }
                  .toolbar {
                    position: fixed;
                    top: 20px;
                    right: 20px;
                    background: white;
                    padding: 10px;
                    border-radius: 8px;
                    display: flex;
                    gap: 10px;
                    box-shadow: 0 4px 12px rgba(0,0,0,0.15);
                    z-index: 100;
                  }
                  button {
                    padding: 8px 16px;
                    cursor: pointer;
                    background: #2563eb;
                    color: white;
                    border: none;
                    border-radius: 4px;
                    font-size: 14px;
                    font-weight: 500;
                  }
                  button:hover { background: #1d4ed8; }
                </style>
              </head>
              <body>
                <div class="toolbar">
                  <button id="print-btn">🖨️ Print / Save as PDF</button>
                </div>
                ${screenshots.map(src => `<div class="page-container"><img src="${src}" /></div>`).join('')}
              </body>
            </html>
          `);
          win.document.close();

          // Attach event listener via JS to avoid inline handler CSP issues
          // Use setTimeout to ensure DOM is ready in the new window
          setTimeout(() => {
            const btn = win.document.getElementById('print-btn');
            if (btn) {
              btn.onclick = () => {
                win.print();
              };
            }
          }, 100);
        }
      },
      delayMs: 1000,
      onStep: async () => {
        if (screenshots.length >= MAX_SCREENSHOTS) {
          return false;
        }

        try {
          const dataUrl = await requestVisibleTabScreenshot();
          screenshots.push(dataUrl);
          console.log(`Captured screenshot ${screenshots.length}`);
        } catch (error) {
          console.error('Capture error:', error);
        }

        return undefined;
      },
    });
  } finally {
    // No need to restore sidebar - ContentApp will handle it
  }
}
