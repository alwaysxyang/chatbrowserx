import { registerGetPageContentToolListener } from './get-page-content-tool';
import { registerPageAutomationToolListeners } from './page-automation/runtime-listeners';

export function registerTools(): void {
  registerGetPageContentToolListener();
  registerPageAutomationToolListeners();
}
