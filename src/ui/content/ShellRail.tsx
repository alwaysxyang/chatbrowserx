import { MessageCircleMore, Settings2, Mic, Square } from 'lucide-react';
import { translateMessage } from '../../shared/i18n/i18n';

interface ShellRailProps {
  activeView: 'chat' | 'settings';
  onSelectView: (view: 'chat' | 'settings') => void;
  onVoiceToggle?: (isActive: boolean) => void;
  isVoiceActive?: boolean;
}

export function ShellRail({ activeView, onSelectView, onVoiceToggle, isVoiceActive = false }: ShellRailProps) {
  return (
    <nav aria-label={translateMessage('shell.rail.navLabel')} className="shell-rail">
      <button
        aria-label={translateMessage('shell.rail.chat')}
        aria-pressed={activeView === 'chat'}
        className={`rail-button ${activeView === 'chat' ? 'rail-button-active' : ''}`}
        data-tooltip={translateMessage('shell.rail.chat')}
        type="button"
        onClick={() => onSelectView('chat')}
      >
        <span className="rail-icon">
          <MessageCircleMore className="h-3 w-3" strokeWidth={2.2} />
        </span>
        <span>{translateMessage('shell.rail.chat')}</span>
      </button>

      <button
        aria-label={isVoiceActive ? translateMessage('shell.rail.voiceStop') : translateMessage('shell.rail.voice')}
        aria-pressed={isVoiceActive}
        className={`rail-button ${isVoiceActive ? 'rail-button-active' : ''}`}
        data-tooltip={isVoiceActive ? translateMessage('shell.rail.voiceStop') : translateMessage('shell.rail.voice')}
        type="button"
        onClick={() => onVoiceToggle?.(!isVoiceActive)}
      >
        <span className="rail-icon">
          {isVoiceActive ? (
            <Square className="h-3 w-3" strokeWidth={2.2} />
          ) : (
            <Mic className="h-3 w-3" strokeWidth={2.2} />
          )}
        </span>
        <span>{translateMessage('shell.rail.voice')}</span>
      </button>

      <div className="rail-spacer" />

      <button
        aria-label={translateMessage('shell.rail.settings')}
        aria-pressed={activeView === 'settings'}
        className={`rail-button ${activeView === 'settings' ? 'rail-button-active' : ''}`}
        data-tooltip={translateMessage('shell.rail.settings')}
        type="button"
        onClick={() => onSelectView('settings')}
      >
        <span className="rail-icon">
          <Settings2 className="h-3 w-3" strokeWidth={2.2} />
        </span>
        <span>{translateMessage('shell.rail.settings')}</span>
      </button>
    </nav>
  );
}
