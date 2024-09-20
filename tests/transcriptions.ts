import * as fs from 'fs';
import OpenAI from 'openai';
import { z } from 'zod';
import { zodFunction } from 'openai/helpers/zod';
import { type ChatCompletionMessageParam } from 'openai/resources/chat';
import * as readline from 'readline';

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

async function main() {
  let audioFile = '';
  let answer = '';
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

  const transcription = await openai.audio.transcriptions.create({
    file: fs.createReadStream(audioFile),
    model: 'whisper-1',
  });

  if (!transcription.text) throw new Error('No text found');

  console.log(transcription.text);

  console.log('\nDone with transcription');

  answer = await askQuestion('\nDo you want to use predefined tags? (y/n)');

  const description = answer.toLowerCase() === 'y' 
    ? 'the main tags from the provided (if applicable): use ONLY the following: Compassion, Forgiveness, Gratitude, Growth, Service, Stewardship, Honesty, Dignity, Peace, Wisdom'
    : 'the main tags that could help a content creator to group the content in a better way';
  const orderParameters = z.object({
    tags: z.array(z.string()).describe(description),
  });

  const tools = [zodFunction({ name: 'getTags', parameters: orderParameters })];

  const prompt = answer.toLowerCase() === 'y'
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
      content: transcription.text,
    },
  ];

  const response = await openai.chat.completions.create({
    model: 'gpt-4o-2024-08-06',
    messages: messages,
    tools: tools,
    stream: false,
  });

  console.log('\nResponse');
  console.log(JSON.stringify(response, null, 2));

  return;
}

main()
  .then(() => console.log('\nDone'))
  .catch(console.error);
