import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  readCurrentPageElements,
} from '../../../src/ui/tools/page-automation/page-element-scanner';
import { candidateSelector } from '../../../src/ui/tools/page-automation/interactable-role';
import {
  registerGetPageElementsToolListener,
} from '../../../src/ui/tools/page-automation/runtime-listeners';

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

/**
 * Sets viewport dimensions for interactable geometry tests.
 */
function setViewportSize(width: number, height: number): void {
  Object.defineProperty(window, 'innerWidth', { configurable: true, value: width });
  Object.defineProperty(window, 'innerHeight', { configurable: true, value: height });
}

type PageElementItem = ReturnType<typeof readCurrentPageElements>['items'][number];
type PageElementMeta = NonNullable<PageElementItem[4]>;

/**
 * Builds an expected page element tuple for compact snapshot assertions.
 */
function pageElementItem(
  ref: string,
  role: string,
  name: string,
  rect: [number, number, number, number],
  meta?: PageElementMeta,
): PageElementItem {
  return meta ? [ref, role, name, rect, meta] : [ref, role, name, rect];
}

/**
 * Builds an expected operable page element tuple.
 */
function operableItem(
  ref: string,
  role: string,
  name: string,
  rect: [number, number, number, number],
  meta?: PageElementMeta,
): PageElementItem {
  return pageElementItem(ref, role, name, rect, { ...(meta ?? {}), op: true });
}

/**
 * Builds an expected writable page element tuple.
 */
function writableItem(
  ref: string,
  role: string,
  name: string,
  rect: [number, number, number, number],
  meta?: PageElementMeta,
): PageElementItem {
  return pageElementItem(ref, role, name, rect, { ...(meta ?? {}), w: true });
}

