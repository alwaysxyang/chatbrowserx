import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

describe('selection module dependencies', () => {
  it('does not depend on chat-specific copy helpers', () => {
    const source = readFileSync(
      join(process.cwd(), 'src/ui/page/selection/use-selection-request.ts'),
      'utf8',
    );

    expect(source).not.toContain('../../content/chat/copy-message-content');
  });
});
