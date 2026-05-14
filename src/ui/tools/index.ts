import { registerPageAutomationToolListeners } from './page-automation/runtime-listeners';

/**
 * Registers all content-side tool listeners used by LLM page tools.
 */
export function registerTools(): void {
  registerPageAutomationToolListeners();
}