describe('ui get page elements tool', () => {
  beforeEach(() => {
  });

  it('uses accessible names and returns a compact viewport snapshot', () => {
    document.body.innerHTML = `
      <span id="save-label">Save changes</span>
      <button id="save" aria-labelledby="save-label"></button>
      <input id="search" aria-label="Search site" placeholder="Search docs" />
    `;
    setViewportSize(1024, 768);

    const save = document.getElementById('save')!;
    const search = document.getElementById('search')!;
    setRect(save, makeRect(10, 20, 100, 40));
    setRect(search, makeRect(10, 80, 220, 32));

    spyElementFromPoint(document).mockImplementation((_x, y) => y < 60 ? save : search);

    const snapshot = readCurrentPageElements(document, window);

    expect(snapshot).toMatchObject({
      v: [1024, 768],
      items: [
        operableItem('e1', 'button', 'Save changes', [10, 20, 100, 40]),
        writableItem('e2', 'textbox', 'Search site', [10, 80, 220, 32], { h: 'Search docs', t: 'text' }),
      ],
    });
    expect(snapshot.sid).toMatch(/^s_/);
  });

  it('infers names for icon-only controls from bounded icon tokens', () => {
    document.body.innerHTML = `
      <button id="like"><svg data-icon="thumbs-up" aria-hidden="true"></svg></button>
      <button id="bookmark"><span class="lc-icon-bookmark"></span></button>
      <button id="share"><span data-testid="share-button-icon"></span></button>
    `;
    setViewportSize(1024, 768);

    const like = document.getElementById('like')!;
    const bookmark = document.getElementById('bookmark')!;
    const share = document.getElementById('share')!;
    setRect(like, makeRect(10, 20, 32, 32));
    setRect(bookmark, makeRect(50, 20, 32, 32));
    setRect(share, makeRect(90, 20, 32, 32));

    spyElementFromPoint(document).mockImplementation((x) => {
      if (x < 45) return like;
      if (x < 85) return bookmark;
      return share;
    });

    const snapshot = readCurrentPageElements(document, window);

    expect(snapshot.items).toEqual([
      operableItem('e1', 'button', 'like', [10, 20, 32, 32]),
      operableItem('e2', 'button', 'bookmark', [50, 20, 32, 32]),
      operableItem('e3', 'button', 'share', [90, 20, 32, 32]),
    ]);
  });

  it('keeps unlabeled controls visible with nearby compact context when no semantic token exists', () => {
    document.body.innerHTML = `
      <div>
        <button id="count">32.2K</button>
        <button id="unknown"><svg aria-hidden="true"><path d="M0 0" /></svg></button>
      </div>
    `;
    setViewportSize(1024, 768);

    const count = document.getElementById('count')!;
    const unknown = document.getElementById('unknown')!;
    setRect(count, makeRect(10, 20, 64, 32));
    setRect(unknown, makeRect(82, 20, 32, 32));

    spyElementFromPoint(document).mockImplementation((x) => x < 80 ? count : unknown);

    const snapshot = readCurrentPageElements(document, window);

    expect(snapshot.items).toEqual([
      operableItem('e1', 'button', '32.2K', [10, 20, 64, 32]),
      operableItem('e2', 'button', 'unlabeled button near 32.2K', [82, 20, 32, 32]),
    ]);
  });

  it('does not run candidate visibility checks for plain layout elements', () => {
    document.body.innerHTML = `
      <div id="layout">
        <span id="copy">Decorative copy</span>
        <button id="action">Run</button>
      </div>
    `;
    setViewportSize(1024, 768);

    const action = document.getElementById('action')!;
    setRect(action, makeRect(10, 20, 100, 32));
    spyElementFromPoint(document).mockReturnValue(action);

    const snapshot = readCurrentPageElements(document, window);

    expect(snapshot.items).toEqual([
      operableItem('e1', 'button', 'Run', [10, 20, 100, 32]),
    ]);
    expect(candidateSelector.split(',')).not.toEqual(expect.arrayContaining([
      'article',
      'aside',
      'div',
      'li',
      'p',
      'section',
      'span',
      'td',
      'th',
    ]));
  });

  it('includes visible heading and fallback text blocks for page reading', () => {
    document.body.innerHTML = `
      <main id="article">
        <h1 id="title">Project overview</h1>
        <div id="body-text">
          <span>First paragraph explains the architecture.</span>
          <span>Second sentence covers the risks.</span>
        </div>
        <button id="action">Open details</button>
      </main>
    `;
    setViewportSize(1024, 768);

    const title = document.getElementById('title')!;
    const bodyText = document.getElementById('body-text')!;
    const action = document.getElementById('action')!;
    setRect(title, makeRect(10, 20, 600, 36));
    setRect(bodyText, makeRect(10, 70, 760, 54));
    setRect(action, makeRect(10, 150, 120, 32));
    spyElementFromPoint(document).mockReturnValue(action);

    const snapshot = readCurrentPageElements(document, window);

    expect(snapshot.items).toEqual([
      pageElementItem('e1', 'heading', 'Project overview', [10, 20, 600, 36]),
      pageElementItem('e2', 'text', 'First paragraph explains the architecture. Second sentence covers the risks.', [10, 70, 760, 54]),
      operableItem('e3', 'button', 'Open details', [10, 150, 120, 32]),
    ]);
  });

  it('includes readable text inside scroll areas for page reading', () => {
    document.body.innerHTML = `
      <main id="doc" aria-label="Document body" style="overflow-y: auto">
        <article id="article">
          <h1 id="title">Visible architecture notes</h1>
          <p id="paragraph">The body text inside the scroll area should be returned.</p>
        </article>
      </main>
    `;
    setViewportSize(1024, 768);

    const doc = document.getElementById('doc')!;
    const title = document.getElementById('title')!;
    const paragraph = document.getElementById('paragraph')!;
    Object.defineProperty(doc, 'clientHeight', { configurable: true, value: 400 });
    Object.defineProperty(doc, 'scrollHeight', { configurable: true, value: 1200 });
    setRect(doc, makeRect(0, 64, 1024, 400));
    setRect(title, makeRect(120, 96, 640, 36));
    setRect(paragraph, makeRect(120, 150, 760, 32));
    spyElementFromPoint(document).mockReturnValue(paragraph);

    const snapshot = readCurrentPageElements(document, window);

    expect(snapshot.items).toEqual([
      pageElementItem('e1', 'scrollarea', 'Document body', [0, 64, 1024, 400], { s: 'y' }),
      pageElementItem('e2', 'heading', 'Visible architecture notes', [120, 96, 640, 36]),
      pageElementItem('e3', 'text', 'The body text inside the scroll area should be returned.', [120, 150, 760, 32]),
    ]);
  });

  it('does not mark scroll areas writable just because they contain an input', () => {
    document.body.innerHTML = `
      <main id="doc" aria-label="Document body" style="overflow-y: auto">
        <input id="filter" placeholder="Filter rows" />
        <p id="paragraph">Scrollable copy remains readable.</p>
      </main>
    `;
    setViewportSize(1024, 768);

    const doc = document.getElementById('doc')!;
    const filter = document.getElementById('filter')!;
    const paragraph = document.getElementById('paragraph')!;
    Object.defineProperty(doc, 'clientHeight', { configurable: true, value: 400 });
    Object.defineProperty(doc, 'scrollHeight', { configurable: true, value: 1200 });
    setRect(doc, makeRect(0, 64, 1024, 400));
    setRect(filter, makeRect(120, 96, 220, 32));
    setRect(paragraph, makeRect(120, 150, 760, 32));
    spyElementFromPoint(document).mockImplementation((_x, y) => y < 140 ? filter : paragraph);

    const snapshot = readCurrentPageElements(document, window);

    expect(snapshot.items).toEqual([
      pageElementItem('e1', 'scrollarea', 'Document body', [0, 64, 1024, 400], { s: 'y' }),
      writableItem('e2', 'textbox', 'Filter rows', [120, 96, 220, 32], { h: 'Filter rows', t: 'text' }),
      pageElementItem('e3', 'text', 'Scrollable copy remains readable.', [120, 150, 760, 32]),
    ]);
  });

  it('splits long fallback text blocks instead of dropping the tail', () => {
    const firstChunk = 'A'.repeat(240);
    const tailChunk = 'B'.repeat(16);
    document.body.innerHTML = `<article id="long-copy">${firstChunk}${tailChunk}</article>`;
    setViewportSize(1024, 768);

    const longCopy = document.getElementById('long-copy')!;
    setRect(longCopy, makeRect(10, 20, 720, 120));
    spyElementFromPoint(document).mockReturnValue(longCopy);

    const snapshot = readCurrentPageElements(document, window);

    expect(snapshot.items).toEqual([
      pageElementItem('e1', 'text', firstChunk, [10, 20, 720, 120]),
      pageElementItem('e2', 'text', tailChunk, [10, 20, 720, 120]),
    ]);
  });

  it('does not duplicate text already represented by an interactive element name', () => {
    document.body.innerHTML = `
      <span id="save-label">Save changes</span>
      <button id="save" aria-labelledby="save-label"></button>
    `;
    setViewportSize(1024, 768);

    const label = document.getElementById('save-label')!;
    const save = document.getElementById('save')!;
    setRect(label, makeRect(10, 20, 120, 24));
    setRect(save, makeRect(10, 60, 100, 40));
    spyElementFromPoint(document).mockReturnValue(save);

    const snapshot = readCurrentPageElements(document, window);

    expect(snapshot.items).toEqual([
      operableItem('e1', 'button', 'Save changes', [10, 60, 100, 40]),
    ]);
  });

  it('skips expensive style reads for offscreen candidates before deeper filtering', () => {
    document.body.innerHTML = [
      '<button id="visible">Visible</button>',
      ...Array.from({ length: 80 }, (_value, index) => `<button id="offscreen-${index}">Offscreen ${index}</button>`),
    ].join('');
    setViewportSize(1024, 768);

    const visible = document.getElementById('visible')!;
    setRect(visible, makeRect(10, 20, 100, 32));
    for (let index = 0; index < 80; index += 1) {
      setRect(document.getElementById(`offscreen-${index}`)!, makeRect(10, 5000 + index * 40, 100, 32));
    }
    spyElementFromPoint(document).mockReturnValue(visible);
    const originalGetComputedStyle = window.getComputedStyle.bind(window);
    const getComputedStyleSpy = vi
      .spyOn(window, 'getComputedStyle')
      .mockImplementation((element, pseudoElement) => originalGetComputedStyle(element, pseudoElement));

    const snapshot = readCurrentPageElements(document, window);

    expect(snapshot.items).toEqual([
      operableItem('e1', 'button', 'Visible', [10, 20, 100, 32]),
    ]);
    expect(getComputedStyleSpy.mock.calls.length).toBeLessThan(20);
  });

  it('combines nested icon semantics with visible button counts and removes the icon child', () => {
    document.body.innerHTML = `
      <button id="like">
        <span id="like-icon" data-icon="thumbs-up" style="cursor: pointer"></span>
        <span id="like-count">32.2K</span>
      </button>
    `;
    setViewportSize(1024, 768);

    const like = document.getElementById('like')!;
    const icon = document.getElementById('like-icon')!;
    const count = document.getElementById('like-count')!;
    setRect(like, makeRect(10, 20, 80, 32));
    setRect(icon, makeRect(16, 28, 16, 16));
    setRect(count, makeRect(38, 26, 46, 20));

    spyElementFromPoint(document).mockImplementation((x) => x < 36 ? icon : count);

    const snapshot = readCurrentPageElements(document, window);

    expect(snapshot.items).toEqual([
      operableItem('e1', 'button', 'like 32.2K', [10, 20, 80, 32]),
    ]);
  });

  it('combines comment icon semantics with visible counts', () => {
    document.body.innerHTML = `
      <button id="comments">
        <span id="comment-icon" data-icon="message-circle"></span>
        <span id="comment-count">922</span>
      </button>
    `;
    setViewportSize(1024, 768);

    const comments = document.getElementById('comments')!;
    const icon = document.getElementById('comment-icon')!;
    const count = document.getElementById('comment-count')!;
    setRect(comments, makeRect(10, 20, 80, 32));
    setRect(icon, makeRect(16, 28, 16, 16));
    setRect(count, makeRect(38, 26, 32, 20));

    spyElementFromPoint(document).mockImplementation((x) => x < 36 ? icon : count);

    const snapshot = readCurrentPageElements(document, window);

    expect(snapshot.items).toEqual([
      operableItem('e1', 'button', 'comments 922', [10, 20, 80, 32]),
    ]);
  });

  it('includes compact semantic icon controls even when they do not expose pointer cursor', () => {
    document.body.innerHTML = `
      <span id="open" data-icon="external-link"></span>
      <span id="help" data-testid="help-circle"></span>
    `;
    setViewportSize(1024, 768);

    const open = document.getElementById('open')!;
    const help = document.getElementById('help')!;
    setRect(open, makeRect(10, 20, 28, 28));
    setRect(help, makeRect(50, 20, 28, 28));

    spyElementFromPoint(document).mockImplementation((x) => x < 40 ? open : help);

    const snapshot = readCurrentPageElements(document, window);

    expect(snapshot.items).toEqual([
      operableItem('e1', 'button', 'open', [10, 20, 28, 28]),
      operableItem('e2', 'button', 'help', [50, 20, 28, 28]),
    ]);
  });

  it('deduplicates semantic icon children under named compact parent controls', () => {
    document.body.innerHTML = `
      <button id="run" aria-label="Run">
        <span id="play" data-icon="play" style="cursor: pointer"></span>
      </button>
      <a id="previous-link" href="/previous" aria-label="Prev Question">
        <span id="previous-icon" data-icon="chevron-left" style="cursor: pointer"></span>
      </a>
    `;
    setViewportSize(1024, 768);

    const run = document.getElementById('run')!;
    const play = document.getElementById('play')!;
    const previousLink = document.getElementById('previous-link')!;
    const previousIcon = document.getElementById('previous-icon')!;
    setRect(run, makeRect(10, 20, 32, 32));
    setRect(play, makeRect(18, 28, 16, 16));
    setRect(previousLink, makeRect(50, 20, 32, 32));
    setRect(previousIcon, makeRect(58, 28, 16, 16));

    spyElementFromPoint(document).mockImplementation((x) => x < 45 ? play : previousIcon);

    const snapshot = readCurrentPageElements(document, window);

    expect(snapshot.items).toEqual([
      operableItem('e1', 'button', 'Run', [10, 20, 32, 32]),
      operableItem('e2', 'link', 'Prev Question', [50, 20, 32, 32]),
    ]);
  });

  it('deduplicates unlabeled nested controls under a named parent target', () => {
    document.body.innerHTML = `
      <a id="logo-link" href="/" aria-label="LeetCode Logo">
        <button id="logo-button"></button>
      </a>
    `;
    setViewportSize(1024, 768);

    const logoLink = document.getElementById('logo-link')!;
    const logoButton = document.getElementById('logo-button')!;
    setRect(logoLink, makeRect(20, 13, 21, 22));
    setRect(logoButton, makeRect(20, 13, 21, 20));

    spyElementFromPoint(document).mockReturnValue(logoButton);

    const snapshot = readCurrentPageElements(document, window);

    expect(snapshot.items).toEqual([
      operableItem('e1', 'link', 'LeetCode Logo', [20, 13, 21, 22]),
    ]);
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
    setViewportSize(800, 600);

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

    const snapshot = readCurrentPageElements(document, window);

    expect(snapshot.items).toEqual([
      operableItem('e1', 'button', 'Enabled', [20, 20, 80, 30]),
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

    const wrapper = document.getElementById('wrapper')!;
    const username = document.getElementById('username')!;
    setRect(wrapper, makeRect(200, 120, 680, 80));
    setRect(username, makeRect(365, 140, 685, 52));
    spyElementFromPoint(document).mockReturnValue(wrapper);

    const snapshot = readCurrentPageElements(document, window);

    expect(snapshot.items).toEqual([
      writableItem('e1', 'textbox', '用户名', [200, 120, 680, 80], { h: '请设置用户名', t: 'text' }),
    ]);
  });

  it('exposes a visible form-item wrapper when the nested input is visually proxied', () => {
    document.body.innerHTML = `
      <p id="phone-wrapper" class="pass-form-item">
        <label for="phone">手机号</label>
        <input id="phone" type="text" placeholder="可用于登录和找回密码" style="opacity: 0" />
      </p>
    `;

    const wrapper = document.getElementById('phone-wrapper')!;
    const phone = document.getElementById('phone')!;
    setRect(wrapper, makeRect(365, 220, 685, 52));
    setRect(phone, makeRect(365, 220, 0, 0));
    spyElementFromPoint(document).mockReturnValue(wrapper);

    const snapshot = readCurrentPageElements(document, window);

    expect(snapshot.items).toEqual([
      writableItem('e1', 'textbox', '手机号', [365, 220, 685, 52], { h: '可用于登录和找回密码', t: 'text' }),
    ]);
  });

  it('exposes Ant Cascader pickers as operable comboboxes instead of inner inputs', () => {
    document.body.innerHTML = `
      <span id="picker" class="ant-cascader-picker ant-cascader-picker-show-search" tabindex="0">
        <span class="ant-cascader-picker-label"></span>
        <input id="inner-input" tabindex="-1" placeholder="请选择" class="ant-input ant-cascader-input" autocomplete="off" type="text" value="" />
        <span class="ant-cascader-picker-arrow"></span>
      </span>
    `;
    setViewportSize(1728, 827);

    const picker = document.getElementById('picker')!;
    const input = document.getElementById('inner-input')!;
    setRect(picker, makeRect(708, 49, 1340, 84));
    setRect(input, makeRect(708, 49, 1340, 84));
    spyElementFromPoint(document).mockReturnValue(input);

    const snapshot = readCurrentPageElements(document, window);

    expect(snapshot.items).toEqual([
      operableItem('e1', 'combobox', '请选择', [708, 49, 1340, 84], { h: '请选择' }),
    ]);
  });

  it('exposes generic composite choice pickers from aria and nested input structure', () => {
    document.body.innerHTML = `
      <span id="picker" class="custom-choice" tabindex="0" aria-haspopup="listbox" aria-expanded="false">
        <span class="custom-choice-label"></span>
        <input id="inner-input" tabindex="-1" placeholder="Choose region" type="text" value="" />
        <span class="custom-choice-arrow"></span>
      </span>
    `;
    setViewportSize(1024, 768);

    const picker = document.getElementById('picker')!;
    const input = document.getElementById('inner-input')!;
    setRect(picker, makeRect(100, 40, 420, 44));
    setRect(input, makeRect(100, 40, 420, 44));
    spyElementFromPoint(document).mockReturnValue(input);

    const snapshot = readCurrentPageElements(document, window);

    expect(snapshot.items).toEqual([
      operableItem('e1', 'combobox', 'Choose region', [100, 40, 420, 44], { h: 'Choose region' }),
    ]);
  });

  it('exposes readonly picker surfaces instead of broad form item wrappers', () => {
    document.body.innerHTML = `
      <div class="ant-form-item">
        <div class="ant-col ant-form-item-label"><label>04 * 出生日期</label></div>
        <div class="ant-col ant-form-item-control-wrapper">
          <div class="ant-form-item-control">
            <span id="form-child" class="ant-form-item-children">
              <span id="picker" class="calendar-picker calendar-picker-large">
                <div>
                  <input id="date-input" readonly placeholder="" class="calendar-picker-input ant-input ant-input-lg" value="" />
                  <i aria-label="图标: calendar" class="calendar-picker-icon"></i>
                </div>
              </span>
            </span>
          </div>
        </div>
      </div>
    `;
    setViewportSize(2048, 673);

    const formChild = document.getElementById('form-child')!;
    const picker = document.getElementById('picker')!;
    const input = document.getElementById('date-input')!;
    setRect(formChild, makeRect(795, 106, 846, 48));
    setRect(picker, makeRect(795, 106, 394, 48));
    setRect(input, makeRect(795, 106, 394, 48));
    spyElementFromPoint(document).mockImplementation((x) => x < 1190 ? input : formChild);

    const snapshot = readCurrentPageElements(document, window);

    expect(snapshot.items).toEqual([
      operableItem('e1', 'combobox', '04 * 出生日期', [795, 106, 394, 48]),
    ]);
  });

  it('exposes Ant Cascader popup rows as selectable options', () => {
    document.body.innerHTML = `
      <div id="popup" class="ant-cascader-menus">
        <ul id="province-menu" class="ant-cascader-menu">
          <li id="beijing" class="ant-cascader-menu-item ant-cascader-menu-item-expand">北京市</li>
          <li id="hebei" class="ant-cascader-menu-item ant-cascader-menu-item-active">河北省</li>
        </ul>
        <ul id="city-menu" class="ant-cascader-menu">
          <li id="huhehaote" class="ant-cascader-menu-item">呼和浩特市</li>
        </ul>
      </div>
    `;
    setViewportSize(1728, 827);

    const beijing = document.getElementById('beijing')!;
    const hebei = document.getElementById('hebei')!;
    const huhehaote = document.getElementById('huhehaote')!;
    setRect(beijing, makeRect(730, 150, 233, 54));
    setRect(hebei, makeRect(730, 258, 233, 54));
    setRect(huhehaote, makeRect(986, 150, 168, 54));
    spyElementFromPoint(document).mockImplementation((x, y) => {
      if (x > 980) return huhehaote;
      return y < 220 ? beijing : hebei;
    });

    const snapshot = readCurrentPageElements(document, window);

    expect(snapshot.items).toEqual([
      operableItem('e1', 'option', '北京市', [730, 150, 233, 54]),
      operableItem('e2', 'option', '呼和浩特市', [986, 150, 168, 54]),
      operableItem('e3', 'option', '河北省', [730, 258, 233, 54]),
    ]);
  });

  it('exposes generic listbox menu rows as selectable options', () => {
    document.body.innerHTML = `
      <div id="popup" role="listbox">
        <div id="north" class="custom-menu-item">North</div>
        <div id="south" class="custom-menu-item">South</div>
      </div>
    `;
    setViewportSize(1024, 768);

    const north = document.getElementById('north')!;
    const south = document.getElementById('south')!;
    setRect(north, makeRect(100, 100, 180, 36));
    setRect(south, makeRect(100, 136, 180, 36));
    spyElementFromPoint(document).mockImplementation((_x, y) => y < 136 ? north : south);

    const snapshot = readCurrentPageElements(document, window);

    expect(snapshot.items).toEqual([
      operableItem('e1', 'option', 'North', [100, 100, 180, 36]),
      operableItem('e2', 'option', 'South', [100, 136, 180, 36]),
    ]);
  });

  it('exposes scrollable picker popup columns as scroll areas', () => {
    document.body.innerHTML = `
      <style>
        .custom-menu {
          overflow-y: auto;
        }
      </style>
      <div id="popup" class="custom-menus">
        <ul id="province-menu" class="custom-menu">
          <li id="beijing" class="custom-menu-item">北京市</li>
          <li id="tianjin" class="custom-menu-item">天津市</li>
          <li id="hebei" class="custom-menu-item">河北省</li>
        </ul>
      </div>
    `;
    setViewportSize(1024, 768);

    const menu = document.getElementById('province-menu')!;
    const beijing = document.getElementById('beijing')!;
    const tianjin = document.getElementById('tianjin')!;
    const hebei = document.getElementById('hebei')!;
    Object.defineProperty(menu, 'clientHeight', { configurable: true, value: 112 });
    Object.defineProperty(menu, 'scrollHeight', { configurable: true, value: 360 });
    setRect(menu, makeRect(230, 172, 300, 112));
    setRect(beijing, makeRect(256, 194, 240, 32));
    setRect(tianjin, makeRect(256, 258, 240, 32));
    setRect(hebei, makeRect(256, 900, 240, 32));
    spyElementFromPoint(document).mockImplementation((_x, y) => {
      if (y < 240) return beijing;
      if (y < 310) return tianjin;
      return hebei;
    });

    const snapshot = readCurrentPageElements(document, window);

    expect(snapshot.items).toEqual([
      pageElementItem('e1', 'scrollarea', 'scrollable area', [230, 172, 300, 112], { s: 'y' }),
      operableItem('e2', 'option', '北京市', [256, 194, 240, 32]),
      operableItem('e3', 'option', '天津市', [256, 258, 240, 32]),
    ]);
  });

  it('does not expose picker option text clipped outside its scrollable popup column', () => {
    document.body.innerHTML = `
      <style>
        .custom-menu {
          overflow-y: auto;
        }
      </style>
      <div id="popup" class="custom-menus">
        <ul id="province-menu" class="custom-menu">
          <li id="beijing" class="custom-menu-item">北京市</li>
          <li id="tianjin" class="custom-menu-item">天津市</li>
          <li id="shanghai" class="custom-menu-item">上海市</li>
        </ul>
      </div>
    `;
    setViewportSize(1024, 768);

    const menu = document.getElementById('province-menu')!;
    const beijing = document.getElementById('beijing')!;
    const tianjin = document.getElementById('tianjin')!;
    const shanghai = document.getElementById('shanghai')!;
    Object.defineProperty(menu, 'clientHeight', { configurable: true, value: 112 });
    Object.defineProperty(menu, 'scrollHeight', { configurable: true, value: 360 });
    setRect(menu, makeRect(230, 172, 300, 112));
    setRect(beijing, makeRect(256, 194, 240, 32));
    setRect(tianjin, makeRect(256, 258, 240, 32));
    setRect(shanghai, makeRect(256, 280, 240, 32));
    spyElementFromPoint(document).mockImplementation((_x, y) => {
      if (y < 240) return beijing;
      if (y < 284) return tianjin;
      return document.body;
    });

    const snapshot = readCurrentPageElements(document, window);

    expect(snapshot.items).toEqual([
      pageElementItem('e1', 'scrollarea', 'scrollable area', [230, 172, 300, 112], { s: 'y' }),
      operableItem('e2', 'option', '北京市', [256, 194, 240, 32]),
      operableItem('e3', 'option', '天津市', [256, 258, 240, 32]),
    ]);
  });

  it('exposes date picker popup cells as selectable options', () => {
    document.body.innerHTML = `
      <div id="popup" class="calendar-picker-container">
        <table>
          <tbody>
            <tr>
              <td class="calendar-cell">
                <div id="day-15" class="calendar-date">15</div>
              </td>
              <td class="calendar-cell calendar-disabled-cell">
                <div id="day-16" class="calendar-date">16</div>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    `;
    setViewportSize(1024, 768);

    const day15 = document.getElementById('day-15')!;
    const day16 = document.getElementById('day-16')!;
    setRect(day15, makeRect(400, 240, 32, 28));
    setRect(day16, makeRect(440, 240, 32, 28));
    spyElementFromPoint(document).mockImplementation((x) => x < 440 ? day15 : day16);

    const snapshot = readCurrentPageElements(document, window);

    expect(snapshot.items).toEqual([
      operableItem('e1', 'option', '15', [400, 240, 32, 28]),
    ]);
  });

  it('does not let broad date picker panels hide individual day options', () => {
    document.body.innerHTML = `
      <div id="popup" class="calendar-picker-container">
        <div id="date-panel" class="calendar-date-panel" style="cursor: pointer">
          <div id="header" class="calendar-header">previous 1999年Feb Su Mo Tu We Th Fr Sa</div>
          <table id="date-grid" role="grid" class="calendar-table">
            <tbody>
              <tr>
                <td class="calendar-cell">
                  <div id="day-17" class="calendar-date">17</div>
                </td>
                <td class="calendar-cell">
                  <div id="day-18" class="calendar-date">18</div>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    `;
    setViewportSize(1024, 768);

    const datePanel = document.getElementById('date-panel')!;
    const header = document.getElementById('header')!;
    const dateGrid = document.getElementById('date-grid')!;
    const day17 = document.getElementById('day-17')!;
    const day18 = document.getElementById('day-18')!;
    setRect(datePanel, makeRect(530, 389, 278, 305));
    setRect(header, makeRect(530, 389, 278, 42));
    setRect(dateGrid, makeRect(530, 431, 278, 263));
    setRect(day17, makeRect(650, 520, 36, 30));
    setRect(day18, makeRect(686, 520, 36, 30));
    spyElementFromPoint(document).mockImplementation((x, y) => {
      if (y < 431) {
        return header;
      }

      return x < 686 ? day17 : day18;
    });

    const snapshot = readCurrentPageElements(document, window);

    expect(snapshot.items).toEqual([
      pageElementItem('e1', 'text', 'previous 1999年Feb Su Mo Tu We Th Fr Sa', [530, 389, 278, 42]),
      operableItem('e2', 'option', '17', [650, 520, 36, 30]),
      operableItem('e3', 'option', '18', [686, 520, 36, 30]),
    ]);
  });

  it('exposes time picker popup rows as selectable options', () => {
    document.body.innerHTML = `
      <div id="popup" class="time-picker-panel">
        <ul class="time-picker-panel-select">
          <li id="hour-09" class="time-picker-panel-select-option-selected">09</li>
          <li id="hour-10" class="time-picker-panel-select-option">10</li>
        </ul>
      </div>
    `;
    setViewportSize(1024, 768);

    const hour09 = document.getElementById('hour-09')!;
    const hour10 = document.getElementById('hour-10')!;
    setRect(hour09, makeRect(520, 200, 80, 32));
    setRect(hour10, makeRect(520, 232, 80, 32));
    spyElementFromPoint(document).mockImplementation((_x, y) => y < 232 ? hour09 : hour10);

    const snapshot = readCurrentPageElements(document, window);

    expect(snapshot.items).toEqual([
      operableItem('e1', 'option', '09', [520, 200, 80, 32]),
      operableItem('e2', 'option', '10', [520, 232, 80, 32]),
    ]);
  });

  it('filters ChatBrowserX injected UI from page elements', () => {
    document.body.innerHTML = `
      <button id="page-button">Page button</button>
      <div id="chatbrowserx-root">
        <button id="plugin-button">Plugin button</button>
      </div>
      <div id="chatbrowserx-page-action-overlay">
        <button id="overlay-button">Overlay button</button>
      </div>
    `;

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

    const snapshot = readCurrentPageElements(document, window);

    expect(snapshot.items).toEqual([
      operableItem('e1', 'button', 'Page button', [20, 20, 120, 32]),
    ]);
  });

  it('adds bounded diagnostics when writable controls are present but no textbox survives', () => {
    document.body.innerHTML = `
      <button id="login">登录</button>
      <input id="TANGRAM__PSP_4__userName" type="text" placeholder="请设置用户名" />
    `;

    const login = document.getElementById('login')!;
    const username = document.getElementById('TANGRAM__PSP_4__userName')!;
    setRect(login, makeRect(20, 20, 80, 32));
    setRect(username, makeRect(200, 120, 680, 52));
    spyElementFromPoint(document).mockImplementation((_x, y) => y < 80 ? login : document.body);

    const snapshot = readCurrentPageElements(document, window);

    expect(snapshot.items).toEqual([
      operableItem('e1', 'button', '登录', [20, 20, 80, 32]),
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

    const wrapper = document.getElementById('TANGRAM__PSP_4__userNameWrapper')!;
    const input = document.getElementById('TANGRAM__PSP_4__userName')!;
    const overlay = document.getElementById('unrelated-overlay')!;
    setRect(wrapper, makeRect(365, 140, 685, 52));
    setRect(input, makeRect(365, 140, 685, 52));
    setRect(overlay, makeRect(365, 140, 685, 52));
    spyElementFromPoint(document).mockReturnValue(overlay);

    const snapshot = readCurrentPageElements(document, window);

    expect(snapshot.items).toEqual([
      writableItem('e1', 'textbox', '用户名', [365, 140, 685, 52], { h: '请设置用户名', t: 'text' }),
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

    const regContent = document.getElementById('reg_content')!;
    const wrapper = document.getElementById('TANGRAM__PSP_4__userNameWrapper')!;
    const input = document.getElementById('TANGRAM__PSP_4__userName')!;
    const overlay = document.getElementById('unrelated-overlay')!;
    setRect(regContent, makeRect(320, 100, 720, 482));
    setRect(wrapper, makeRect(365, 140, 685, 52));
    setRect(input, makeRect(365, 140, 685, 52));
    setRect(overlay, makeRect(320, 100, 720, 482));
    spyElementFromPoint(document).mockReturnValue(overlay);

    const snapshot = readCurrentPageElements(document, window);

    expect(snapshot.items).toEqual([
      writableItem('e1', 'textbox', '用户名', [365, 140, 685, 52], { h: '请设置用户名', t: 'text' }),
    ]);
  });

  it('does not collapse a questionnaire page shell into one viewport-sized textbox', () => {
    document.body.innerHTML = `
      <div id="app">
        <section id="question-1">
          <h2>01 <span>*</span> 你对ai的看法</h2>
          <textarea id="answer-1" aria-label="你对ai的看法"></textarea>
        </section>
        <section id="question-2">
          <h2>02 <span>*</span> 你的出行方式</h2>
          <textarea id="answer-2" aria-label="你的出行方式"></textarea>
        </section>
        <section id="question-3">
          <h2>03 <span>*</span> 你最喜欢的节目</h2>
          <textarea id="answer-3" aria-label="你最喜欢的节目"></textarea>
        </section>
        <button id="submit">提交</button>
      </div>
    `;
    setViewportSize(1728, 861);
    const app = document.getElementById('app')!;
    const question1 = document.getElementById('question-1')!;
    const question2 = document.getElementById('question-2')!;
    const question3 = document.getElementById('question-3')!;
    const answer1 = document.getElementById('answer-1')!;
    const answer2 = document.getElementById('answer-2')!;
    const answer3 = document.getElementById('answer-3')!;
    const submit = document.getElementById('submit')!;
    setRect(app, makeRect(0, 0, 1728, 861));
    setRect(question1, makeRect(109, 0, 1619, 450));
    setRect(question2, makeRect(109, 482, 1619, 521));
    setRect(question3, makeRect(109, 1037, 1619, 384));
    setRect(answer1, makeRect(234, 203, 1494, 107));
    setRect(answer2, makeRect(234, 704, 1494, 159));
    setRect(answer3, makeRect(234, 1256, 1494, 107));
    setRect(submit, makeRect(1460, 812, 96, 40));
    spyElementFromPoint(document).mockImplementation((x, y) => {
      if (x > 1400 && y > 800 && y < 860) return submit;
      if (y < 320) return answer1;
      if (y > 700 && y < 870) return answer2;
      return app;
    });

    const snapshot = readCurrentPageElements(document, window);

    expect(snapshot.items).toEqual([
      writableItem('e1', 'textbox', '你对ai的看法', [234, 203, 1494, 107]),
      writableItem('e2', 'textbox', '你的出行方式', [234, 704, 1494, 159]),
      operableItem('e3', 'button', '提交', [1460, 812, 96, 40]),
    ]);
  });

  it('ignores non-interactive explicit roles', () => {
    document.body.innerHTML = `
      <div id="status" role="status">Saved</div>
      <div id="button" role="button" aria-label="Open menu"></div>
    `;
    setViewportSize(800, 600);

    const status = document.getElementById('status')!;
    const button = document.getElementById('button')!;
    setRect(status, makeRect(20, 20, 100, 30));
    setRect(button, makeRect(20, 70, 100, 30));
    spyElementFromPoint(document).mockImplementation((_x, y) => y < 60 ? status : button);

    const snapshot = readCurrentPageElements(document, window);

    expect(snapshot.items).toEqual([
      pageElementItem('e1', 'text', 'Saved', [20, 20, 100, 30]),
      operableItem('e2', 'button', 'Open menu', [20, 70, 100, 30]),
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
    setViewportSize(800, 600);

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

    const snapshot = readCurrentPageElements(document, window);

    expect(snapshot.items).toEqual([
      operableItem('e1', 'button', 'Open panel', [20, 20, 100, 30]),
      operableItem('e2', 'button', 'Filters', [20, 70, 100, 30], { h: 'Show filters' }),
      operableItem('e3', 'button', 'CSS pointer', [20, 120, 100, 30]),
      pageElementItem('e4', 'text', 'Plain text', [20, 170, 100, 30]),
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

    const monaco = document.getElementById('monaco')!;
    const codemirror = document.getElementById('codemirror')!;
    setRect(monaco, makeRect(30, 40, 700, 360));
    setRect(codemirror, makeRect(30, 440, 700, 260));
    spyElementFromPoint(document).mockImplementation((_x, y) => y < 420 ? monaco : codemirror);

    const snapshot = readCurrentPageElements(document, window);

    expect(snapshot.items).toEqual([
      writableItem('e1', 'textbox', 'Code Editor', [30, 40, 700, 360], { t: 'code' }),
      writableItem('e2', 'textbox', 'SQL editor', [30, 440, 700, 260], { t: 'code' }),
    ]);
  });

  it('normalizes Monaco presentation line descendants to the editor surface', () => {
    document.body.innerHTML = `
      <div id="editor" class="monaco-editor" aria-label="Code Editor">
        <textarea class="inputarea monaco-mouse-cursor-text" aria-label="Editor input"></textarea>
        <div class="view-lines monaco-mouse-cursor-text" role="presentation" aria-hidden="true">
          <div id="line" class="view-line">return true;</div>
        </div>
      </div>
    `;

    const editor = document.getElementById('editor')!;
    const line = document.getElementById('line')!;
    setRect(editor, makeRect(30, 40, 797, 208));
    setRect(line, makeRect(30, 48, 797, 20));
    spyElementFromPoint(document).mockReturnValue(line);

    const snapshot = readCurrentPageElements(document, window);

    expect(snapshot.items).toEqual([
      writableItem('e1', 'textbox', 'Code Editor', [30, 40, 797, 208], { t: 'code' }),
    ]);
  });

  it('deduplicates overlapping editor accessibility textboxes against the code editor surface', () => {
    document.body.innerHTML = `
      <div id="editor" class="monaco-editor" aria-label="Code Editor"></div>
      <textarea id="a11y-textarea" aria-label="Editor content;Press Alt+F1 for Accessibility Options."></textarea>
    `;

    const editor = document.getElementById('editor')!;
    const textarea = document.getElementById('a11y-textarea')!;
    setRect(editor, makeRect(30, 40, 797, 208));
    setRect(textarea, makeRect(30, 40, 797, 208));
    spyElementFromPoint(document)
      .mockReturnValueOnce(editor)
      .mockReturnValueOnce(textarea);

    const snapshot = readCurrentPageElements(document, window);

    expect(snapshot.items).toEqual([
      writableItem('e1', 'textbox', 'Code Editor', [30, 40, 797, 208], { t: 'code' }),
    ]);
  });

  it('includes visible scrollable containers as scroll areas', () => {
    document.body.innerHTML = `
      <main id="questions" aria-label="Question list" style="overflow-y: auto">
        <section id="content">Question 3 Question 4 Question 5</section>
      </main>
    `;

    const questions = document.getElementById('questions')!;
    const content = document.getElementById('content')!;
    Object.defineProperty(questions, 'clientHeight', { configurable: true, value: 400 });
    Object.defineProperty(questions, 'scrollHeight', { configurable: true, value: 1200 });
    setRect(questions, makeRect(40, 80, 900, 400));
    setRect(content, makeRect(40, 80, 900, 1200));
    spyElementFromPoint(document).mockReturnValue(content);

    const snapshot = readCurrentPageElements(document, window);

    expect(snapshot.items).toEqual([
      pageElementItem('e1', 'scrollarea', 'Question list', [40, 80, 900, 400], { s: 'y' }),
      pageElementItem('e2', 'text', 'Question 3 Question 4 Question 5', [40, 80, 900, 1200]),
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

    const row = document.getElementById('row')!;
    const inner = document.getElementById('inner')!;
    const label = document.getElementById('label')!;
    const dot = document.getElementById('dot')!;
    setRect(row, makeRect(20, 20, 760, 40));
    setRect(inner, makeRect(36, 29, 720, 22));
    setRect(label, makeRect(60, 29, 360, 22));
    setRect(dot, makeRect(36, 32, 16, 16));
    spyElementFromPoint(document).mockReturnValue(label);

    const snapshot = readCurrentPageElements(document, window);

    expect(snapshot.items).toEqual([
      operableItem('e1', 'button', 'A. 员工A接受合作方提供的休闲旅行', [20, 20, 760, 40]),
    ]);
  });

  it('collapses checkable option children into their clickable row', () => {
    document.body.innerHTML = `
      <label id="row" style="cursor: pointer">
        <input id="radio" type="radio" name="answer" />
        <span id="label">C. 员工收到礼盒应及时申报</span>
      </label>
    `;

    const row = document.getElementById('row')!;
    const radio = document.getElementById('radio')!;
    const label = document.getElementById('label')!;
    setRect(row, makeRect(20, 20, 760, 40));
    setRect(radio, makeRect(36, 32, 16, 16));
    setRect(label, makeRect(60, 29, 360, 22));
    spyElementFromPoint(document).mockReturnValue(label);

    const snapshot = readCurrentPageElements(document, window);

    expect(snapshot.items).toEqual([
      operableItem('e1', 'button', 'C. 员工收到礼盒应及时申报', [20, 20, 760, 40], { checked: false }),
    ]);
  });

  it('registers a runtime listener for page element requests', async () => {
    const addListenerMock = globalThis.__chromeTestUtils.getRuntimeOnMessageAddListenerMock();
    registerGetPageElementsToolListener();

    const listener = addListenerMock.mock.calls.at(-1)?.[0];
    const sendResponse = vi.fn();

    document.body.innerHTML = '<button id="ok">OK</button>';
    const ok = document.getElementById('ok')!;
    setRect(ok, makeRect(1, 2, 30, 20));
    spyElementFromPoint(document).mockReturnValue(ok);

    const keepAlive = listener?.({ type: 'chatbrowserx.tool.get-page-elements.request' }, {}, sendResponse);
    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(keepAlive).toBe(true);
    expect(sendResponse).toHaveBeenCalledWith(expect.objectContaining({
      items: [operableItem('e1', 'button', 'OK', [1, 2, 30, 20])],
    }));
  });
});
