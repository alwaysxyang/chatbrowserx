import { describe, expect, it, vi } from 'vitest';
import {
  readCurrentPageInteractables,
  registerGetPageInteractablesToolListener,
} from '../../../src/ui/tools/get-page-interactables-tool';

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

function spyElementFromPoint(documentObject: Document) {
  Object.defineProperty(documentObject, 'elementFromPoint', {
    configurable: true,
    value: vi.fn(),
  });

  return vi.spyOn(documentObject, 'elementFromPoint');
}

describe('ui get page interactables tool', () => {
  it('uses accessible names and returns a compact viewport snapshot', () => {
    document.body.innerHTML = `
      <span id="save-label">Save changes</span>
      <button id="save" aria-labelledby="save-label"></button>
      <input id="search" aria-label="Search site" placeholder="Search docs" />
    `;
    window.innerWidth = 1024;
    window.innerHeight = 768;

    const save = document.getElementById('save')!;
    const search = document.getElementById('search')!;
    setRect(save, makeRect(10, 20, 100, 40));
    setRect(search, makeRect(10, 80, 220, 32));

    spyElementFromPoint(document).mockImplementation((_x, y) => y < 60 ? save : search);

    const snapshot = readCurrentPageInteractables(document, window);

    expect(snapshot).toMatchObject({
      v: [1024, 768],
      items: [
        ['e1', 'button', 'Save changes', [10, 20, 100, 40]],
        ['e2', 'textbox', 'Search site', [10, 80, 220, 32], { h: 'Search docs', t: 'text' }],
      ],
    });
    expect(snapshot.sid).toMatch(/^s_/);
  });

  it('filters disabled, hidden, offscreen, and covered controls', () => {
    document.body.innerHTML = `
      <button id="enabled">Enabled</button>
      <button id="disabled" disabled>Disabled</button>
      <button id="hidden" style="display: none">Hidden</button>
      <button id="offscreen">Offscreen</button>
      <button id="covered">Covered</button>
      <div id="cover"></div>
    `;
    window.innerWidth = 800;
    window.innerHeight = 600;

    const enabled = document.getElementById('enabled')!;
    const disabled = document.getElementById('disabled')!;
    const hidden = document.getElementById('hidden')!;
    const offscreen = document.getElementById('offscreen')!;
    const covered = document.getElementById('covered')!;
    const cover = document.getElementById('cover')!;

    setRect(enabled, makeRect(20, 20, 80, 30));
    setRect(disabled, makeRect(20, 70, 80, 30));
    setRect(hidden, makeRect(20, 120, 80, 30));
    setRect(offscreen, makeRect(20, 900, 80, 30));
    setRect(covered, makeRect(20, 170, 80, 30));
    setRect(cover, makeRect(20, 170, 80, 30));

    spyElementFromPoint(document).mockImplementation((_x, y) => y > 160 ? cover : enabled);

    const snapshot = readCurrentPageInteractables(document, window);

    expect(snapshot.items).toEqual([
      ['e1', 'button', 'Enabled', [20, 20, 80, 30]],
    ]);
  });

  it('keeps native inputs when hit testing returns their visible wrapper', () => {
    document.body.innerHTML = `
      <p id="wrapper" class="pass-form-item">
        <label for="username">用户名</label>
        <input type="text" style="display: none" />
        <input id="username" type="text" placeholder="请设置用户名" />
      </p>
    `;
    window.innerWidth = 1200;
    window.innerHeight = 800;

    const wrapper = document.getElementById('wrapper')!;
    const username = document.getElementById('username')!;
    setRect(wrapper, makeRect(200, 120, 680, 80));
    setRect(username, makeRect(365, 140, 685, 52));
    spyElementFromPoint(document).mockReturnValue(wrapper);

    const snapshot = readCurrentPageInteractables(document, window);

    expect(snapshot.items).toEqual([
      ['e1', 'textbox', '用户名', [200, 120, 680, 80], { h: '请设置用户名', t: 'text' }],
    ]);
  });

  it('exposes a visible form-item wrapper when the nested input is visually proxied', () => {
    document.body.innerHTML = `
      <p id="phone-wrapper" class="pass-form-item">
        <label for="phone">手机号</label>
        <input id="phone" type="text" placeholder="可用于登录和找回密码" style="opacity: 0" />
      </p>
    `;
    window.innerWidth = 1200;
    window.innerHeight = 800;

    const wrapper = document.getElementById('phone-wrapper')!;
    const phone = document.getElementById('phone')!;
    setRect(wrapper, makeRect(365, 220, 685, 52));
    setRect(phone, makeRect(365, 220, 0, 0));
    spyElementFromPoint(document).mockReturnValue(wrapper);

    const snapshot = readCurrentPageInteractables(document, window);

    expect(snapshot.items).toEqual([
      ['e1', 'textbox', '手机号', [365, 220, 685, 52], { h: '可用于登录和找回密码', t: 'text' }],
    ]);
  });

  it('filters ChatBrowserX injected UI from page interactables', () => {
    document.body.innerHTML = `
      <button id="page-button">Page button</button>
      <div id="chatbrowserx-root">
        <button id="plugin-button">Plugin button</button>
      </div>
      <div id="chatbrowserx-page-action-overlay">
        <button id="overlay-button">Overlay button</button>
      </div>
    `;
    window.innerWidth = 1200;
    window.innerHeight = 800;

    const pageButton = document.getElementById('page-button')!;
    const pluginButton = document.getElementById('plugin-button')!;
    const overlayButton = document.getElementById('overlay-button')!;
    setRect(pageButton, makeRect(20, 20, 120, 32));
    setRect(pluginButton, makeRect(20, 70, 120, 32));
    setRect(overlayButton, makeRect(20, 120, 120, 32));
    spyElementFromPoint(document).mockImplementation((_x, y) => {
      if (y < 60) return pageButton;
      if (y < 110) return pluginButton;
      return overlayButton;
    });

    const snapshot = readCurrentPageInteractables(document, window);

    expect(snapshot.items).toEqual([
      ['e1', 'button', 'Page button', [20, 20, 120, 32]],
    ]);
  });

  it('adds bounded diagnostics when writable controls are present but no textbox survives', () => {
    document.body.innerHTML = `
      <button id="login">登录</button>
      <input id="TANGRAM__PSP_4__userName" type="text" placeholder="请设置用户名" />
    `;
    window.innerWidth = 1200;
    window.innerHeight = 800;

    const login = document.getElementById('login')!;
    const username = document.getElementById('TANGRAM__PSP_4__userName')!;
    setRect(login, makeRect(20, 20, 80, 32));
    setRect(username, makeRect(200, 120, 680, 52));
    spyElementFromPoint(document).mockImplementation((_x, y) => y < 80 ? login : document.body);

    const snapshot = readCurrentPageInteractables(document, window);

    expect(snapshot.items).toEqual([
      ['e1', 'button', '登录', [20, 20, 80, 32]],
    ]);
    expect(snapshot.d).toMatchObject({
      ver: expect.any(String),
      q: {
        covered: 1,
        writable: 1,
      },
      samples: [
        expect.objectContaining({
          id: 'TANGRAM__PSP_4__userName',
          reason: 'covered',
          role: 'textbox',
        }),
      ],
    });
  });

  it('keeps compact form item wrappers even when hit testing returns an unrelated overlay', () => {
    document.body.innerHTML = `
      <p id="TANGRAM__PSP_4__userNameWrapper" class="pass-form-item pass-form-item-userName">
        <label for="TANGRAM__PSP_4__userName">用户名</label>
        <input id="TANGRAM__PSP_4__userName" type="text" placeholder="请设置用户名" />
      </p>
      <div id="unrelated-overlay"></div>
    `;
    window.innerWidth = 1200;
    window.innerHeight = 800;

    const wrapper = document.getElementById('TANGRAM__PSP_4__userNameWrapper')!;
    const input = document.getElementById('TANGRAM__PSP_4__userName')!;
    const overlay = document.getElementById('unrelated-overlay')!;
    setRect(wrapper, makeRect(365, 140, 685, 52));
    setRect(input, makeRect(365, 140, 685, 52));
    setRect(overlay, makeRect(365, 140, 685, 52));
    spyElementFromPoint(document).mockReturnValue(overlay);

    const snapshot = readCurrentPageInteractables(document, window);

    expect(snapshot.items).toEqual([
      ['e1', 'textbox', '用户名', [365, 140, 685, 52], { h: '请设置用户名', t: 'text' }],
    ]);
  });

  it('does not expose broad form containers as textbox wrappers', () => {
    document.body.innerHTML = `
      <div id="reg_content" class="reg-content tang-pass-reg">
        <p id="TANGRAM__PSP_4__userNameWrapper" class="pass-form-item pass-form-item-userName">
          <label for="TANGRAM__PSP_4__userName">用户名</label>
          <input id="TANGRAM__PSP_4__userName" type="text" placeholder="请设置用户名" />
        </p>
      </div>
      <div id="unrelated-overlay"></div>
    `;
    window.innerWidth = 1200;
    window.innerHeight = 800;

    const regContent = document.getElementById('reg_content')!;
    const wrapper = document.getElementById('TANGRAM__PSP_4__userNameWrapper')!;
    const input = document.getElementById('TANGRAM__PSP_4__userName')!;
    const overlay = document.getElementById('unrelated-overlay')!;
    setRect(regContent, makeRect(320, 100, 720, 482));
    setRect(wrapper, makeRect(365, 140, 685, 52));
    setRect(input, makeRect(365, 140, 685, 52));
    setRect(overlay, makeRect(320, 100, 720, 482));
    spyElementFromPoint(document).mockReturnValue(overlay);

    const snapshot = readCurrentPageInteractables(document, window);

    expect(snapshot.items).toEqual([
      ['e1', 'textbox', '用户名', [365, 140, 685, 52], { h: '请设置用户名', t: 'text' }],
    ]);
  });

  it('ignores non-interactive explicit roles', () => {
    document.body.innerHTML = `
      <div id="status" role="status">Saved</div>
      <div id="button" role="button" aria-label="Open menu"></div>
    `;
    window.innerWidth = 800;
    window.innerHeight = 600;

    const status = document.getElementById('status')!;
    const button = document.getElementById('button')!;
    setRect(status, makeRect(20, 20, 100, 30));
    setRect(button, makeRect(20, 70, 100, 30));
    spyElementFromPoint(document).mockImplementation((_x, y) => y < 60 ? status : button);

    const snapshot = readCurrentPageInteractables(document, window);

    expect(snapshot.items).toEqual([
      ['e1', 'button', 'Open menu', [20, 70, 100, 30]],
    ]);
  });

  it('includes non-native clickable elements with click handlers or pointer cursor', () => {
    document.body.innerHTML = `
      <style>.css-pointer { cursor: pointer; }</style>
      <div id="clickable" onclick="void 0">Open panel</div>
      <span id="pointer" style="cursor: pointer" title="Show filters">Filters</span>
      <div id="css-pointer" class="css-pointer">CSS pointer</div>
      <div id="plain">Plain text</div>
    `;
    window.innerWidth = 800;
    window.innerHeight = 600;

    const clickable = document.getElementById('clickable')!;
    const pointer = document.getElementById('pointer')!;
    const cssPointer = document.getElementById('css-pointer')!;
    const plain = document.getElementById('plain')!;
    setRect(clickable, makeRect(20, 20, 100, 30));
    setRect(pointer, makeRect(20, 70, 100, 30));
    setRect(cssPointer, makeRect(20, 120, 100, 30));
    setRect(plain, makeRect(20, 170, 100, 30));
    spyElementFromPoint(document).mockImplementation((_x, y) => {
      if (y < 60) return clickable;
      if (y < 110) return pointer;
      if (y < 160) return cssPointer;
      return plain;
    });

    const snapshot = readCurrentPageInteractables(document, window);

    expect(snapshot.items).toEqual([
      ['e1', 'button', 'Open panel', [20, 20, 100, 30]],
      ['e2', 'button', 'Filters', [20, 70, 100, 30], { h: 'Show filters' }],
      ['e3', 'button', 'CSS pointer', [20, 120, 100, 30]],
    ]);
  });

  it('includes common code editor containers as textboxes', () => {
    document.body.innerHTML = `
      <div id="monaco" class="monaco-editor" role="code" aria-label="Code Editor">
        <textarea class="inputarea" aria-label="Editor content" style="opacity: 0"></textarea>
        <div class="view-lines">return true;</div>
      </div>
      <div id="codemirror" class="cm-editor" aria-label="SQL editor">
        <div class="cm-content" contenteditable="true">select 1</div>
      </div>
    `;
    window.innerWidth = 1200;
    window.innerHeight = 800;

    const monaco = document.getElementById('monaco')!;
    const codemirror = document.getElementById('codemirror')!;
    setRect(monaco, makeRect(30, 40, 700, 360));
    setRect(codemirror, makeRect(30, 440, 700, 260));
    spyElementFromPoint(document).mockImplementation((_x, y) => y < 420 ? monaco : codemirror);

    const snapshot = readCurrentPageInteractables(document, window);

    expect(snapshot.items).toEqual([
      ['e1', 'textbox', 'Code Editor', [30, 40, 700, 360], { t: 'code' }],
      ['e2', 'textbox', 'SQL editor', [30, 440, 700, 260], { t: 'code' }],
    ]);
  });

  it('includes visible scrollable containers as scroll areas', () => {
    document.body.innerHTML = `
      <main id="questions" aria-label="Question list" style="overflow-y: auto">
        <section id="content">Question 3 Question 4 Question 5</section>
      </main>
    `;
    window.innerWidth = 1200;
    window.innerHeight = 800;

    const questions = document.getElementById('questions')!;
    const content = document.getElementById('content')!;
    Object.defineProperty(questions, 'clientHeight', { configurable: true, value: 400 });
    Object.defineProperty(questions, 'scrollHeight', { configurable: true, value: 1200 });
    setRect(questions, makeRect(40, 80, 900, 400));
    setRect(content, makeRect(40, 80, 900, 1200));
    spyElementFromPoint(document).mockReturnValue(content);

    const snapshot = readCurrentPageInteractables(document, window);

    expect(snapshot.items).toEqual([
      ['e1', 'scrollarea', 'Question list', [40, 80, 900, 400], { s: 'y' }],
    ]);
  });

  it('deduplicates nested generic clickable descendants under the same clickable row', () => {
    document.body.innerHTML = `
      <div id="row" style="cursor: pointer">
        <div id="inner" style="cursor: pointer">
          <span id="label" style="cursor: pointer">A. 员工A接受合作方提供的休闲旅行</span>
        </div>
        <span id="dot" style="cursor: pointer"></span>
      </div>
    `;
    window.innerWidth = 1200;
    window.innerHeight = 800;

    const row = document.getElementById('row')!;
    const inner = document.getElementById('inner')!;
    const label = document.getElementById('label')!;
    const dot = document.getElementById('dot')!;
    setRect(row, makeRect(20, 20, 760, 40));
    setRect(inner, makeRect(36, 29, 720, 22));
    setRect(label, makeRect(60, 29, 360, 22));
    setRect(dot, makeRect(36, 32, 16, 16));
    spyElementFromPoint(document).mockReturnValue(label);

    const snapshot = readCurrentPageInteractables(document, window);

    expect(snapshot.items).toEqual([
      ['e1', 'button', 'A. 员工A接受合作方提供的休闲旅行', [20, 20, 760, 40]],
    ]);
  });

  it('collapses checkable option children into their clickable row', () => {
    document.body.innerHTML = `
      <label id="row" style="cursor: pointer">
        <input id="radio" type="radio" name="answer" />
        <span id="label">C. 员工收到礼盒应及时申报</span>
      </label>
    `;
    window.innerWidth = 1200;
    window.innerHeight = 800;

    const row = document.getElementById('row')!;
    const radio = document.getElementById('radio')!;
    const label = document.getElementById('label')!;
    setRect(row, makeRect(20, 20, 760, 40));
    setRect(radio, makeRect(36, 32, 16, 16));
    setRect(label, makeRect(60, 29, 360, 22));
    spyElementFromPoint(document).mockReturnValue(label);

    const snapshot = readCurrentPageInteractables(document, window);

    expect(snapshot.items).toEqual([
      ['e1', 'button', 'C. 员工收到礼盒应及时申报', [20, 20, 760, 40], { checked: false }],
    ]);
  });

  it('registers a runtime listener for page interactables requests', async () => {
    const addListenerMock = chrome.runtime.onMessage.addListener as unknown as ReturnType<typeof vi.fn>;
    registerGetPageInteractablesToolListener();

    const listener = addListenerMock.mock.calls.at(-1)?.[0];
    const sendResponse = vi.fn();

    document.body.innerHTML = '<button id="ok">OK</button>';
    const ok = document.getElementById('ok')!;
    setRect(ok, makeRect(1, 2, 30, 20));
    spyElementFromPoint(document).mockReturnValue(ok);

    const keepAlive = listener?.({ type: 'chatbrowserx.tool.get-page-interactables.request' }, {}, sendResponse);
    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(keepAlive).toBe(true);
    expect(sendResponse).toHaveBeenCalledWith(expect.objectContaining({
      items: [['e1', 'button', 'OK', [1, 2, 30, 20]]],
    }));
  });
});
