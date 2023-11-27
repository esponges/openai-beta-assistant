/* 
I've created an assisstant that will have to figure out what function to call based on the context.

The instructions are:

#####
You are a useful spam filtered assitant. 
You'll the 'spam_message_filter' if the user message is a spam message or the 'allow_message' if not. 
If the message is a non human-like message don't run any of these functions.
#####
*/

// import the required dependencies
require('dotenv').config();
// const chalk = require('chalk');
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
  name: 'spam_message_filter',
  description: 'Filter spam messages and explain why it is spam',
  parameters: {
    type: 'object',
    properties: {
      message: {
        type: 'string',
        description: 'The message to filter',
      },
      reason: {
        type: 'string',
        description: 'The reason why the message is spam',
      },
    },
    required: ['message', 'reason'],
  },
};

async function spamMessageFilter(message: string, reason: string) {
  console.log('Spam Message');
  console.log('Message:', message);
  console.log('Reason:', reason);
  console.log('You can call an async function to delete the message');
  return `Message: ${message}\nReason: ${reason}\n`;
}

// expected output when the message is not spam
const allowMessageJson = {
  name: 'allow_message',
  description: 'Allow a message to be sent',
  parameters: {
    type: 'object',
    properties: {
      message: {
        type: 'string',
        description: 'The message to allow',
      },
      reason: {
        type: 'string',
        description: 'The reason why the message is allowed',
      },
    },
    required: ['message'],
  },
};

async function allowMessage(message: string, reason: string) {
  // console.log(chalk.green('Allow Message'));
  console.log("Allow Message");
  console.log('Message:', message);
  console.log('Reason:', reason);
  // console.log(
  //   chalk.blue('You can call an async function to allow the message')
  // );
  console.log("You can call an async function to allow the message");
  return `Message: ${message}\nReason: ${reason}\n`;
}

async function main() {
  try {
    // pick existing assistant previously created
    const assistantId = process.env.OPENAI_FN_CALL_V1_ASSISTANT_ID;

    if (!assistantId) {
      throw new Error('OPENAI_FN_CALL_V1_ASSISTANT_ID not found');
    }
    const assistant = await openai.beta.assistants.retrieve(assistantId);

    // Log the first greeting
    console.log(
      "\nHello there, I'm your personal spam filter. Ask some complicated questions.\n"
    );

    // Create a thread
    const thread = await openai.beta.threads.create();
    console.log('starting thread with id: ', thread.id);

    // Use keepAsking as state for keep asking questions
    let keepAsking = true;
    while (keepAsking) {
      const userQuestion = await askRLineQuestion('\nWhat is your message? ');

      // Pass in the user question into the existing thread
      await openai.beta.threads.messages.create(thread.id, {
        role: 'user',
        content: userQuestion,
      });
      console.log('thinking...');

      // Use runs to wait for the assistant response and then retrieve it
      const run = await openai.beta.threads.runs.create(thread.id, {
        assistant_id: assistant.id,
      });

      let actualRun = await openai.beta.threads.runs.retrieve(
        thread.id,
        run.id
      );

      // Polling mechanism to see if actualRun is completed
      // This should be made more robust.
      while (
        actualRun.status === 'queued' ||
        actualRun.status === 'in_progress' ||
        actualRun.status === 'requires_action'
      ) {
        // requires_action means that the assistant is waiting for the functions to be invoked
        // the model should provide a json object with the shape of the json objects above
        if (actualRun.status === 'requires_action') {
          // extra single tool call
          const toolCall =
            actualRun.required_action?.submit_tool_outputs?.tool_calls[0];

          const name = toolCall?.function.name;

          const args = JSON.parse(toolCall?.function?.arguments || '{}');
          const message = args.message;
          const reason = args.reason;

          if (name === 'spam_message_filter') {
            await spamMessageFilter(message, reason);
          } else if (name === 'allow_message') {
            await allowMessage(message, reason);
          } else {
            throw new Error('Unknown function name');
          }

          // we must submit the tool outputs to the run to continue
          await openai.beta.threads.runs.submitToolOutputs(thread.id, run.id, {
            tool_outputs: [
              {
                tool_call_id: toolCall?.id,
                output: JSON.stringify({ success: true }),
              },
            ],
          });
        }
        // keep polling until the run is completed
        await new Promise((resolve) => setTimeout(resolve, 2000));
        actualRun = await openai.beta.threads.runs.retrieve(thread.id, run.id);
      }

      // Get the last assistant message from the messages array
      const messages = await openai.beta.threads.messages.list(thread.id);

      // Find the last message for the current run
      const lastMessageForRun = messages.data
        .filter(
          (message) => message.run_id === run.id && message.role === 'assistant'
        )
        .pop();

      // If an assistant message is found, console.log() it
      if (lastMessageForRun) {
        // aparently this is not correctly typed
        // content returns an of objects do contain a text object
        const messageValue = lastMessageForRun.content[0] as {
          text: { value: string };
        };

        // console.log(chalk.yellow(messageValue?.text?.value));
        console.log(messageValue?.text?.value);
      }

      // Then ask if the user wants to ask another question and update keepAsking state
      const continueAsking = await askRLineQuestion(
        'Do you want to keep having a conversation? (yes/no) '
      );

      keepAsking = continueAsking.toLowerCase().includes('yes');

      // If the keepAsking state is falsy show an ending message
      if (!keepAsking) {
        console.log('Alrighty then, I hope you learned something!\n');
      }
    }

    // close the readline
    readline.close();
  } catch (error) {
    console.error('Error:', error);
  }
}

main();

export {};
