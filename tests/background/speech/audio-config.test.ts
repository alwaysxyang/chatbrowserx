import { describe, it, expect } from 'vitest';
import {
  normalizeAudioCaptureConfig,
  defaultAudioCaptureConfig,
  type AudioCaptureConfig,
} from '../../../src/background/speech/audio-config';

describe('audio-config', () => {
  describe('normalizeAudioCaptureConfig', () => {
    it('should return default config when no config provided', () => {
      const result = normalizeAudioCaptureConfig();
      expect(result).toEqual(defaultAudioCaptureConfig);
    });

    it('should return default config when empty config provided', () => {
      const result = normalizeAudioCaptureConfig({});
      expect(result).toEqual(defaultAudioCaptureConfig);
    });

    it('should override sampleRate', () => {
      const config: AudioCaptureConfig = { sampleRate: 48000 };
      const result = normalizeAudioCaptureConfig(config);
      expect(result.sampleRate).toBe(48000);
      expect(result.format).toBe(defaultAudioCaptureConfig.format);
    });

    it('should override format', () => {
      const config: AudioCaptureConfig = { format: 'pcm-float32' };
      const result = normalizeAudioCaptureConfig(config);
      expect(result.format).toBe('pcm-float32');
      expect(result.sampleRate).toBe(defaultAudioCaptureConfig.sampleRate);
    });

    it('should override chunkInterval', () => {
      const config: AudioCaptureConfig = { chunkInterval: 500 };
      const result = normalizeAudioCaptureConfig(config);
      expect(result.chunkInterval).toBe(500);
      expect(result.sampleRate).toBe(defaultAudioCaptureConfig.sampleRate);
    });

    it('should override multiple properties', () => {
      const config: AudioCaptureConfig = {
        sampleRate: 48000,
        format: 'webm',
        chunkInterval: 500,
      };
      const result = normalizeAudioCaptureConfig(config);
      expect(result).toEqual({
        sampleRate: 48000,
        format: 'webm',
        chunkInterval: 500,
      });
    });

    it('should use defaults for undefined properties in partial config', () => {
      const config: AudioCaptureConfig = {
        sampleRate: 8000,
        format: 'pcm-float32',
      };
      const result = normalizeAudioCaptureConfig(config);
      expect(result).toEqual({
        sampleRate: 8000,
        format: 'pcm-float32',
        chunkInterval: defaultAudioCaptureConfig.chunkInterval,
      });
    });
  });

  describe('defaultAudioCaptureConfig', () => {
    it('should have correct default values for speech recognition', () => {
      expect(defaultAudioCaptureConfig).toEqual({
        sampleRate: 16000,
        format: 'pcm-int16',
        chunkInterval: 250,
      });
    });
  });
});
