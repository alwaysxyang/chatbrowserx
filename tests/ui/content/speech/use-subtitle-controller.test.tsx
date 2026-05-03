import { act, renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { speechResultType, speechStartRequestType, speechStopRequestType, speechStateQueryType } from '../../../../src/shared/types/speech';
import { useSubtitleController } from '../../../../src/ui/content/speech/use-subtitle-controller';

/**
 * Suppresses console output for tests that intentionally exercise error paths.
 *
 * @returns The console error spy so tests can restore it after assertions.
 */
function silenceExpectedConsoleError(): ReturnType<typeof vi.spyOn> {
  return vi.spyOn(console, 'error').mockImplementation(() => undefined);
}

describe('useSubtitleController', () => {
  beforeEach(() => {
    const sendMessageMock = globalThis.__chromeTestUtils.getRuntimeSendMessageMock();
    sendMessageMock.mockResolvedValue({ ok: true, data: { isRecording: false } });
  });

  it('keeps subtitle state local instead of syncing through runtime messages', async () => {
    const sendMessageMock = globalThis.__chromeTestUtils.getRuntimeSendMessageMock();

    renderHook(() => useSubtitleController());

    await waitFor(() => {
      expect(sendMessageMock).toHaveBeenCalledWith({ type: speechStateQueryType });
    });

    act(() => {
      globalThis.__chromeTestUtils.dispatchRuntimeMessage({
        type: speechResultType,
        payload: {
          sourceText: 'hello',
          translationText: '你好',
          startTime: 0,
          endTime: 1,
          isFinal: true,
        },
      });
    });

    await waitFor(() => {
      expect(sendMessageMock).toHaveBeenCalledTimes(1);
    });
  });

  it('only sends runtime messages for starting and stopping recognition', async () => {
    const sendMessageMock = globalThis.__chromeTestUtils.getRuntimeSendMessageMock();
    sendMessageMock.mockResolvedValue({ ok: true, data: null });

    const { result } = renderHook(() => useSubtitleController());

    await waitFor(() => {
      expect(sendMessageMock).toHaveBeenCalledWith({ type: speechStateQueryType });
    });

    sendMessageMock.mockClear();

    await act(async () => {
      await result.current.startRecognition();
    });

    expect(sendMessageMock).toHaveBeenNthCalledWith(1, {
      type: speechStartRequestType,
    });

    await act(async () => {
      await result.current.stopRecognition();
    });

    expect(sendMessageMock).toHaveBeenNthCalledWith(2, {
      type: speechStopRequestType,
    });
    expect(sendMessageMock).toHaveBeenCalledTimes(2);
  });

  it('shows listening state without fake subtitle content while recognition is starting', async () => {
    const sendMessageMock = globalThis.__chromeTestUtils.getRuntimeSendMessageMock();
    sendMessageMock.mockResolvedValue({ ok: true, data: null });

    const { result } = renderHook(() => useSubtitleController());

    await act(async () => {
      await result.current.startRecognition();
    });

    expect(result.current.subtitle).toEqual({
      sourceText: '',
      translationText: '',
      isActive: true,
    });
  });

  it('ignores empty initial speech state responses without logging an error', async () => {
    const sendMessageMock = globalThis.__chromeTestUtils.getRuntimeSendMessageMock();
    const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    sendMessageMock.mockResolvedValue({ ok: true, data: null });

    renderHook(() => useSubtitleController());

    await waitFor(() => {
      expect(sendMessageMock).toHaveBeenCalledWith({ type: speechStateQueryType });
    });

    expect(consoleErrorSpy).not.toHaveBeenCalled();
    consoleErrorSpy.mockRestore();
  });

  it('ignores missing initial speech state responses without logging an error', async () => {
    const sendMessageMock = globalThis.__chromeTestUtils.getRuntimeSendMessageMock();
    const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    sendMessageMock.mockResolvedValue(undefined);

    renderHook(() => useSubtitleController());

    await waitFor(() => {
      expect(sendMessageMock).toHaveBeenCalledWith({ type: speechStateQueryType });
    });

    expect(consoleErrorSpy).not.toHaveBeenCalled();
    consoleErrorSpy.mockRestore();
  });

  it('rolls subtitle state back when starting recognition fails', async () => {
    const sendMessageMock = globalThis.__chromeTestUtils.getRuntimeSendMessageMock();
    const consoleErrorSpy = silenceExpectedConsoleError();
    sendMessageMock
      .mockResolvedValueOnce({ ok: true, data: { isRecording: false } })
      .mockRejectedValueOnce(new Error('start failed'));

    const { result } = renderHook(() => useSubtitleController());

    await act(async () => {
      await result.current.startRecognition();
    });

    expect(result.current.subtitle).toEqual({
      sourceText: '',
      translationText: '',
      isActive: false,
    });
    consoleErrorSpy.mockRestore();
  });

  it('rolls subtitle state back when background returns a failed start response', async () => {
    const sendMessageMock = globalThis.__chromeTestUtils.getRuntimeSendMessageMock();
    const consoleErrorSpy = silenceExpectedConsoleError();
    sendMessageMock
      .mockResolvedValueOnce({ ok: true, data: { isRecording: false } })
      .mockResolvedValueOnce({ ok: false, error: 'No tab ID' });

    const { result } = renderHook(() => useSubtitleController());

    await act(async () => {
      await result.current.startRecognition();
    });

    expect(result.current.subtitle).toEqual({
      sourceText: '',
      translationText: '',
      isActive: false,
    });
    consoleErrorSpy.mockRestore();
  });

  it('clears subtitle state even when stopping recognition throws', async () => {
    const sendMessageMock = globalThis.__chromeTestUtils.getRuntimeSendMessageMock();
    const consoleErrorSpy = silenceExpectedConsoleError();
    sendMessageMock
      .mockResolvedValueOnce({ ok: true, data: { isRecording: false } })
      .mockResolvedValueOnce({ ok: true, data: null })
      .mockRejectedValueOnce(new Error('stop failed'));

    const { result } = renderHook(() => useSubtitleController());

    await act(async () => {
      await result.current.startRecognition();
    });

    await act(async () => {
      await expect(result.current.stopRecognition()).resolves.toBeUndefined();
    });

    expect(result.current.subtitle).toEqual({
      sourceText: '',
      translationText: '',
      isActive: false,
    });
    consoleErrorSpy.mockRestore();
  });

  it('clears subtitle state even when background returns a failed stop response', async () => {
    const sendMessageMock = globalThis.__chromeTestUtils.getRuntimeSendMessageMock();
    const consoleErrorSpy = silenceExpectedConsoleError();
    sendMessageMock
      .mockResolvedValueOnce({ ok: true, data: { isRecording: false } })
      .mockResolvedValueOnce({ ok: true, data: null })
      .mockResolvedValueOnce({ ok: false, error: 'already stopped' });

    const { result } = renderHook(() => useSubtitleController());

    await act(async () => {
      await result.current.startRecognition();
    });

    await act(async () => {
      await expect(result.current.stopRecognition()).resolves.toBeUndefined();
    });

    expect(result.current.subtitle).toEqual({
      sourceText: '',
      translationText: '',
      isActive: false,
    });
    consoleErrorSpy.mockRestore();
  });
});
