import { beforeEach, describe, expect, it, vi } from 'vitest';
import { executePageAction } from '../../../src/ui/tools/page-automation/action-executor';
import { readCurrentPageInteractables } from '../../../src/ui/tools/page-automation/interactable-scanner';
import { registerPageActionToolListener } from '../../../src/ui/tools/page-automation/runtime-listeners';

function makeRect(x: number, y: number, width: number, height: number): DOMRect {
  return {
    x,
    y,
    width,
    height,
    top: y,
    left: x,
    right: x + width,
    bottom: y + height,
    toJSON: () => ({}),
  } as DOMRect;
}

function setRect(element: Element, rect: DOMRect): void {
  vi.spyOn(element, 'getBoundingClientRect').mockReturnValue(rect);
}

function spyElementFromPoint(documentObject: Document, element: Element): void {
  Object.defineProperty(documentObject, 'elementFromPoint', {
    configurable: true,
    value: vi.fn(() => element),
  });
}

/**
 * Sets viewport dimensions for geometry-sensitive action tests.
 */
function setViewportSize(width: number, height: number): void {
  Object.defineProperty(window, 'innerWidth', { configurable: true, value: width });
  Object.defineProperty(window, 'innerHeight', { configurable: true, value: height });
}

/**
 * Replaces window.scrollBy with a mock and returns it for assertions.
 */
function mockWindowScrollBy(): ReturnType<typeof vi.fn> {
  const scrollByMock = vi.fn();
  Object.defineProperty(window, 'scrollBy', { configurable: true, value: scrollByMock });
  return scrollByMock;
}

/**
 * Gives an element deterministic scroll metrics in jsdom.
 */
function setScrollableMetrics(element: HTMLElement): void {
  Object.defineProperty(element, 'clientHeight', { configurable: true, value: 400 });
  Object.defineProperty(element, 'scrollHeight', { configurable: true, value: 1200 });
  Object.defineProperty(element, 'scrollTop', { configurable: true, writable: true, value: 0 });
}

