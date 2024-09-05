import * as fs from "fs";
import OpenAI from "openai";
require('dotenv').config();

const openai = new OpenAI();

async function main() {
  const transcription = await openai.audio.transcriptions.create({
    file: fs.createReadStream("./assets/random-phrases-small.wav"),
    model: "whisper-1",
  });

  console.log(transcription.text);
}
main();
