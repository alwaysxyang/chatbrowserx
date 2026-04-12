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

    // Initialize resampling state
    this.targetSampleRate = this.config.targetSampleRate;
  }

  /**
   * Simple linear interpolation resampling
   */
  resample(inputData, inputSampleRate, outputSampleRate) {
    if (inputSampleRate === outputSampleRate) {
      return inputData;
    }

    const ratio = inputSampleRate / outputSampleRate;
    const outputLength = Math.round(inputData.length / ratio);
    const output = new Float32Array(outputLength);

    for (let i = 0; i < outputLength; i++) {
      const position = i * ratio;
      const index = Math.floor(position);
      const fraction = position - index;

      if (index + 1 < inputData.length) {
        output[i] = inputData[index] * (1 - fraction) + inputData[index + 1] * fraction;
      } else {
        output[i] = inputData[index];
      }
    }

    return output;
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
    if (!input || !input.length) {
      return true;
    }

    const inputChannel = input[0];
    if (!inputChannel || inputChannel.length === 0) {
      return true;
    }

    // Resample if target sample rate is specified and different from current
    let processedData = inputChannel;
    if (this.targetSampleRate && this.targetSampleRate !== sampleRate) {
      // sampleRate is a global variable in AudioWorklet context
      processedData = this.resample(inputChannel, sampleRate, this.targetSampleRate);
    }

    if (this.config.format === 'pcm-int16') {
      const int16Data = this.float32ToInt16(processedData);
      this.port.postMessage({
        type: 'audio-data',
        data: int16Data.buffer,
      });
    } else if (this.config.format === 'pcm-float32') {
      const float32Data = new Float32Array(processedData);
      this.port.postMessage({
        type: 'audio-data',
        data: float32Data.buffer,
      });
    }

    return true;
  }
}

// Register the processor
registerProcessor('pcm-processor', PCMProcessor);
