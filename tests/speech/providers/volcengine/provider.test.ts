import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { VolcengineProvider } from '../../../../src/speech/providers/volcengine/provider';
import type { RecognitionResult } from '../../../../src/shared/types/speech';

// Mock WebSocket
class MockWebSocket {
  static CONNECTING = 0;
  static OPEN = 1;
  static CLOSING = 2;
  static CLOSED = 3;

  readyState = MockWebSocket.CONNECTING;
  onopen: ((event: Event) => void) | null = null;
  onmessage: ((event: MessageEvent) => void) | null = null;
  onerror: ((event: Event) => void) | null = null;
  onclose: ((event: CloseEvent) => void) | null = null;

  sentMessages: string[] = [];
  private eventListeners: Map<string, Array<(e: any) => void>> = new Map();

  constructor(public url: string) {
    // Simulate connection opening asynchronously
    setTimeout(() => {
      this.readyState = MockWebSocket.OPEN;
      const event = new Event('open');

      // Trigger onopen handler
      this.onopen?.(event);

      // Trigger addEventListener handlers
      const listeners = this.eventListeners.get('open') || [];
      listeners.forEach(listener => listener(event));
    }, 0);
  }

  send(data: string): void {
    this.sentMessages.push(data);
  }

  close(): void {
    this.readyState = MockWebSocket.CLOSED;
    const event = new CloseEvent('close');
    this.onclose?.(event);

    const listeners = this.eventListeners.get('close') || [];
    listeners.forEach(listener => listener(event));
  }

  addEventListener(event: string, handler: (e: any) => void, options?: any): void {
    if (!this.eventListeners.has(event)) {
      this.eventListeners.set(event, []);
    }
    this.eventListeners.get(event)!.push(handler);
  }

  // Helper to simulate receiving a message
  simulateMessage(data: any): void {
    const event = new MessageEvent('message', { data: JSON.stringify(data) });
    this.onmessage?.(event);
  }

  // Helper to simulate an error
  simulateError(): void {
    const event = new Event('error');
    this.onerror?.(event);

    const listeners = this.eventListeners.get('error') || [];
    listeners.forEach(listener => listener(event));
  }
}

