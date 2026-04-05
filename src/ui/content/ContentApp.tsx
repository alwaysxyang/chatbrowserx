import { useEffect, useMemo, useRef, useState } from 'react';
import type { MouseEvent as ReactMouseEvent } from 'react';
import { MessageCircleMore, Settings2, Sparkles } from 'lucide-react';
import { isPanelCommandMessage } from '../../shared/types/runtime-messages';
import { ChatPanel } from './chat/ChatPanel';
import { useChatController } from './chat/use-chat-controller';
import { SettingsPanel } from './settings/SettingsPanel';

export function ContentApp() {
  const hostname = useMemo(() => window.location.hostname || 'default', []);
  const buildLabel = useMemo(() => `Build ${__CHATBROWSERX_BUILD_TIME__}`, []);
  const [isOpen, setIsOpen] = useState(false);
  const [activeView, setActiveView] = useState<'chat' | 'settings'>('chat');
  const [sidebarWidth, setSidebarWidth] = useState(460);
  const { messages, isSending, errorMessage, sendMessage } = useChatController(hostname);
  const resizeStateRef = useRef<{ startX: number; startWidth: number } | null>(null);

  useEffect(() => {
    const listener: typeof chrome.runtime.onMessage.addListener extends (callback: infer T) => unknown ? T : never = (message) => {
      if (!isPanelCommandMessage(message)) {
        return undefined;
      }

      if (message.payload.command === 'toggle-chat') {
        setIsOpen((current) => !current);
        setActiveView('chat');
        return undefined;
      }

      setIsOpen(true);
      setActiveView(message.payload.command === 'open-settings' ? 'settings' : 'chat');
      return undefined;
    };

    chrome.runtime.onMessage.addListener(listener);
    return () => {
      chrome.runtime.onMessage.removeListener(listener);
    };
  }, []);

  useEffect(() => {
    const handleMouseMove = (event: MouseEvent) => {
      if (!resizeStateRef.current) {
        return;
      }

      const nextWidth = resizeStateRef.current.startWidth + (resizeStateRef.current.startX - event.clientX);
      const clampedWidth = Math.max(380, Math.min(640, nextWidth));
      setSidebarWidth(clampedWidth);
    };

    const handleMouseUp = () => {
      resizeStateRef.current = null;
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);

    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, []);

  const handleResizeStart = (event: ReactMouseEvent<HTMLDivElement>) => {
    resizeStateRef.current = {
      startX: event.clientX,
      startWidth: sidebarWidth,
    };
  };

  if (!isOpen) {
    return null;
  }

  return (
    <aside className="sidebar-shell" data-testid="sidebar-shell" style={{ width: `${sidebarWidth}px` }}>
      <div className="app-frame">
        <div className="sidebar-resize-handle" data-testid="sidebar-resize-handle" onMouseDown={handleResizeStart} />
        <header className="shell-header">
          <div className="brand-block">
            <div className="brand-mark" aria-hidden="true">
              <Sparkles className="h-3.5 w-3.5" strokeWidth={2.2} />
            </div>
            <div>
              <div className="brand-title">ChatBrowserX</div>
              <div className="brand-subtitle">{buildLabel}</div>
            </div>
          </div>
          <div className="header-actions">
            <button aria-label="关闭对话框" className="icon-button" type="button" onClick={() => setIsOpen(false)}>
              ×
            </button>
          </div>
        </header>

        <div className="shell-content">
          <div className="shell-main">
            {activeView === 'chat' ? (
              <ChatPanel errorMessage={errorMessage} isSending={isSending} messages={messages} onSendMessage={sendMessage} />
            ) : (
              <SettingsPanel />
            )}
          </div>

          <nav aria-label="功能导航" className="shell-rail">
            <button
              aria-label="聊天"
              aria-pressed={activeView === 'chat'}
              className={`rail-button ${activeView === 'chat' ? 'rail-button-active' : ''}`}
              type="button"
              onClick={() => setActiveView('chat')}
            >
              <span className="rail-icon">
                <MessageCircleMore className="h-3 w-3" strokeWidth={2.2} />
              </span>
              <span>聊天</span>
            </button>

            <div className="rail-spacer" />

            <button
              aria-label="设置"
              aria-pressed={activeView === 'settings'}
              className={`rail-button ${activeView === 'settings' ? 'rail-button-active' : ''}`}
              type="button"
              onClick={() => setActiveView('settings')}
            >
              <span className="rail-icon">
                <Settings2 className="h-3 w-3" strokeWidth={2.2} />
              </span>
              <span>设置</span>
            </button>
          </nav>
        </div>
      </div>
    </aside>
  );
}
