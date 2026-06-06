import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { render } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { MessageMarkdown } from '../../../src/ui/shared/MessageMarkdown';

describe('MessageMarkdown', () => {
  it('adds a scoped class to markdown lists', () => {
    const { container } = render(<MessageMarkdown content={'1. 父项\n   - 子项'} />);

    const orderedList = container.querySelector('ol');
    const unorderedList = container.querySelector('ol > li > ul');

    expect(orderedList).toHaveClass('message-markdown-list');
    expect(unorderedList).toHaveClass('message-markdown-list');
  });

  it('defines compact four-character list indentation with enough specificity to beat chat container list rules', () => {
    const stylesheet = readFileSync(join(process.cwd(), 'src/ui/shared/message-markdown.css'), 'utf8');

    expect(stylesheet).toContain('.message-markdown-list.message-markdown-list');
    expect(stylesheet).toContain('padding-left: 4ch');
    expect(stylesheet).toContain('padding-inline-start: 4ch');
  });
});
