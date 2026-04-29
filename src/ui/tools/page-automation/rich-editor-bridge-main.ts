const richEditorWriteRequestEventType = 'chatbrowserx.rich-editor-write.request';
const richEditorWriteResultEventType = 'chatbrowserx.rich-editor-write.result';

interface MonacoTextModel {
  getValue?: () => string;
  setValue?: (value: string) => void;
}

interface MonacoCodeEditor {
  getDomNode?: () => HTMLElement | null;
  getModel?: () => MonacoTextModel | null;
  setValue?: (value: string) => void;
  trigger?: (source: string, handlerId: string, payload: unknown) => void;
}

interface MonacoNamespace {
  editor?: {
    getEditors?: () => readonly MonacoCodeEditor[];
  };
}

declare global {
  interface Window {
    monaco?: MonacoNamespace;
    __chatbrowserxRichEditorBridgeInstalled?: boolean;
  }
}

interface RichEditorWriteRequestDetail {
  id?: string;
  text?: string;
  clear?: boolean;
}

/**
 * Reads Monaco editor instances from the page JavaScript world.
 *
 * @returns Registered Monaco editor instances, or an empty list.
 */
function readMonacoEditors(): readonly MonacoCodeEditor[] {
  const editorNamespace = window.monaco?.editor;
  const getEditors = editorNamespace?.getEditors;
  if (typeof getEditors !== 'function') return [];
  return getEditors.call(editorNamespace) ?? [];
}

/**
 * Finds a Monaco editor whose DOM root contains the requested target.
 *
 * @param target - The DOM element that received the write request.
 * @returns The matching editor instance when present.
 */
function findMonacoEditorForTarget(target: Element): MonacoCodeEditor | undefined {
  return readMonacoEditors().find((editor) => {
    const editorNode = editor.getDomNode?.();
    return editorNode !== null &&
      editorNode !== undefined &&
      (editorNode === target || editorNode.contains(target) || target.contains(editorNode));
  });
}

/**
 * Writes text through a Monaco editor model.
 *
 * @param editor - The editor instance.
 * @param text - Text to write.
 * @param clear - Whether to replace the existing model content.
 * @returns True when a supported editor API accepted the write.
 */
function writeMonacoEditorText(editor: MonacoCodeEditor, text: string, clear: boolean): boolean {
  const model = editor.getModel?.();
  if (clear) {
    if (typeof model?.setValue === 'function') {
      model.setValue(text);
      return true;
    }
    if (typeof editor.setValue === 'function') {
      editor.setValue(text);
      return true;
    }
    return false;
  }

  if (typeof editor.trigger === 'function') {
    editor.trigger('chatbrowserx', 'type', { text });
    return true;
  }
  if (typeof model?.setValue === 'function') {
    model.setValue(`${model.getValue?.() ?? ''}${text}`);
    return true;
  }
  return false;
}

/**
 * Sends a rich editor write result back to the isolated content script.
 *
 * @param target - The original request target.
 * @param id - The request correlation ID.
 * @param ok - Whether the write succeeded.
 */
function dispatchWriteResult(target: Element, id: string | undefined, ok: boolean): void {
  target.dispatchEvent(new CustomEvent(richEditorWriteResultEventType, {
    detail: { id, ok },
  }));
}

/**
 * Handles a rich editor model write request from the isolated content script.
 *
 * @param event - The request event carrying text and replacement mode.
 */
function handleRichEditorWriteRequest(event: Event): void {
  const target = event.target;
  if (!(target instanceof Element)) return;

  const detail = (event as CustomEvent<RichEditorWriteRequestDetail>).detail;
  const text = detail?.text;
  if (typeof text !== 'string') {
    dispatchWriteResult(target, detail?.id, false);
    return;
  }

  const monacoEditor = findMonacoEditorForTarget(target);
  if (!monacoEditor) {
    dispatchWriteResult(target, detail?.id, false);
    return;
  }

  try {
    dispatchWriteResult(target, detail?.id, writeMonacoEditorText(monacoEditor, text, detail.clear === true));
  } catch {
    dispatchWriteResult(target, detail?.id, false);
  }
}

if (!window.__chatbrowserxRichEditorBridgeInstalled) {
  window.__chatbrowserxRichEditorBridgeInstalled = true;
  document.addEventListener(richEditorWriteRequestEventType, handleRichEditorWriteRequest, true);
}

export {};
