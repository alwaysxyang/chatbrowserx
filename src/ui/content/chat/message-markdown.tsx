import Markdown, { type MarkdownToJSX } from 'markdown-to-jsx';

const markdownOptions: MarkdownToJSX.Options = {
  overrides: {
    a: {
      component: ({ children, ...props }: any) => (
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
      component: ({ children, className, ...props }: any) => {
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
    pre: {
      component: ({ children, ...props }: any) => (
        <pre {...props} className="message-markdown-pre">
          {children}
        </pre>
      ),
    },
  },
};

interface MessageMarkdownProps {
  content: string;
}

export function MessageMarkdown({ content }: MessageMarkdownProps) {
  return <Markdown options={markdownOptions}>{content}</Markdown>;
}
