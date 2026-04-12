import { describe, it, expect } from 'vitest';
import {
  normalizeAudioCaptureConfig,
  defaultAudioCaptureConfig,
} from '../../../src/background/speech/offscreen';

describe('audio-config', () => {
  describe('normalizeAudioCaptureConfig', () => {
    it('should return default config when no config provided', () => {
      const result = normalizeAudioCaptureConfig();
      expect(result).toEqual({
        sampleRate: 16000,
        format: 'webm',
        chunkInterval: 250,
      });
    });

    it('should return default config when empty config provided', () => {
      const result = normalizeAudioCaptureConfig({});
      expect(result).toEqual({
        sampleRate: 16000,
        format: 'webm',
        chunkInterval: 250,
      });
    });

    it('should override sampleRate', () => {
      const result = normalizeAudioCaptureConfig({
        sampleRate: 48000,
      });
      expect(result).toEqual({
        sampleRate: 48000,
        format: 'webm',
        chunkInterval: 250,
      });
    });

    it('should override format', () => {
      const result = normalizeAudioCaptureConfig({
        format: 'pcm-int16',
      });
      expect(result).toEqual({
        sampleRate: 16000,
        format: 'pcm-int16',
        chunkInterval: 250,
      });
    });

    it('should override chunkInterval', () => {
      const result = normalizeAudioCaptureConfig({
        chunkInterval: 500,
      });
      expect(result).toEqual({
        sampleRate: 16000,
        format: 'webm',
        chunkInterval: 500,
      });
    });

    it('should override multiple properties', () => {
      const result = normalizeAudioCaptureConfig({
        sampleRate: 48000,
        format: 'pcm-float32',
        chunkInterval: 500,
      });
      expect(result).toEqual({
        sampleRate: 48000,
        format: 'pcm-float32',
        chunkInterval: 500,
      });
    });

    it('should use defaults for undefined properties in partial config', () => {
      const result = normalizeAudioCaptureConfig({
        sampleRate: 48000,
        format: undefined,
        chunkInterval: undefined,
      });
      expect(result).toEqual({
        sampleRate: 48000,
        format: 'webm',
        chunkInterval: 250,
      });
    });
  });

  describe('defaultAudioCaptureConfig', () => {
    it('should have correct default values', () => {
      expect(defaultAudioCaptureConfig).toEqual({
        sampleRate: 16000,
        format: 'webm',
        chunkInterval: 250,
      });
    });
  });
});