describe('VolcengineProvider', () => {
  let mockWebSocketInstances: MockWebSocket[] = [];
  let originalWebSocket: typeof WebSocket;

  beforeEach(() => {
    // Save original WebSocket
    originalWebSocket = global.WebSocket;

    // Clear instances
    mockWebSocketInstances = [];

    // Mock WebSocket constructor
    global.WebSocket = class extends MockWebSocket {
      constructor(url: string) {
        super(url);
        mockWebSocketInstances.push(this);
      }
    } as any;

    // Mock crypto for signature generation
    if (!global.crypto) {
      global.crypto = {
        subtle: {
          digest: vi.fn().mockResolvedValue(new ArrayBuffer(32)),
          importKey: vi.fn().mockResolvedValue({}),
          sign: vi.fn().mockResolvedValue(new ArrayBuffer(32)),
        },
      } as any;
    }
  });

  afterEach(() => {
    // Restore original WebSocket
    global.WebSocket = originalWebSocket;
    mockWebSocketInstances = [];
  });

  describe('start', () => {
    it('should establish WebSocket connection', async () => {
      const provider = new VolcengineProvider({
        accessKey: 'test-access-key',
        secretKey: 'test-secret-key',
        sourceLanguage: 'zh',
        targetLanguages: ['en'],
      });

      const onResult = vi.fn();
      const onError = vi.fn();

      await provider.start(onResult, onError);

      // Check that WebSocket was created
      expect(mockWebSocketInstances.length).toBe(1);
      expect(mockWebSocketInstances[0].url).toContain('wss://translate.volces.com');
    });

    it('should send configuration packet on connection', async () => {
      const provider = new VolcengineProvider({
        accessKey: 'test-access-key',
        secretKey: 'test-secret-key',
        sourceLanguage: 'zh',
        targetLanguages: ['en'],
        hotWordList: [{ Word: 'test', Scale: 1.5 }],
      });

      const onResult = vi.fn();
      const onError = vi.fn();

      await provider.start(onResult, onError);

      // Wait for connection to open and config to be sent
      await new Promise(resolve => setTimeout(resolve, 20));

      // Get the mock WebSocket instance
      const ws = mockWebSocketInstances[0];

      // Check that configuration packet was sent
      expect(ws.sentMessages.length).toBeGreaterThan(0);
      const configPacket = JSON.parse(ws.sentMessages[0]);
      expect(configPacket).toHaveProperty('Configuration');
      expect(configPacket.Configuration).toEqual({
        SourceLanguage: 'zh',
        TargetLanguages: ['en'],
        HotWordList: [{ Word: 'test', Scale: 1.5 }],
      });
    });

    it('should throw error if already started', async () => {
      const provider = new VolcengineProvider({
        accessKey: 'test-access-key',
        secretKey: 'test-secret-key',
        sourceLanguage: 'zh',
        targetLanguages: ['en'],
      });

      const onResult = vi.fn();
      const onError = vi.fn();

      await provider.start(onResult, onError);

      await expect(provider.start(onResult, onError)).rejects.toThrow(
        'Volcengine provider already started',
      );
    });
  });

  describe('sendAudio', () => {
    it('should send audio data as base64', async () => {
      const provider = new VolcengineProvider({
        accessKey: 'test-access-key',
        secretKey: 'test-secret-key',
        sourceLanguage: 'zh',
        targetLanguages: ['en'],
      });

      const onResult = vi.fn();
      const onError = vi.fn();

      await provider.start(onResult, onError);
      await new Promise(resolve => setTimeout(resolve, 20));

      // Create test audio data
      const audioData = new ArrayBuffer(8);
      const view = new Uint8Array(audioData);
      view.set([1, 2, 3, 4, 5, 6, 7, 8]);

      provider.sendAudio(audioData);

      // Get the mock WebSocket instance
      const ws = mockWebSocketInstances[0];

      // Check that audio packet was sent (after config packet)
      expect(ws.sentMessages.length).toBeGreaterThan(1);
      const audioPacket = JSON.parse(ws.sentMessages[ws.sentMessages.length - 1]);
      expect(audioPacket).toHaveProperty('AudioData');
      expect(typeof audioPacket.AudioData).toBe('string');
    });

    it('should not send audio if not connected', async () => {
      const provider = new VolcengineProvider({
        accessKey: 'test-access-key',
        secretKey: 'test-secret-key',
        sourceLanguage: 'zh',
        targetLanguages: ['en'],
      });

      const audioData = new ArrayBuffer(8);

      // Should not throw, just log warning
      provider.sendAudio(audioData);
    });
  });

  describe('stop', () => {
    it('should send end packet and close connection', async () => {
      const provider = new VolcengineProvider({
        accessKey: 'test-access-key',
        secretKey: 'test-secret-key',
        sourceLanguage: 'zh',
        targetLanguages: ['en'],
      });

      const onResult = vi.fn();
      const onError = vi.fn();

      await provider.start(onResult, onError);
      await new Promise(resolve => setTimeout(resolve, 20));

      provider.stop();

      // Get the mock WebSocket instance
      const ws = mockWebSocketInstances[0];

      // Check that end packet was sent
      const endPacket = JSON.parse(ws.sentMessages[ws.sentMessages.length - 1]);
      expect(endPacket).toEqual({ End: true });

      // Check that connection was closed
      expect(ws.readyState).toBe(MockWebSocket.CLOSED);
    });
  });

  describe('message handling', () => {
    it('should process subtitle results', async () => {
      const provider = new VolcengineProvider({
        accessKey: 'test-access-key',
        secretKey: 'test-secret-key',
        sourceLanguage: 'zh',
        targetLanguages: ['en'],
      });

      const onResult = vi.fn();
      const onError = vi.fn();

      await provider.start(onResult, onError);
      await new Promise(resolve => setTimeout(resolve, 20));

      // Get the mock WebSocket instance
      const ws = mockWebSocketInstances[0];

      // Simulate receiving a subtitle
      ws.simulateMessage({
        Subtitle: {
          Text: '你好',
          BeginTime: 1000,
          EndTime: 2000,
          Definite: true,
          Language: 'zh',
          Sequence: 1,
        },
      });

      // Check that onResult was called
      expect(onResult).toHaveBeenCalledWith({
        sourceText: '你好',
        translationText: undefined,
        startTime: 1000,
        endTime: 2000,
        isFinal: true,
      });
    });

    it('should handle API errors', async () => {
      const provider = new VolcengineProvider({
        accessKey: 'test-access-key',
        secretKey: 'test-secret-key',
        sourceLanguage: 'zh',
        targetLanguages: ['en'],
      });

      const onResult = vi.fn();
      const onError = vi.fn();

      await provider.start(onResult, onError);
      await new Promise(resolve => setTimeout(resolve, 20));

      // Get the mock WebSocket instance
      const ws = mockWebSocketInstances[0];

      // Simulate receiving an error
      ws.simulateMessage({
        ResponseMetadata: {
          RequestId: 'test-request-id',
          Error: {
            Code: 'InvalidParameter',
            Message: 'Invalid source language',
          },
        },
      });

      // Check that onError was called
      expect(onError).toHaveBeenCalled();
      const error = onError.mock.calls[0][0];
      expect(error.message).toContain('InvalidParameter');
      expect(error.message).toContain('Invalid source language');
    });
  });
});
