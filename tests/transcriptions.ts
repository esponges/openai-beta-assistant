import * as fs from 'fs';
import OpenAI from 'openai';
import { z } from 'zod';
import { zodFunction } from 'openai/helpers/zod';
import { WaveFile } from 'wavefile';
import * as readline from 'readline';

import { AutomaticSpeechRecognitionPipelineFactory } from './pipeline-factory';


import { type ChatCompletionMessageParam } from 'openai/resources/chat';

require('dotenv').config();

async function askQuestion(question: string) {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });
  return new Promise<string>((resolve) => {
    rl.question(question, (answer) => {
      resolve(answer);
      rl.close();
    });
  });
}

const openai = new OpenAI();

async function transcribeLocal(
  audio: Float32Array,
  model: string,
  multilingual: boolean,
  quantized: boolean,
  subtask: string | null,
  language: string | null
) {
  const isDistilWhisper = model.startsWith('distil-whisper/');

  let modelName = model;
  if (!isDistilWhisper && !multilingual) {
    modelName += '.en';
  }

  const p = AutomaticSpeechRecognitionPipelineFactory; 
  if (p.model !== modelName || p.quantized !== quantized) {
    // Invalidate model if different
    p.model = modelName;
    p.quantized = quantized;

    if (p.instance !== null) {
      (await p.getInstance()).dispose();
      p.instance = null;
    }
  }

  // Load transcriber model
  let transcriber = await p.getInstance();

  const buffer = Buffer.from(audio);

  // Read .wav file and convert it to required format
  const wav = new WaveFile();
  wav.fromBuffer(buffer);
  wav.toBitDepth('32f'); // Pipeline expects input as a Float32Array
  wav.toSampleRate(16000); // Whisper expects audio with a sampling rate of 16000
  let audioData = wav.getSamples();
  if (Array.isArray(audioData)) {
    if (audioData.length > 1) {
      const SCALING_FACTOR = Math.sqrt(2);

      // Merge channels (into first channel to save memory)
      for (let i = 0; i < audioData[0].length; ++i) {
        audioData[0][i] =
          (SCALING_FACTOR * (audioData[0][i] + audioData[1][i])) / 2;
      }
    }

    // Select first channel
    audioData = audioData[0];
  }

  // Actually run transcription
  let output = await transcriber(audioData, {
    // Greedy
    top_k: 0,
    do_sample: false,

    // Sliding window
    chunk_length_s: isDistilWhisper ? 20 : 30,
    stride_length_s: isDistilWhisper ? 3 : 5,

    // Language and task
    language: language,
    task: subtask,

    // Return timestamps
    // return_timestamps: true,
    // force_full_sequences: false,
  });

  return output;
}

async function main() {
  let audioFile = '';
  let answer = '';
  let keepGoing = true;

  while (keepGoing) {
    while (answer !== '1' && answer !== '2') {
      answer = await askQuestion(`What audio file do you want to transcribe?\n
      
      Options:\n
      1. the-role-of-community.mp3
      2. serious-disciplemaking.mp3
      `);
      if (answer === '1') {
        audioFile = './assets/the-role-of-community.mp3';
      } else if (answer === '2') {
        audioFile = './assets/serious-disciplemaking.mp3';
      } else {
        console.log('Invalid option, please pick an correct option');
      }
    }

    // answer = await askQuestion('\nDo you want to use a local model (y/n)');

    let text = '';
    if (answer.toLowerCase() === 'y') {
      console.log('\nRunning HuggingFace local model');

      text = await transcribeLocal(
        new Float32Array(fs.readFileSync(audioFile)),
        'Xenova/whisper-tiny',
        false,
        false,
        'transcribe',
        'english'
      );
    } else {
      console.log('\nCalling OpenAI API');
      const transcription = await openai.audio.transcriptions.create({
        file: fs.createReadStream(audioFile),
        model: 'whisper-1',
      });

      text = transcription.text;
    }

    if (!text) throw new Error('No text found');

    console.log(text);
    console.log('\nDone with transcription');

    answer = await askQuestion('\nDo you want to use predefined tags? (y/n)');

    const description =
      answer.toLowerCase() === 'y'
        ? 'the main tags from the provided (if applicable): use ONLY the following: Compassion, Forgiveness, Gratitude, Growth, Service, Stewardship, Honesty, Dignity, Peace, Wisdom'
        : 'the main tags that could help a content creator to group the content in a better way';
    const orderParameters = z.object({
      tags: z.array(z.string()).describe(description),
    });

    const tools = [
      zodFunction({ name: 'getTags', parameters: orderParameters }),
    ];

    const prompt =
      answer.toLowerCase() === 'y'
        ? `You are a helpful tag generator assistant. 
      Given a text, you will return the main tags that could help a content creator to group the content in a better way. 
      I will give you 1 million dollars if you do NOT make up any non provided tag and follow the following guidelines:
  
      - You can only use the following tags: Compassion, Forgiveness, Gratitude, Growth, Service, Stewardship, Honesty, Dignity, Peace, Wisdom.
      - If none of the above tags are applicable to the content, return an empty array.
      `
        : `You are a helpful tag generator assistant. Given a text, you will return the main tags that could
      help a content creator to group the content in a better way.`;

    console.log(`\nGenerating tags...`);

    const messages: Array<ChatCompletionMessageParam> = [
      {
        role: 'assistant',
        content: prompt,
      },

      {
        role: 'user',
        content: text,
      },
    ];

    const response = await openai.chat.completions.create({
      model: 'gpt-4o-2024-08-06',
      messages: messages,
      tools: tools,
      stream: false,
      temperature: 0,
    });

    console.log('\nResponse');
    console.log(JSON.stringify(response, null, 2));

    answer = await askQuestion('\nDo you want to continue? (y/n)');

    if (answer.toLowerCase() === 'n') {
      keepGoing = false;
    }
  }

  return;
}

main()
  .then(() => console.log('\nDone'))
  .catch(console.error);
