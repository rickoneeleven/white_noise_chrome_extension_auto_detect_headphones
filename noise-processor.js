class BrownNoiseProcessor extends AudioWorkletProcessor {
  constructor() {
    super();
    // Pre-generate 2 seconds of very deep brown noise
    this.bufferSize = 96000;
    this.buffer = new Float32Array(this.bufferSize);
    this.index = 0;

    // Generate deep brown noise - very slow integration for bass
    let lastOut = 0;
    for (let i = 0; i < this.bufferSize; i++) {
      const white = Math.random() * 2 - 1;
      // Slower integration = deeper/bassier
      lastOut = (lastOut + (0.004 * white)) / 1.004;
      this.buffer[i] = lastOut * 5.0;
    }

    // Crossfade ends for seamless loop (fade last 2000 samples)
    const fadeLen = 2000;
    for (let i = 0; i < fadeLen; i++) {
      const fade = i / fadeLen;
      const endIdx = this.bufferSize - fadeLen + i;
      // Blend end into start
      this.buffer[endIdx] = this.buffer[endIdx] * (1 - fade) + this.buffer[i] * fade;
    }
  }

  process(inputs, outputs, parameters) {
    const output = outputs[0];

    for (let channel = 0; channel < output.length; channel++) {
      const outputChannel = output[channel];

      for (let i = 0; i < outputChannel.length; i++) {
        outputChannel[i] = this.buffer[this.index];
        this.index = (this.index + 1) % this.bufferSize;
      }
    }
    return true;
  }
}

registerProcessor('brown-noise-processor', BrownNoiseProcessor);
