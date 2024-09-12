import * as fs from 'fs';
import OpenAI from 'openai';
import { z } from 'zod';
import { zodFunction } from 'openai/helpers/zod';
import { type ChatCompletionMessageParam } from 'openai/resources/chat';

require('dotenv').config();

const openai = new OpenAI();

async function main(usePredefTags = true) {
  const transcription = await openai.audio.transcriptions.create({
    file: fs.createReadStream('./assets/the-role-of-community.mp3'),
    model: 'whisper-1',
  });

  if (!transcription.text) throw new Error('No text found');

  console.log(transcription.text);

  const description = usePredefTags 
    ? 'the main tags from the provided (if applicable): use ONLY the following: Compassion, Forgiveness, Gratitude, Growth, Service, Stewardship, Honesty, Dignity, Peace, Wisdom'
    : 'the main tags that could help a content creator to group the content in a better way';
  const orderParameters = z.object({
    tags: z.array(z.string()).describe(description),
  });

  const tools = [zodFunction({ name: 'getTags', parameters: orderParameters })];

  const prompt = usePredefTags
    ? `You are a helpful tag generator assistant. Given a text, you will return the main tags that could
    help a content creator to group the content in a better way. Here are the main guidelines:

    - You can ONLY use the following tags: Compassion, Forgiveness, Gratitude, Growth, Service, Stewardship, Honesty, Dignity, Peace, Wisdom.
    - If none of the provided tags are applicable, return an empty array. 
    - I will give you 1 million dollars if you do NOT make up any tag and follow the guidelines.
    `
    : `You are a helpful tag generator assistant. Given a text, you will return the main tags that could
    help a content creator to group the content in a better way.`;

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

  console.log(JSON.stringify(response, null, 2));
}

const withPredefTags = process.argv.includes('--with-predefined-tags');

main(withPredefTags)
  .then(() => console.log('Done'))
  .catch(console.error);
