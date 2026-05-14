import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { MouseEvent as ReactMouseEvent } from 'react';
import { isPanelCommandMessage } from '../../shared/types/ui';
import { setCurrentUiLanguage } from '../../shared/i18n/current-language';
import type { UiLanguage } from '../../shared/types/settings';
import { defaultSettings, loadSettings } from '../../shared/storage/settings-repository';
import { getPanelStateStorageKey } from './content-panel-state';

type ContentView = 'chat' | 'settings';

interface ScreenshotSession {
  onCaptured: (dataUrl: string) => void;
}

export function useContentShell() {
  const panelStateStorageKey = useMemo(() => getPanelStateStorageKey(), []);
  const [uiLanguage, setUiLanguage] = useState<UiLanguage>(defaultSettings.general.uiLanguage);
  const [isOpen, setIsOpen] = useState(false);
  const [activeView, setActiveView] = useState<ContentView>('chat');
  const [isPinned, setIsPinned] = useState(false);
  const [hasHydratedPinned, setHasHydratedPinned] = useState(false);
  const [sidebarWidth, setSidebarWidth] = useState(460);
  const [hasHydratedLanguage, setHasHydratedLanguage] = useState(false);
  const [screenshotSession, setScreenshotSession] = useState<ScreenshotSession | null>(null);
  const [previewImageUrl, setPreviewImageUrl] = useState<string | null>(null);
  const resizeStateRef = useRef<{ startX: number; startWidth: number } | null>(null);
  const asideRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    chrome.storage.local.get(panelStateStorageKey).then((result) => {
      const persistedState = result[panelStateStorageKey] as { pinned?: boolean; open?: boolean } | undefined;
      const persistedPinned = persistedState?.pinned === true;
      const persistedOpen = persistedState?.open === true;

      setIsPinned(persistedPinned);
      if (persistedPinned && persistedOpen) {
        setIsOpen(true);
      }
      setHasHydratedPinned(true);
    });
  }, [panelStateStorageKey]);

  useEffect(() => {
    loadSettings()
      .then((settings) => {
        setCurrentUiLanguage(settings.general.uiLanguage);
        setUiLanguage(settings.general.uiLanguage);
        setHasHydratedLanguage(true);
      })
      .catch(() => {
        setHasHydratedLanguage(true);
      });
  }, []);

  useEffect(() => {
    setCurrentUiLanguage(uiLanguage);
  }, [uiLanguage]);

  useEffect(() => {
    if (!hasHydratedPinned) {
      return;
    }

    void chrome.storage.local.set({
      [panelStateStorageKey]: {
        pinned: isPinned,
        open: isOpen,
      },
    });
  }, [hasHydratedPinned, isOpen, isPinned, panelStateStorageKey]);

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
    if (!isOpen || isPinned || screenshotSession || previewImageUrl) {
      return;
    }

    const handlePointerDownOutside = (event: MouseEvent) => {
      const asideElement = asideRef.current;
      if (!asideElement) {
        return;
      }

      const path = typeof event.composedPath === 'function' ? event.composedPath() : [];
      if (path.includes(asideElement)) {
        return;
      }

      setIsOpen(false);
    };

    document.addEventListener('mousedown', handlePointerDownOutside);
    return () => {
      document.removeEventListener('mousedown', handlePointerDownOutside);
    };
  }, [isOpen, isPinned, previewImageUrl, screenshotSession]);

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

  const handleResizeStart = useCallback((event: ReactMouseEvent<HTMLDivElement>) => {
    resizeStateRef.current = {
      startX: event.clientX,
      startWidth: sidebarWidth,
    };
  }, [sidebarWidth]);

  const handleUiLanguageChange = useCallback((next: UiLanguage) => {
    setUiLanguage(next);
    setCurrentUiLanguage(next);
  }, []);

  const handleScreenshotComplete = useCallback((dataUrl: string) => {
    screenshotSession?.onCaptured(dataUrl);
    setScreenshotSession(null);
  }, [screenshotSession]);

  return {
    uiLanguage,
    isOpen,
    activeView,
    isPinned,
    sidebarWidth,
    hasHydratedLanguage,
    screenshotSession,
    previewImageUrl,
    asideRef,
    setIsOpen,
    setActiveView,
    setIsPinned,
    setPreviewImageUrl,
    handleResizeStart,
    handleUiLanguageChange,
    startScreenshotSession: setScreenshotSession,
    closeScreenshotSession: () => setScreenshotSession(null),
    handleScreenshotComplete,
  };
}