describe('page action content tool', () => {
  beforeEach(() => {
  });

  it('clicks an element by the latest interactables ref', async () => {
    document.body.innerHTML = '<button id="submit">Submit</button>';
    const button = document.getElementById('submit')!;
    const clickListener = vi.fn();
    button.addEventListener('click', clickListener);
    setRect(button, makeRect(10, 20, 100, 40));
    spyElementFromPoint(document, button);
    const snapshot = readCurrentPageInteractables(document, window);

    await expect(executePageAction({ action: 'click', sid: snapshot.sid, ref: 'e1' }, document, window)).resolves.toEqual({
      ok: true,
      action: 'click',
      ref: 'e1',
      changed: false,
    });
    expect(clickListener).toHaveBeenCalledTimes(1);
  });

  it('dispatches click while the virtual cursor is still at the target point', async () => {
    document.body.innerHTML = '<button id="submit">Submit</button>';
    const button = document.getElementById('submit')!;
    setRect(button, makeRect(10, 20, 100, 40));
    spyElementFromPoint(document, button);
    const snapshot = readCurrentPageInteractables(document, window);

    button.addEventListener('click', () => {
      const cursor = document.querySelector<HTMLElement>('[data-role="virtual-cursor"]');
      expect(cursor?.style.opacity).toBe('1');
      expect(cursor?.style.transform).toContain('60px');
      expect(cursor?.style.transform).toContain('40px');
    });

    await executePageAction({ action: 'click', sid: snapshot.sid, ref: 'e1' }, document, window);
  });

  it('returns before and after checked state for checkbox clicks', async () => {
    document.body.innerHTML = '<input id="agree" type="checkbox" aria-label="Agree" />';
    const checkbox = document.getElementById('agree') as HTMLInputElement;
    setRect(checkbox, makeRect(10, 20, 20, 20));
    spyElementFromPoint(document, checkbox);
    const snapshot = readCurrentPageInteractables(document, window);

    await expect(executePageAction({ action: 'click', sid: snapshot.sid, ref: 'e1' }, document, window)).resolves.toEqual({
      ok: true,
      action: 'click',
      ref: 'e1',
      changed: true,
      stateBefore: { checked: false },
      stateAfter: { checked: true },
    });
  });

  it('reports state from the nearest stateful ancestor when a nested ref is clicked', async () => {
    document.body.innerHTML = `
      <div id="choice" role="checkbox" aria-checked="false">
        <span id="label" role="button">A. Nested option</span>
      </div>
    `;
    const choice = document.getElementById('choice')!;
    const label = document.getElementById('label')!;
    choice.addEventListener('click', () => {
      choice.setAttribute('aria-checked', 'true');
    });
    setRect(choice, makeRect(10, 20, 240, 40));
    setRect(label, makeRect(36, 28, 180, 22));
    spyElementFromPoint(document, label);
    const snapshot = readCurrentPageInteractables(document, window);

    await expect(executePageAction({ action: 'click', sid: snapshot.sid, ref: 'e2' }, document, window)).resolves.toEqual({
      ok: true,
      action: 'click',
      ref: 'e2',
      changed: true,
      stateBefore: { checked: false },
      stateAfter: { checked: true },
    });
  });

  it('types into an input by ref and dispatches input/change events', async () => {
    document.body.innerHTML = '<input id="q" aria-label="Search" value="old" />';
    const input = document.getElementById('q') as HTMLInputElement;
    const inputListener = vi.fn();
    const changeListener = vi.fn();
    input.addEventListener('input', inputListener);
    input.addEventListener('change', changeListener);
    setRect(input, makeRect(10, 20, 200, 32));
    spyElementFromPoint(document, input);
    const snapshot = readCurrentPageInteractables(document, window);

    await expect(executePageAction({ action: 'type', sid: snapshot.sid, ref: 'e1', text: 'hello', clear: true }, document, window)).resolves.toEqual({
      ok: true,
      action: 'type',
      ref: 'e1',
      changed: true,
      stateBefore: { value: 'old' },
      stateAfter: { value: 'hello' },
    });
    expect(input.value).toBe('hello');
    expect(inputListener).toHaveBeenCalledTimes(1);
    expect(changeListener).toHaveBeenCalledTimes(1);
  });

  it('types into an editable descendant when the ref is a code editor container', async () => {
    document.body.innerHTML = `
      <div id="editor" class="cm-editor" aria-label="Code editor">
        <div id="content" contenteditable="true">old code</div>
      </div>
    `;
    const editor = document.getElementById('editor')!;
    const content = document.getElementById('content')!;
    const inputListener = vi.fn();
    content.addEventListener('input', inputListener);
    setRect(editor, makeRect(10, 20, 400, 220));
    setRect(content, makeRect(20, 30, 380, 200));
    spyElementFromPoint(document, editor);
    const snapshot = readCurrentPageInteractables(document, window);

    await expect(executePageAction({ action: 'type', sid: snapshot.sid, ref: 'e1', text: 'new code', clear: true }, document, window)).resolves.toEqual({
      ok: true,
      action: 'type',
      ref: 'e1',
      changed: true,
      stateBefore: { text: 'old code' },
      stateAfter: { text: 'new code' },
    });
    expect(content.textContent).toBe('new code');
    expect(inputListener).toHaveBeenCalledTimes(1);
  });

  it('types into a Monaco input area when hit testing lands on presentation lines', async () => {
    document.body.innerHTML = `
      <div id="editor" class="monaco-editor" aria-label="Code Editor">
        <textarea id="input" class="inputarea monaco-mouse-cursor-text" aria-label="Editor input">old code</textarea>
        <div class="view-lines monaco-mouse-cursor-text" role="presentation" aria-hidden="true">
          <div id="line" class="view-line">old code</div>
        </div>
      </div>
    `;
    const editor = document.getElementById('editor')!;
    const input = document.getElementById('input') as HTMLTextAreaElement;
    const line = document.getElementById('line')!;
    const inputListener = vi.fn();
    let selectedAll = false;
    input.addEventListener('keydown', (event) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'a') {
        selectedAll = true;
      }
    });
    const pasteListener = vi.fn((event: ClipboardEvent) => {
      const pastedText = event.clipboardData?.getData('text/plain') ?? '';
      line.textContent = selectedAll ? pastedText : `${line.textContent ?? ''}${pastedText}`;
      event.preventDefault();
    });
    input.addEventListener('input', inputListener);
    input.addEventListener('paste', pasteListener);
    setRect(editor, makeRect(10, 20, 797, 208));
    setRect(input, makeRect(10, 20, 1, 1));
    setRect(line, makeRect(10, 28, 797, 20));
    spyElementFromPoint(document, line);
    const snapshot = readCurrentPageInteractables(document, window);

    await expect(executePageAction({ action: 'type', sid: snapshot.sid, ref: 'e1', text: 'new code', clear: true }, document, window)).resolves.toMatchObject({
      ok: true,
      action: 'type',
      ref: 'e1',
      changed: true,
      stateAfter: { value: 'new code' },
    });
    expect(input.value).toBe('new code');
    expect(line.textContent).toBe('new code');
    expect(selectedAll).toBe(true);
    expect(pasteListener).toHaveBeenCalledTimes(1);
    expect(inputListener).toHaveBeenCalledTimes(1);
  });

  it('deletes existing editor text before native clear insertion', async () => {
    document.body.innerHTML = `
      <div id="editor" class="monaco-editor" aria-label="Code Editor">
        <textarea id="input" class="inputarea monaco-mouse-cursor-text" aria-label="Editor input"></textarea>
        <div class="view-lines monaco-mouse-cursor-text" role="presentation" aria-hidden="true">
          <div id="line" class="view-line">old code</div>
        </div>
      </div>
    `;
    const editor = document.getElementById('editor')!;
    const input = document.getElementById('input') as HTMLTextAreaElement;
    const line = document.getElementById('line')!;
    let selectedAll = false;
    let deletedExistingText = false;
    Object.defineProperty(document, 'execCommand', {
      configurable: true,
      value: vi.fn((command: string, _showUi?: boolean, value?: string) => {
        if (document.activeElement !== input) return false;
        if (command === 'selectAll') {
          selectedAll = true;
          return true;
        }
        if (command === 'delete') {
          deletedExistingText = true;
          input.value = '';
          line.textContent = '';
          return true;
        }
        if (command === 'insertText') {
          const insertedText = String(value ?? '');
          input.value = insertedText;
          line.textContent = deletedExistingText ? insertedText : `${line.textContent ?? ''}${insertedText}`;
          input.dispatchEvent(new InputEvent('input', { bubbles: true, inputType: 'insertText', data: insertedText }));
          return true;
        }
        return false;
      }),
    });
    editor.addEventListener('mousedown', () => {
      input.focus();
    });
    setRect(editor, makeRect(10, 20, 797, 208));
    setRect(input, makeRect(10, 20, 1, 1));
    setRect(line, makeRect(10, 28, 797, 20));
    spyElementFromPoint(document, line);
    const snapshot = readCurrentPageInteractables(document, window);

    await expect(executePageAction({ action: 'type', sid: snapshot.sid, ref: 'e1', text: 'new code', clear: true }, document, window)).resolves.toMatchObject({
      ok: true,
      action: 'type',
      ref: 'e1',
      changed: true,
      stateAfter: { value: 'new code' },
    });
    expect(document.execCommand).toHaveBeenCalledWith('insertText', false, 'new code');
    expect(line.textContent).toBe('new code');
    expect(selectedAll).toBe(true);
    expect(deletedExistingText).toBe(true);
  });

  it('uses a rich editor bridge to replace code editor content when available', async () => {
    document.body.innerHTML = `
      <div id="editor" class="monaco-editor" aria-label="Code Editor">
        <textarea id="input" class="inputarea monaco-mouse-cursor-text" aria-label="Editor input"></textarea>
        <div class="view-lines monaco-mouse-cursor-text" role="presentation" aria-hidden="true">
          <div id="line" class="view-line">old code</div>
        </div>
      </div>
    `;
    const editor = document.getElementById('editor')!;
    const input = document.getElementById('input') as HTMLTextAreaElement;
    const line = document.getElementById('line')!;
    const execCommand = vi.fn(() => {
      if (document.activeElement !== input) return false;
      line.textContent = `old code${line.textContent ?? ''}`;
      return true;
    });
    Object.defineProperty(document, 'execCommand', {
      configurable: true,
      value: execCommand,
    });
    document.addEventListener('chatbrowserx.rich-editor-write.request', (event) => {
      const customEvent = event as CustomEvent<{ id: string; text: string; clear?: boolean }>;
      input.value = customEvent.detail.text;
      line.textContent = customEvent.detail.clear
        ? customEvent.detail.text
        : `${line.textContent ?? ''}${customEvent.detail.text}`;
      input.dispatchEvent(new CustomEvent('chatbrowserx.rich-editor-write.result', {
        detail: { id: customEvent.detail.id, ok: true },
      }));
    });
    editor.addEventListener('mousedown', () => {
      input.focus();
    });
    setRect(editor, makeRect(10, 20, 797, 208));
    setRect(input, makeRect(10, 20, 1, 1));
    setRect(line, makeRect(10, 28, 797, 20));
    spyElementFromPoint(document, line);
    const snapshot = readCurrentPageInteractables(document, window);

    await expect(executePageAction({ action: 'type', sid: snapshot.sid, ref: 'e1', text: 'new code', clear: true }, document, window)).resolves.toMatchObject({
      ok: true,
      action: 'type',
      ref: 'e1',
      changed: true,
      stateAfter: { value: 'new code' },
    });
    expect(execCommand).not.toHaveBeenCalledWith('insertText', false, 'new code');
    expect(line.textContent).toBe('new code');
  });

  it('types into the focused element after clicking a composite text surface', async () => {
    document.body.innerHTML = `
      <div id="surface" role="textbox" aria-label="Code editor">old code</div>
      <textarea id="real-input">old code</textarea>
    `;
    const surface = document.getElementById('surface')!;
    const input = document.getElementById('real-input') as HTMLTextAreaElement;
    const inputListener = vi.fn(() => {
      surface.textContent = input.value;
    });
    surface.addEventListener('mousedown', () => {
      input.focus();
    });
    input.addEventListener('input', inputListener);
    setRect(surface, makeRect(10, 20, 400, 220));
    setRect(input, makeRect(0, 0, 1, 1));
    spyElementFromPoint(document, surface);
    const snapshot = readCurrentPageInteractables(document, window);

    await expect(executePageAction({ action: 'type', sid: snapshot.sid, ref: 'e1', text: 'new code', clear: true }, document, window)).resolves.toMatchObject({
      ok: true,
      action: 'type',
      ref: 'e1',
      changed: true,
      stateBefore: { value: 'old code' },
      stateAfter: { value: 'new code' },
    });
    expect(document.activeElement).toBe(input);
    expect(input.value).toBe('new code');
    expect(surface.textContent).toBe('new code');
    expect(inputListener).toHaveBeenCalledTimes(1);
  });

  it('types into the visible input inside a form wrapper when a hidden text input appears first', async () => {
    document.body.innerHTML = `
      <p id="wrapper" class="pass-form-item">
        <label for="username">用户名</label>
        <input id="hidden-username" type="text" style="display: none" />
        <input id="username" type="text" placeholder="请设置用户名" />
      </p>
    `;
    setViewportSize(1728, 861);
    const wrapper = document.getElementById('wrapper')!;
    const hiddenInput = document.getElementById('hidden-username') as HTMLInputElement;
    const visibleInput = document.getElementById('username') as HTMLInputElement;
    setRect(wrapper, makeRect(1109, 248, 720, 40));
    setRect(hiddenInput, makeRect(0, 0, 0, 0));
    setRect(visibleInput, makeRect(1264, 248, 565, 40));
    spyElementFromPoint(document, wrapper);
    const snapshot = readCurrentPageInteractables(document, window);

    await expect(executePageAction({ action: 'type', sid: snapshot.sid, ref: 'e1', text: 'alice', clear: true }, document, window)).resolves.toMatchObject({
      ok: true,
      action: 'type',
      ref: 'e1',
      changed: true,
      stateAfter: { value: 'alice' },
    });
    expect(hiddenInput.value).toBe('');
    expect(visibleInput.value).toBe('alice');
  });

  it('scrolls the current page by direction without needing a ref', async () => {
    const scrollByMock = mockWindowScrollBy();
    setViewportSize(window.innerWidth, 800);

    await expect(executePageAction({ action: 'scroll', direction: 'down' }, document, window)).resolves.toEqual({
      ok: true,
      action: 'scroll',
      scroll: {
        target: 'window',
        leftBefore: 0,
        leftAfter: 0,
        topBefore: 0,
        topAfter: 0,
        scrolled: false,
      },
    });
    expect(scrollByMock).toHaveBeenCalledWith({ left: 0, top: 560, behavior: 'auto' });
  });

  it('scrolls the visible scrollable container when page content is inside a nested scroller', async () => {
    document.body.innerHTML = '<main id="scroller" style="overflow-y: auto"><section id="content"></section></main>';
    const scroller = document.getElementById('scroller') as HTMLElement;
    const content = document.getElementById('content')!;
    const windowScrollByMock = mockWindowScrollBy();
    setScrollableMetrics(scroller);
    setRect(scroller, makeRect(100, 100, 900, 400));
    setRect(content, makeRect(100, 100, 900, 1200));
    spyElementFromPoint(document, content);

    await expect(executePageAction({ action: 'scroll', direction: 'down', amount: 300 }, document, window)).resolves.toEqual({
      ok: true,
      action: 'scroll',
      scroll: {
        target: 'element',
        leftBefore: 0,
        leftAfter: 0,
        topBefore: 0,
        topAfter: 300,
        scrolled: true,
      },
    });
    expect(scroller.scrollTop).toBe(300);
    expect(windowScrollByMock).not.toHaveBeenCalled();
  });

  it('scrolls a snapshot scrollarea by ref when provided', async () => {
    document.body.innerHTML = '<main id="scroller" aria-label="Questions" style="overflow-y: auto"><section id="content"></section></main>';
    const scroller = document.getElementById('scroller') as HTMLElement;
    const content = document.getElementById('content')!;
    const windowScrollByMock = mockWindowScrollBy();
    setScrollableMetrics(scroller);
    setRect(scroller, makeRect(100, 100, 900, 400));
    setRect(content, makeRect(100, 100, 900, 1200));
    spyElementFromPoint(document, content);
    const snapshot = readCurrentPageInteractables(document, window);

    await expect(executePageAction({ action: 'scroll', sid: snapshot.sid, ref: 'e1', direction: 'down', amount: 250 }, document, window)).resolves.toEqual({
      ok: true,
      action: 'scroll',
      ref: 'e1',
      scroll: {
        target: 'element',
        ref: 'e1',
        leftBefore: 0,
        leftAfter: 0,
        topBefore: 0,
        topAfter: 250,
        scrolled: true,
      },
    });
    expect(scroller.scrollTop).toBe(250);
    expect(windowScrollByMock).not.toHaveBeenCalled();
  });

  it('falls back to the current scrollable container when a snapshot scroll ref is no longer scrollable', async () => {
    document.body.innerHTML = [
      '<main id="old-scroller" aria-label="Old questions" style="overflow-y: auto"><section id="old-content"></section></main>',
      '<main id="new-scroller" aria-label="New questions" style="overflow-y: auto"><section id="new-content"></section></main>',
    ].join('');
    const oldScroller = document.getElementById('old-scroller') as HTMLElement;
    const oldContent = document.getElementById('old-content')!;
    const newScroller = document.getElementById('new-scroller') as HTMLElement;
    const newContent = document.getElementById('new-content')!;
    const windowScrollByMock = mockWindowScrollBy();
    setScrollableMetrics(oldScroller);
    setScrollableMetrics(newScroller);
    setRect(oldScroller, makeRect(100, 100, 900, 400));
    setRect(oldContent, makeRect(100, 100, 900, 1200));
    setRect(newScroller, makeRect(100, 100, 900, 400));
    setRect(newContent, makeRect(100, 100, 900, 1200));
    spyElementFromPoint(document, oldContent);
    const snapshot = readCurrentPageInteractables(document, window);

    Object.defineProperty(oldScroller, 'scrollHeight', { configurable: true, value: 400 });
    spyElementFromPoint(document, newContent);

    await expect(executePageAction({ action: 'scroll', sid: snapshot.sid, ref: 'e1', direction: 'down', amount: 250 }, document, window)).resolves.toEqual({
      ok: true,
      action: 'scroll',
      ref: 'e1',
      scroll: {
        target: 'element',
        ref: 'e1',
        fallback: true,
        leftBefore: 0,
        leftAfter: 0,
        topBefore: 0,
        topAfter: 250,
        scrolled: true,
      },
    });
    expect(oldScroller.scrollTop).toBe(0);
    expect(newScroller.scrollTop).toBe(250);
    expect(windowScrollByMock).not.toHaveBeenCalled();
  });

  it('drags from one ref to another with mouse events', async () => {
    document.body.innerHTML = '<div role="button" aria-label="From" id="from"></div><div role="button" aria-label="To" id="to"></div>';
    const from = document.getElementById('from')!;
    const to = document.getElementById('to')!;
    const down = vi.fn();
    const move = vi.fn();
    const up = vi.fn();
    from.addEventListener('mousedown', down);
    to.addEventListener('mousemove', move);
    to.addEventListener('mouseup', up);
    setRect(from, makeRect(10, 20, 50, 30));
    setRect(to, makeRect(200, 220, 50, 30));
    Object.defineProperty(document, 'elementFromPoint', {
      configurable: true,
      value: vi.fn((_x, y) => y < 100 ? from : to),
    });
    const snapshot = readCurrentPageInteractables(document, window);

    await expect(executePageAction({ action: 'drag', sid: snapshot.sid, fromRef: 'e1', toRef: 'e2' }, document, window)).resolves.toEqual({
      ok: true,
      action: 'drag',
      ref: 'e1',
    });
    expect(down).toHaveBeenCalledTimes(1);
    expect(move).toHaveBeenCalled();
    expect(up).toHaveBeenCalledTimes(1);
  });

  it('rejects actions that use an expired interactables snapshot id', async () => {
    document.body.innerHTML = '<button id="first">First</button><button id="second">Second</button>';
    const first = document.getElementById('first')!;
    const second = document.getElementById('second')!;
    setRect(first, makeRect(10, 20, 80, 30));
    setRect(second, makeRect(10, 80, 80, 30));
    spyElementFromPoint(document, first);
    const firstSnapshot = readCurrentPageInteractables(document, window);

    spyElementFromPoint(document, second);
    readCurrentPageInteractables(document, window);

    await expect(executePageAction({ action: 'click', sid: firstSnapshot.sid, ref: 'e1' }, document, window)).resolves.toEqual({
      ok: false,
      action: 'click',
      ref: 'e1',
      error: 'PAGE_ACTION_SNAPSHOT_EXPIRED',
    });
  });

  it('returns a structured error for an unknown ref', async () => {
    document.body.innerHTML = '<button id="submit">Submit</button>';
    const button = document.getElementById('submit')!;
    setRect(button, makeRect(10, 20, 100, 40));
    spyElementFromPoint(document, button);
    const snapshot = readCurrentPageInteractables(document, window);

    await expect(executePageAction({ action: 'click', sid: snapshot.sid, ref: 'missing' }, document, window)).resolves.toEqual({
      ok: false,
      action: 'click',
      ref: 'missing',
      error: 'PAGE_ACTION_REF_NOT_FOUND',
    });
  });

  it('registers a runtime listener for page action requests', async () => {
    const addListenerMock = globalThis.__chromeTestUtils.getRuntimeOnMessageAddListenerMock();
    Object.defineProperty(window, 'scrollBy', { configurable: true, value: vi.fn() });
    registerPageActionToolListener();

    const listener = addListenerMock.mock.calls.at(-1)?.[0];
    const sendResponse = vi.fn();

    const keepAlive = listener?.({ type: 'chatbrowserx.tool.page-action.request', action: 'scroll', direction: 'up' }, {}, sendResponse);
    await new Promise((resolve) => setTimeout(resolve, 260));

    expect(keepAlive).toBe(true);
    expect(sendResponse).toHaveBeenCalledWith(expect.objectContaining({ ok: true, action: 'scroll' }));
  });
});
