import { MessageCircleMore, Settings2 } from 'lucide-react';

interface ShellRailProps {
  activeView: 'chat' | 'settings';
  onSelectView: (view: 'chat' | 'settings') => void;
}

export function ShellRail({ activeView, onSelectView }: ShellRailProps) {
  return (
    <nav aria-label="功能导航" className="shell-rail">
      <button
        aria-label="聊天"
        aria-pressed={activeView === 'chat'}
        className={`rail-button ${activeView === 'chat' ? 'rail-button-active' : ''}`}
        data-tooltip="聊天"
        type="button"
        onClick={() => onSelectView('chat')}
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
        data-tooltip="设置"
        type="button"
        onClick={() => onSelectView('settings')}
      >
        <span className="rail-icon">
          <Settings2 className="h-3 w-3" strokeWidth={2.2} />
        </span>
        <span>设置</span>
      </button>
    </nav>
  );
}
