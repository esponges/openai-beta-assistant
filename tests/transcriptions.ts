import * as fs from "fs";
import OpenAI from "openai";
import { z } from "zod";
import { zodFunction } from "openai/helpers/zod";
require('dotenv').config();
import { ChatCompletionMessageParam } from "openai/resources/chat";

const openai = new OpenAI();

async function main() {
  const transcription = await openai.audio.transcriptions.create({
    file: fs.createReadStream("./assets/open-house.mp3"),
    model: "whisper-1",
  });

  if (!transcription.text) throw new Error("No text found");

  console.log(transcription.text);

  // output:
  // Edith wasn't getting any help from anyone. She had just taken the state realty exam, which was a lengthy multiple-choice exam in downtown Los Angeles. The testing room in the government building was freezing. As she hunched up shivering, she looked around and saw others feeling equally cold. Why couldn't these people let us know beforehand to bring jackets, she wondered. After getting the news that she had passed the test, she signed up with a realty company. They told her how much money she would owe them each month and wished her good luck. Other than that, they weren't much help or encouragement. They told her how to have open houses on weekends. She had to carry big signs in her car and place them in the neighborhood around the open house. The signs were not always easy to push into the ground, nor did they always stay upright. To make matters worse, one Saturday evening, she discovered that all of her signs had been stolen. Her realty company told her not to worry. They would just add the cost of replacing the signs to her monthly bill. After she had asked him many times, her husband finally accompanied her to an open house. They ended up spending eight hours together with each other that Sunday. Only a dozen house hunters showed up all day. She tried to engage Edgar in conversation, but all he wanted to do was read the newspaper. After he helped her pick up all the signs, he told her that was the last time he was going to help her on an open house. She asked why. He said he didn't want to talk about it. Edith wondered how long her realty career was going to last

  // real text https://eslyes.com/eslread/ss/s065.htm

  const orderParameters = z.object({
    tags: z.array(z.string()).describe("the main tags from the provided text"),
  });

  const tools = [
    zodFunction({ name: "getTags", parameters: orderParameters })
  ];

  const messages: Array<ChatCompletionMessageParam> = [
    {
      role: "assistant",
      content:
        "You are a helpful tag generator assistant. Given a text, you will return the main tags.",
      },

    {
      role: "user",
      content: transcription.text,
    },
  ];

  const response = await openai.chat.completions.create({
    model: "gpt-4o-2024-08-06",
    messages: messages,
    tools: tools,
    stream: false,
  });
  
  console.log(JSON.stringify(response, null, 2));
}
main();
