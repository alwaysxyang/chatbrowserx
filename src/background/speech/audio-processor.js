/**
 * AudioWorklet processor for capturing PCM audio data.
 * This file runs in the AudioWorklet thread, separate from the main thread.
 */

class PCMProcessor extends AudioWorkletProcessor {
  constructor(options) {
    super();

    // Get configuration from options
    this.config = options.processorOptions || {
      format: 'pcm-int16',
    };
  }

  /**
   * Converts Float32Array to Int16Array (PCM 16-bit)
   */
  float32ToInt16(float32Array) {
    const int16Array = new Int16Array(float32Array.length);
    for (let i = 0; i < float32Array.length; i++) {
      const s = Math.max(-1, Math.min(1, float32Array[i]));
      int16Array[i] = s < 0 ? s * 0x8000 : s * 0x7FFF;
    }
    return int16Array;
  }

  /**
   * Process audio data
   * @param {Float32Array[][]} inputs - Input audio data [input][channel][sample]
   * @param {Float32Array[][]} outputs - Output audio data [output][channel][sample]
   * @returns {boolean} - Return true to keep processor alive
   */
  process(inputs, outputs) {
    const input = inputs[0];
    const output = outputs[0];

    if (!input || !input.length) {
      return true;
    }

    // Copy input to output (passthrough) so audio continues playing
    const inputChannel = input[0];
    const outputChannel = output[0];
    if (inputChannel && outputChannel) {
      outputChannel.set(inputChannel);
    }

    // Process mono audio data based on format
    if (this.config.format === 'pcm-int16') {
      if (inputChannel && inputChannel.length > 0) {
        const int16Data = this.float32ToInt16(inputChannel);
        this.port.postMessage({
          type: 'audio-data',
          data: int16Data.buffer,
        }, [int16Data.buffer]);
      }
    } else if (this.config.format === 'pcm-float32') {
      if (inputChannel && inputChannel.length > 0) {
        // Create a copy since we're transferring the buffer
        const float32Data = new Float32Array(inputChannel);
        this.port.postMessage({
          type: 'audio-data',
          data: float32Data.buffer,
        }, [float32Data.buffer]);
      }
    }

    return true; // Keep processor alive
  }
}

// Register the processor
registerProcessor('pcm-processor', PCMProcessor);
