import Markdown, { type MarkdownToJSX } from 'markdown-to-jsx';
import type { ComponentPropsWithoutRef } from 'react';

type MarkdownAnchorProps = ComponentPropsWithoutRef<'a'>;
type MarkdownCodeProps = ComponentPropsWithoutRef<'code'>;
type MarkdownOrderedListProps = ComponentPropsWithoutRef<'ol'>;
type MarkdownPreProps = ComponentPropsWithoutRef<'pre'>;
type MarkdownUnorderedListProps = ComponentPropsWithoutRef<'ul'>;

const markdownOptions: MarkdownToJSX.Options = {
  overrides: {
    a: {
      component: ({ children, ...props }: MarkdownAnchorProps) => (
        <a
          {...props}
          target="_blank"
          rel="noopener noreferrer"
          className="message-markdown-link"
        >
          {children}
        </a>
      ),
    },
    code: {
      component: ({ children, className, ...props }: MarkdownCodeProps) => {
        const isBlock = typeof className === 'string' && className.includes('lang-');

        return (
          <code
            {...props}
            className={`message-markdown-code ${isBlock ? 'message-markdown-code-block' : 'message-markdown-code-inline'} ${
              className ?? ''
            }`}
          >
            {children}
          </code>
        );
      },
    },
    ol: {
      component: ({ children, className, ...props }: MarkdownOrderedListProps) => (
        <ol {...props} className={`message-markdown-list ${className ?? ''}`.trim()}>
          {children}
        </ol>
      ),
    },
    pre: {
      component: ({ children, ...props }: MarkdownPreProps) => (
        <pre {...props} className="message-markdown-pre">
          {children}
        </pre>
      ),
    },
    ul: {
      component: ({ children, className, ...props }: MarkdownUnorderedListProps) => (
        <ul {...props} className={`message-markdown-list ${className ?? ''}`.trim()}>
          {children}
        </ul>
      ),
    },
  },
};

interface MessageMarkdownProps {
  content: string;
}

/**
 * Renders Markdown text with shared ChatBrowserX link and code styling.
 *
 * @param props - Markdown rendering inputs.
 * @returns A Markdown-rendered React node tree.
 */
export function MessageMarkdown({ content }: MessageMarkdownProps) {
  return <Markdown options={markdownOptions}>{content}</Markdown>;
}
