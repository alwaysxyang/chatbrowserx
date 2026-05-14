import { beforeEach, describe, expect, it, vi } from 'vitest';
import { executePageAction } from '../../../src/ui/tools/page-automation/action-executor';
import { readCurrentPageElements } from '../../../src/ui/tools/page-automation/page-element-scanner';
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

  it('clicks an element by the latest page element ref', async () => {
    document.body.innerHTML = '<button id="submit">Submit</button>';
    const button = document.getElementById('submit')!;
    const clickListener = vi.fn();
    button.addEventListener('click', clickListener);
    setRect(button, makeRect(10, 20, 100, 40));
    spyElementFromPoint(document, button);
    const snapshot = readCurrentPageElements(document, window);

    await expect(executePageAction({ action: 'click', sid: snapshot.sid, ref: 'e1' }, document, window)).resolves.toEqual({
      ok: true,
      action: 'click',
      ref: 'e1',
      changed: false,
    });
    expect(clickListener).toHaveBeenCalledTimes(1);
  });

  it('rejects clicks on read-only text snapshot items', async () => {
    document.body.innerHTML = '<p id="copy">上海市</p>';
    const copy = document.getElementById('copy')!;
    const clickListener = vi.fn();
    copy.addEventListener('click', clickListener);
    setRect(copy, makeRect(10, 20, 100, 32));
    spyElementFromPoint(document, copy);
    const snapshot = readCurrentPageElements(document, window);

    await expect(executePageAction({ action: 'click', sid: snapshot.sid, ref: 'e1' }, document, window)).resolves.toEqual({
      ok: false,
      action: 'click',
      ref: 'e1',
      error: 'PAGE_ACTION_TARGET_NOT_OPERABLE',
    });
    expect(clickListener).not.toHaveBeenCalled();
  });

  it('reports popup option clicks as changed when the target closes', async () => {
    document.body.innerHTML = `
      <div id="popup" role="listbox">
        <div id="age" class="custom-menu-item">26~30</div>
      </div>
    `;
    const popup = document.getElementById('popup')!;
    const age = document.getElementById('age')!;
    age.addEventListener('click', () => {
      popup.remove();
    });
    setRect(age, makeRect(530, 609, 846, 33));
    spyElementFromPoint(document, age);
    const snapshot = readCurrentPageElements(document, window);

    await expect(executePageAction({ action: 'click', sid: snapshot.sid, ref: 'e1' }, document, window)).resolves.toEqual({
      ok: true,
      action: 'click',
      ref: 'e1',
      changed: true,
    });
  });

  it('focuses and sends pointer events when clicking composite picker surfaces', async () => {
    document.body.innerHTML = `
      <span id="picker" class="ant-cascader-picker" tabindex="0">
        <input id="inner-input" tabindex="-1" class="ant-cascader-input" placeholder="请选择" />
      </span>
    `;
    const picker = document.getElementById('picker')!;
    const input = document.getElementById('inner-input')!;
    const events: string[] = [];
    picker.addEventListener('focus', () => events.push('focus'));
    picker.addEventListener('pointerover', () => events.push('pointerover'));
    picker.addEventListener('mouseover', () => events.push('mouseover'));
    picker.addEventListener('mouseenter', () => events.push('mouseenter'));
    picker.addEventListener('pointermove', () => events.push('pointermove'));
    picker.addEventListener('mousemove', () => events.push('mousemove'));
    picker.addEventListener('pointerdown', () => events.push('pointerdown'));
    picker.addEventListener('mousedown', () => events.push('mousedown'));
    picker.addEventListener('pointerup', () => events.push('pointerup'));
    picker.addEventListener('mouseup', () => events.push('mouseup'));
    picker.addEventListener('click', () => events.push('click'));
    setRect(picker, makeRect(708, 49, 1340, 84));
    setRect(input, makeRect(708, 49, 1340, 84));
    spyElementFromPoint(document, input);
    const snapshot = readCurrentPageElements(document, window);

    await executePageAction({ action: 'click', sid: snapshot.sid, ref: 'e1' }, document, window);

    expect(document.activeElement).toBe(picker);
    expect(events).toEqual(['pointerover', 'mouseover', 'mouseenter', 'pointermove', 'mousemove', 'focus', 'pointerdown', 'mousedown', 'pointerup', 'mouseup', 'click']);
  });

  it('dispatches composite picker clicks to the hit-tested inner control', async () => {
    document.body.innerHTML = `
      <span id="picker" class="calendar-picker calendar-picker-large">
        <div>
          <input id="date-input" readonly class="calendar-picker-input ant-input ant-input-lg" value="" />
          <i id="calendar-icon" aria-label="图标: calendar" class="calendar-picker-icon"></i>
        </div>
      </span>
    `;
    const picker = document.getElementById('picker')!;
    const input = document.getElementById('date-input')!;
    const pickerClickListener = vi.fn();
    const inputClickListener = vi.fn();
    picker.addEventListener('click', pickerClickListener);
    input.addEventListener('click', inputClickListener);
    setRect(picker, makeRect(795, 106, 394, 48));
    setRect(input, makeRect(795, 106, 394, 48));
    spyElementFromPoint(document, input);
    const snapshot = readCurrentPageElements(document, window);

    await executePageAction({ action: 'click', sid: snapshot.sid, ref: 'e1' }, document, window);

    expect(document.activeElement).toBe(input);
    expect(inputClickListener).toHaveBeenCalledTimes(1);
    expect(pickerClickListener).toHaveBeenCalledTimes(1);
  });

  it('dispatches hover events when moving onto expandable popup options', async () => {
    document.body.innerHTML = `
      <div id="popup" role="listbox">
        <div id="province" class="custom-menu-item">河北省</div>
      </div>
    `;
    const province = document.getElementById('province')!;
    const events: string[] = [];
    province.addEventListener('pointerover', () => events.push('pointerover'));
    province.addEventListener('mouseover', () => events.push('mouseover'));
    province.addEventListener('mouseenter', () => events.push('mouseenter'));
    province.addEventListener('pointermove', () => events.push('pointermove'));
    province.addEventListener('mousemove', () => events.push('mousemove'));
    setRect(province, makeRect(730, 258, 233, 54));
    spyElementFromPoint(document, province);
    const snapshot = readCurrentPageElements(document, window);

    await executePageAction({ action: 'mouse_move', sid: snapshot.sid, ref: 'e1' }, document, window);

    expect(events).toEqual(['pointerover', 'mouseover', 'mouseenter', 'pointermove', 'mousemove']);
  });

  it('clicks the visible portion of a partially clipped popup option', async () => {
    document.body.innerHTML = `
      <div id="popup" class="custom-menu" style="overflow-y: auto">
        <div id="option" class="custom-menu-item">辽宁省</div>
      </div>
      <input id="date-input" />
    `;
    const popup = document.getElementById('popup') as HTMLElement;
    const option = document.getElementById('option')!;
    const dateInput = document.getElementById('date-input')!;
    const clickListener = vi.fn((event: MouseEvent) => event.clientY);
    option.addEventListener('click', clickListener);
    Object.defineProperty(popup, 'clientHeight', { configurable: true, value: 180 });
    Object.defineProperty(popup, 'scrollHeight', { configurable: true, value: 720 });
    setRect(popup, makeRect(230, 220, 300, 180));
    setRect(option, makeRect(256, 380, 240, 54));
    setRect(dateInput, makeRect(230, 400, 400, 48));
    Object.defineProperty(document, 'elementFromPoint', {
      configurable: true,
      value: vi.fn(() => option),
    });
    const snapshot = readCurrentPageElements(document, window);
    const optionRef = snapshot.items.find((item) => item[2] === '辽宁省')?.[0] ?? '';
    Object.defineProperty(document, 'elementFromPoint', {
      configurable: true,
      value: vi.fn((_x, y) => y >= 380 && y < 400 ? option : dateInput),
    });

    await executePageAction({ action: 'click', sid: snapshot.sid, ref: optionRef }, document, window);

    expect(clickListener).toHaveBeenCalledTimes(1);
    expect(clickListener.mock.results[0]?.value).toBeLessThan(400);
  });

  it('dispatches click while the virtual cursor is still at the target point', async () => {
    document.body.innerHTML = '<button id="submit">Submit</button>';
    const button = document.getElementById('submit')!;
    setRect(button, makeRect(10, 20, 100, 40));
    spyElementFromPoint(document, button);
    const snapshot = readCurrentPageElements(document, window);

    button.addEventListener('click', () => {
      const cursor = document.querySelector<HTMLElement>('[data-role="virtual-cursor"]');
      expect(cursor?.style.opacity).toBe('1');
      expect(cursor?.style.transform).toContain('60px');
      expect(cursor?.style.transform).toContain('40px');
    });

    await executePageAction({ action: 'click', sid: snapshot.sid, ref: 'e1' }, document, window);
  });

  it('waits for the virtual cursor to reach the target before clicking', async () => {
    vi.useFakeTimers();
    try {
      document.body.innerHTML = '<button id="submit">Submit</button>';
      const button = document.getElementById('submit')!;
      const clickListener = vi.fn();
      button.addEventListener('click', clickListener);
      setRect(button, makeRect(10, 20, 100, 40));
      spyElementFromPoint(document, button);
      const snapshot = readCurrentPageElements(document, window);

      const action = executePageAction({ action: 'click', sid: snapshot.sid, ref: 'e1' }, document, window);
      await Promise.resolve();

      expect(clickListener).not.toHaveBeenCalled();
      await vi.advanceTimersByTimeAsync(279);
      expect(clickListener).not.toHaveBeenCalled();
      await vi.advanceTimersByTimeAsync(1);
      expect(clickListener).toHaveBeenCalledTimes(1);
      await vi.runAllTimersAsync();
      await expect(action).resolves.toMatchObject({
        ok: true,
        action: 'click',
        ref: 'e1',
      });
    } finally {
      vi.useRealTimers();
    }
  });

  it('returns before and after checked state for checkbox clicks', async () => {
    document.body.innerHTML = '<input id="agree" type="checkbox" aria-label="Agree" />';
    const checkbox = document.getElementById('agree') as HTMLInputElement;
    setRect(checkbox, makeRect(10, 20, 20, 20));
    spyElementFromPoint(document, checkbox);
    const snapshot = readCurrentPageElements(document, window);

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
    const snapshot = readCurrentPageElements(document, window);

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
    const snapshot = readCurrentPageElements(document, window);

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

  it('does not use page-level select-all shortcuts when clearing a native input', async () => {
    document.body.innerHTML = '<input id="q" aria-label="Search" value="old" />';
    const input = document.getElementById('q') as HTMLInputElement;
    const originalExecCommand = document.execCommand;
    let pageSelectAllTriggered = false;
    document.body.addEventListener('keydown', (event) => {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'a') {
        pageSelectAllTriggered = true;
      }
    });
    try {
      Object.defineProperty(document, 'execCommand', {
        configurable: true,
        value: vi.fn((command: string, _showUi?: boolean, value?: string) => {
          if (command === 'selectAll') {
            pageSelectAllTriggered = true;
            return true;
          }
          if (command === 'delete') {
            input.value = '';
            return true;
          }
          if (command === 'insertText') {
            input.value = String(value ?? '');
            input.dispatchEvent(new InputEvent('input', { bubbles: true, inputType: 'insertText', data: String(value ?? '') }));
            return true;
          }
          return false;
        }),
      });
      setRect(input, makeRect(10, 20, 200, 32));
      spyElementFromPoint(document, input);
      const snapshot = readCurrentPageElements(document, window);

      await expect(executePageAction({ action: 'type', sid: snapshot.sid, ref: 'e1', text: 'hello', clear: true }, document, window)).resolves.toMatchObject({
        ok: true,
        action: 'type',
        changed: true,
        stateAfter: { value: 'hello' },
      });

      expect(input.value).toBe('hello');
      expect(pageSelectAllTriggered).toBe(false);
      expect(document.execCommand).not.toHaveBeenCalledWith('selectAll', false);
    } finally {
      Object.defineProperty(document, 'execCommand', {
        configurable: true,
        value: originalExecCommand,
      });
    }
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
    const snapshot = readCurrentPageElements(document, window);

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
    const snapshot = readCurrentPageElements(document, window);

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
    const snapshot = readCurrentPageElements(document, window);

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
    const snapshot = readCurrentPageElements(document, window);

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
    const snapshot = readCurrentPageElements(document, window);

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
    const snapshot = readCurrentPageElements(document, window);

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

  it('does not type into a previously focused unrelated input when the target click does not move focus', async () => {
    document.body.innerHTML = `
      <input id="previous" type="text" value="old focus" />
      <input id="target" type="text" value="old target" />
    `;
    setViewportSize(1728, 861);
    const previousInput = document.getElementById('previous') as HTMLInputElement;
    const targetInput = document.getElementById('target') as HTMLInputElement;
    previousInput.focus();
    setRect(previousInput, makeRect(20, 20, 200, 32));
    setRect(targetInput, makeRect(1264, 248, 565, 40));
    spyElementFromPoint(document, targetInput);
    const snapshot = readCurrentPageElements(document, window);

    await expect(executePageAction({ action: 'type', sid: snapshot.sid, ref: 'e1', text: 'alice', clear: true }, document, window)).resolves.toMatchObject({
      ok: true,
      action: 'type',
      ref: 'e1',
      changed: true,
      stateAfter: { value: 'alice' },
    });
    expect(previousInput.value).toBe('old focus');
    expect(targetInput.value).toBe('alice');
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
        canScrollMore: false,
      },
    });
    expect(scrollByMock).toHaveBeenCalledWith({ left: 0, top: 560, behavior: 'auto' });
  });

  it('caps explicit scroll amounts to a human-sized portion of the viewport', async () => {
    const scrollByMock = mockWindowScrollBy();
    setViewportSize(window.innerWidth, 800);

    await executePageAction({ action: 'scroll', direction: 'down', amount: 1200 }, document, window);

    expect(scrollByMock).toHaveBeenCalledWith({ left: 0, top: 640, behavior: 'auto' });
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
        canScrollMore: true,
      },
    });
    expect(scroller.scrollTop).toBe(300);
    expect(windowScrollByMock).not.toHaveBeenCalled();
  });

  it('caps explicit scroll amounts to a human-sized portion of the target scrollarea', async () => {
    document.body.innerHTML = '<main id="scroller" style="overflow-y: auto"><section id="content"></section></main>';
    const scroller = document.getElementById('scroller') as HTMLElement;
    const content = document.getElementById('content')!;
    setScrollableMetrics(scroller);
    setRect(scroller, makeRect(100, 100, 900, 400));
    setRect(content, makeRect(100, 100, 900, 1200));
    spyElementFromPoint(document, content);

    await executePageAction({ action: 'scroll', direction: 'down', amount: 1200 }, document, window);

    expect(scroller.scrollTop).toBe(320);
  });

  it('uses the window instead of an unrelated off-center scrollarea when no ref is provided', async () => {
    document.body.innerHTML = [
      '<aside id="side-scroller" style="overflow-y: auto"><section id="side-content"></section></aside>',
      '<main id="main-content"></main>',
    ].join('');
    const sideScroller = document.getElementById('side-scroller') as HTMLElement;
    const sideContent = document.getElementById('side-content')!;
    const mainContent = document.getElementById('main-content')!;
    const windowScrollByMock = mockWindowScrollBy();
    setViewportSize(1200, 800);
    setScrollableMetrics(sideScroller);
    setRect(sideScroller, makeRect(0, 0, 320, 800));
    setRect(sideContent, makeRect(0, 0, 320, 1200));
    setRect(mainContent, makeRect(420, 120, 620, 500));
    spyElementFromPoint(document, mainContent);

    await expect(executePageAction({ action: 'scroll', direction: 'down', amount: 300 }, document, window)).resolves.toMatchObject({
      ok: true,
      action: 'scroll',
      scroll: {
        target: 'window',
        scrolled: false,
        canScrollMore: false,
      },
    });
    expect(sideScroller.scrollTop).toBe(0);
    expect(windowScrollByMock).toHaveBeenCalledWith({ left: 0, top: 300, behavior: 'auto' });
  });

  it('scrolls an open floating picker list before the viewport-center page target when no ref is provided', async () => {
    document.body.innerHTML = [
      '<main id="main-content"></main>',
      '<div id="popup" class="custom-dropdown" style="position:absolute">',
      '  <ul id="province-menu" class="custom-menu" style="overflow-y:auto">',
      '    <li id="beijing" class="custom-menu-item">北京市</li>',
      '    <li id="tianjin" class="custom-menu-item">天津市</li>',
      '  </ul>',
      '</div>',
    ].join('');
    const mainContent = document.getElementById('main-content')!;
    const menu = document.getElementById('province-menu') as HTMLElement;
    const beijing = document.getElementById('beijing')!;
    const windowScrollByMock = mockWindowScrollBy();
    setViewportSize(1200, 800);
    setScrollableMetrics(menu);
    setRect(mainContent, makeRect(420, 120, 620, 500));
    setRect(menu, makeRect(230, 220, 300, 180));
    setRect(beijing, makeRect(256, 240, 240, 32));
    Object.defineProperty(document, 'elementFromPoint', {
      configurable: true,
      value: vi.fn((x, y) => (x >= 230 && x <= 530 && y >= 220 && y <= 400 ? beijing : mainContent)),
    });

    await expect(executePageAction({ action: 'scroll', direction: 'down', amount: 300 }, document, window)).resolves.toMatchObject({
      ok: true,
      action: 'scroll',
      scroll: {
        target: 'element',
        scrolled: true,
        canScrollMore: true,
      },
    });
    expect(menu.scrollTop).toBe(300);
    expect(windowScrollByMock).not.toHaveBeenCalled();
  });

  it('prefers the terminal floating picker column when multiple cascader columns can scroll', async () => {
    document.body.innerHTML = [
      '<main id="main-content"></main>',
      '<div id="popup" class="custom-dropdown" style="position:absolute">',
      '  <ul id="province-menu" class="custom-menu" style="overflow-y:auto">',
      '    <li id="province-option" class="custom-menu-item">北京市</li>',
      '  </ul>',
      '  <ul id="city-menu" class="custom-menu" style="overflow-y:auto">',
      '    <li id="city-option" class="custom-menu-item">市辖区</li>',
      '  </ul>',
      '</div>',
    ].join('');
    const mainContent = document.getElementById('main-content')!;
    const provinceMenu = document.getElementById('province-menu') as HTMLElement;
    const cityMenu = document.getElementById('city-menu') as HTMLElement;
    const provinceOption = document.getElementById('province-option')!;
    const cityOption = document.getElementById('city-option')!;
    const windowScrollByMock = mockWindowScrollBy();
    setViewportSize(1200, 800);
    setScrollableMetrics(provinceMenu);
    setScrollableMetrics(cityMenu);
    setRect(mainContent, makeRect(420, 120, 620, 500));
    setRect(provinceMenu, makeRect(230, 220, 300, 180));
    setRect(cityMenu, makeRect(560, 220, 300, 180));
    setRect(provinceOption, makeRect(256, 240, 240, 32));
    setRect(cityOption, makeRect(586, 240, 240, 32));
    Object.defineProperty(document, 'elementFromPoint', {
      configurable: true,
      value: vi.fn((x, y) => {
        if (x >= 560 && x <= 860 && y >= 220 && y <= 400) return cityOption;
        if (x >= 230 && x <= 530 && y >= 220 && y <= 400) return provinceOption;
        return mainContent;
      }),
    });

    await expect(executePageAction({ action: 'scroll', direction: 'down', amount: 300 }, document, window)).resolves.toMatchObject({
      ok: true,
      action: 'scroll',
      scroll: {
        target: 'element',
        scrolled: true,
        canScrollMore: true,
      },
    });
    expect(provinceMenu.scrollTop).toBe(0);
    expect(cityMenu.scrollTop).toBe(300);
    expect(windowScrollByMock).not.toHaveBeenCalled();
  });

  it('reports when a scroll target cannot continue in the requested direction', async () => {
    document.body.innerHTML = '<main id="scroller" style="overflow-y: auto"><section id="content"></section></main>';
    const scroller = document.getElementById('scroller') as HTMLElement;
    const content = document.getElementById('content')!;
    setScrollableMetrics(scroller);
    scroller.scrollTop = 760;
    setRect(scroller, makeRect(100, 100, 900, 400));
    setRect(content, makeRect(100, 100, 900, 1200));
    spyElementFromPoint(document, content);

    await expect(executePageAction({ action: 'scroll', direction: 'down', amount: 1200 }, document, window)).resolves.toEqual({
      ok: true,
      action: 'scroll',
      scroll: {
        target: 'element',
        leftBefore: 0,
        leftAfter: 0,
        topBefore: 760,
        topAfter: 800,
        scrolled: true,
        canScrollMore: false,
      },
    });
    expect(scroller.scrollTop).toBe(800);
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
    const snapshot = readCurrentPageElements(document, window);

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
        canScrollMore: true,
      },
    });
    expect(scroller.scrollTop).toBe(250);
    expect(windowScrollByMock).not.toHaveBeenCalled();
  });

  it('does not switch a ref scroll fallback to an unrelated visible scrollarea', async () => {
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
    const snapshot = readCurrentPageElements(document, window);

    Object.defineProperty(oldScroller, 'scrollHeight', { configurable: true, value: 400 });
    spyElementFromPoint(document, newContent);

    await expect(executePageAction({ action: 'scroll', sid: snapshot.sid, ref: 'e1', direction: 'down', amount: 250 }, document, window)).resolves.toEqual({
      ok: true,
      action: 'scroll',
      ref: 'e1',
      scroll: {
        target: 'window',
        ref: 'e1',
        fallback: true,
        leftBefore: 0,
        leftAfter: 0,
        topBefore: 0,
        topAfter: 0,
        scrolled: false,
        canScrollMore: false,
      },
    });
    expect(oldScroller.scrollTop).toBe(0);
    expect(newScroller.scrollTop).toBe(0);
    expect(windowScrollByMock).toHaveBeenCalledWith({ left: 0, top: 250, behavior: 'auto' });
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
    const snapshot = readCurrentPageElements(document, window);

    await expect(executePageAction({ action: 'drag', sid: snapshot.sid, fromRef: 'e1', toRef: 'e2' }, document, window)).resolves.toEqual({
      ok: true,
      action: 'drag',
      ref: 'e1',
    });
    expect(down).toHaveBeenCalledTimes(1);
    expect(move).toHaveBeenCalled();
    expect(up).toHaveBeenCalledTimes(1);
  });

  it('reports an unavailable drag target against the missing target ref', async () => {
    document.body.innerHTML = '<div role="button" aria-label="From" id="from"></div>';
    const from = document.getElementById('from')!;
    setRect(from, makeRect(10, 20, 50, 30));
    spyElementFromPoint(document, from);
    const snapshot = readCurrentPageElements(document, window);

    await expect(executePageAction({ action: 'drag', sid: snapshot.sid, fromRef: 'e1', toRef: 'missing' }, document, window)).resolves.toEqual({
      ok: false,
      action: 'drag',
      ref: 'missing',
      error: 'PAGE_ACTION_REF_NOT_FOUND',
    });
  });

  it('rejects actions that use an expired page element snapshot id', async () => {
    document.body.innerHTML = '<button id="first">First</button><button id="second">Second</button>';
    const first = document.getElementById('first')!;
    const second = document.getElementById('second')!;
    setRect(first, makeRect(10, 20, 80, 30));
    setRect(second, makeRect(10, 80, 80, 30));
    spyElementFromPoint(document, first);
    const firstSnapshot = readCurrentPageElements(document, window);

    spyElementFromPoint(document, second);
    readCurrentPageElements(document, window);

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
    const snapshot = readCurrentPageElements(document, window);

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
