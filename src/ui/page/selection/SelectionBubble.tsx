import { useMemo } from 'react';
import { SelectionBubblePanel } from './SelectionBubblePanel';
import { SelectionBubbleToolbar } from './SelectionBubbleToolbar';
import { useSelectionAnchor } from './use-selection-anchor';
import { useSelectionRequest } from './use-selection-request';

/**
 * Selection-driven bubble UI for Translate / Ask AI with streaming output.
 *
 * @returns The floating selection bubble, or null when no page selection is active.
 */
export function SelectionBubble() {
  const request = useSelectionRequest();
  const anchorState = useSelectionAnchor({
    isPanelOpen: request.isPanelOpen,
    onBeforeSelectionChange: request.cancelActiveRequestAndResetPanel,
  });

  const rootStyle = useMemo(() => {
    if (!anchorState.anchor) return undefined;
    return { left: `${anchorState.anchor.left}px`, top: `${anchorState.anchor.top}px` } as const;
  }, [anchorState.anchor]);

  if (!anchorState.hasSelection || !anchorState.anchor) return null;

  return (
    <div
      ref={anchorState.rootRef}
      className="selection-bubble-root"
      data-placement={anchorState.anchor.placement}
      style={rootStyle}
    >
      <div className="selection-bubble-stack">
        {!request.isPanelOpen ? (
          <SelectionBubbleToolbar
            disabled={request.isSending}
            onRun={(mode) => void request.run(mode, anchorState.selectionText, anchorState.hasSelection)}
          />
        ) : null}

        {request.isPanelOpen ? (
          <SelectionBubblePanel
            content={request.content}
            isCopied={request.isCopied}
            onCopy={() => void request.copy()}
            onCopyReset={() => request.setIsCopied(false)}
          />
        ) : null}
      </div>
    </div>
  );
}
