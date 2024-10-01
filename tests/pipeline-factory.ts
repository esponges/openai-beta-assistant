// @ts-nocheck
// import { pipeline, env } from '@xenova/transformers';
const TransformersApi = Function('return import("@xenova/transformers")')();

// Disable local models
// env.allowLocalModels = false;

class PipelineFactory {
  static task = null;
  static model = null;
  static quantized = null;
  static instance = null;

  constructor(tokenizer, model, quantized) {
      this.tokenizer = tokenizer;
      this.model = model;
      this.quantized = quantized;
  }

  static async getInstance(cb = null) {
      if (this.instance === null) {
          const { pipeline } = await TransformersApi;
          this.instance = pipeline(this.task, this.model, {
              quantized: this.quantized,
              cb,

              // For medium models, we need to load the `no_attentions` revision to avoid running out of memory
              revision: this.model.includes("/whisper-medium") ? "no_attentions" : "main"
          });
      }

      return this.instance;
  }
}

export class AutomaticSpeechRecognitionPipelineFactory extends PipelineFactory {
  static task = "automatic-speech-recognition";
  static model = null;
  static quantized = null;
}
