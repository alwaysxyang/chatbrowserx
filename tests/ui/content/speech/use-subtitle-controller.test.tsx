import { act, renderHook, waitFor } from '@testing-library/react';
import { describe, expect, it, beforeEach } from 'vitest';
import { speechResultType, speechStartRequestType, speechStopRequestType, speechStateQueryType } from '../../../../src/shared/types/speech';
import { useSubtitleController } from '../../../../src/ui/content/speech/use-subtitle-controller';

describe('useSubtitleController', () => {
  beforeEach(() => {
    const sendMessageMock = chrome.runtime.sendMessage as unknown as ReturnType<typeof vi.fn>;
    // Mock the initial state query to return not recording
    sendMessageMock.mockResolvedValue({ ok: true, data: { isRecording: false } });
  });

  it('keeps subtitle state local instead of syncing through runtime messages', async () => {
    const sendMessageMock = chrome.runtime.sendMessage as unknown as ReturnType<typeof vi.fn>;

    renderHook(() => useSubtitleController());

    await waitFor(() => {
      // Should only call once for initial state query
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
      // Should still only have the initial query call
      expect(sendMessageMock).toHaveBeenCalledTimes(1);
    });
  });

  it('only sends runtime messages for starting and stopping recognition', async () => {
    const sendMessageMock = chrome.runtime.sendMessage as unknown as ReturnType<typeof vi.fn>;
    sendMessageMock.mockResolvedValue({ ok: true, data: null });

    const { result } = renderHook(() => useSubtitleController());

    // Wait for initial query
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
    const sendMessageMock = chrome.runtime.sendMessage as unknown as ReturnType<typeof vi.fn>;
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

  it('rolls subtitle state back when starting recognition fails', async () => {
    const sendMessageMock = chrome.runtime.sendMessage as unknown as ReturnType<typeof vi.fn>;
    // First call is state query, second is start request
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
  });

  it('rolls subtitle state back when background returns a failed start response', async () => {
    const sendMessageMock = chrome.runtime.sendMessage as unknown as ReturnType<typeof vi.fn>;
    // First call is state query, second is start request
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
  });

  it('clears subtitle state even when stopping recognition throws', async () => {
    const sendMessageMock = chrome.runtime.sendMessage as unknown as ReturnType<typeof vi.fn>;
    // First: state query, second: start, third: stop
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
  });

  it('clears subtitle state even when background returns a failed stop response', async () => {
    const sendMessageMock = chrome.runtime.sendMessage as unknown as ReturnType<typeof vi.fn>;
    // First: state query, second: start, third: stop
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
  });
});
