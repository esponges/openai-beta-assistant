/* 
I've created an assisstant that will have to figure out what function to call based on the context.

The instructions are:

#####
You are a useful spam filtered assitant. 
You'll the 'spam_message_filter' if the user message is a spam message or the 'allow_message' if not. 
After that, return a message stating which function was run.
#####
*/

// import the required dependencies
require('dotenv').config();
const chalk = require('chalk');
const OpenAI = require('openai');
const readline = require('readline').createInterface({
  input: process.stdin,
  output: process.stdout,
});

// Create a OpenAI connection
const secretKey = process.env.OPENAI_API_KEY;
const openai = new OpenAI({
  apiKey: secretKey,
});

async function askRLineQuestion(question: string) {
  return new Promise<string>((resolve, _reject) => {
    readline.question(question, (answer: string) => {
      resolve(`${answer}\n`);
    });
  });
}

// expected output when the message is spam
const spamMessageJson = {
  name: "spam_message_filter",
  description: "Filter spam messages and explain why it is spam",
  parameters: {
    type: "object",
    properties: {
      message: {
        type: "string",
        description: "The message to filter",
      },
      reason: {
        type: "string",
        description: "The reason why the message is spam",
      },
    },
    required: ["message", "reason"],
  },
};

function spamMessageFilter(message: string, reason: string) {
  console.log(chalk.red("Spam Message"));
  console.log("Message:", message);
  console.log("Reason:", reason);
  return `Message: ${message}\nReason: ${reason}\n`;
}

// expected output when the message is not spam
const allowMessageJson = {
  name: "allow_message",
  description: "Allow a message to be sent",
  parameters: {
    type: "object",
    properties: {
      message: {
        type: "string",
        description: "The message to allow",
      },
      reason: {
        type: "string",
        description: "The reason why the message is allowed",
      },
    },
    required: ["message"],
  },
};

function allowMessage(message: string, reason: string) {
  console.log(chalk.green("Allow Message"));
  console.log("Message:", message);
  console.log("Reason:", reason);
  return `Message: ${message}\nReason: ${reason}\n`;
}
