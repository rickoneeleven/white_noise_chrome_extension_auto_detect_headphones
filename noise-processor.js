class BrownNoiseProcessor extends AudioWorkletProcessor {
  constructor() {
    super();
    // Multiple integrators for deeper bass
    this.b0 = 0;
    this.b1 = 0;
    this.b2 = 0;
  }

  process(inputs, outputs, parameters) {
    const output = outputs[0];

    for (let channel = 0; channel < output.length; channel++) {
      const outputChannel = output[channel];

      for (let i = 0; i < outputChannel.length; i++) {
        const white = Math.random() * 2 - 1;

        // Deep rumble: cascaded integrators for very low frequency content
        // First stage - heavy integration
        this.b0 = (this.b0 + (0.01 * white)) / 1.01;

        // Second stage - more integration for deeper bass
        this.b1 = (this.b1 + (0.005 * this.b0)) / 1.005;

        // Third stage - even deeper
        this.b2 = (this.b2 + (0.003 * this.b1)) / 1.003;

        // Mix stages: more weight on deeper stages
        const mix = (this.b0 * 0.2) + (this.b1 * 0.4) + (this.b2 * 0.6);

        outputChannel[i] = mix * 8.0; // Boost to compensate for low frequencies
      }
    }
    return true;
  }
}

registerProcessor('brown-noise-processor', BrownNoiseProcessor);
