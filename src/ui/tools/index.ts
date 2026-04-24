import { registerGetPageContentToolListener } from './get-page-content-tool';
import { registerGetPageInteractablesToolListener } from './get-page-interactables-tool';
import { registerPageActionToolListener } from './page-action-tool';

export function registerTools(): void {
  registerGetPageContentToolListener();
  registerGetPageInteractablesToolListener();
  registerPageActionToolListener();
}
