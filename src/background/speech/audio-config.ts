export interface AudioCaptureConfig {
  sampleRate?: number;
  format?: 'pcm-int16' | 'pcm-float32' | 'webm';
  chunkInterval?: number;
}

export const defaultAudioCaptureConfig: AudioCaptureConfig = {
  sampleRate: 16000,
  format: 'webm',
  chunkInterval: 250,
};

/**
 * Normalizes audio capture configuration by applying defaults.
 *
 * @param config - Optional capture config.
 * @returns Capture config with defaults applied.
 */
export function normalizeAudioCaptureConfig(
  config?: AudioCaptureConfig,
): AudioCaptureConfig {
  return {
    sampleRate: config?.sampleRate ?? defaultAudioCaptureConfig.sampleRate,
    format: config?.format ?? defaultAudioCaptureConfig.format,
    chunkInterval: config?.chunkInterval ?? defaultAudioCaptureConfig.chunkInterval,
  };
}
