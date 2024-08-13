import {
  authorize,
  deleteMessages,
  listUnreadMessages,
  markAsRead,
} from './email';
import { Thread } from "openai/resources/beta/threads/threads";

// import the required dependencies
require('dotenv').config();
const OpenAI = require('openai');
const readline = require('readline').createInterface({
  input: process.stdin,
  output: process.stdout,
});

// Create a OpenAI connection
const apiKey = process.env.OPENAI_API_KEY;
const openai = new OpenAI({
  apiKey,
});

// shape of the object to return by the assistant which will be used by the spam_message_filter function
// const spamMessageFilter = {
//   "name": "spam_message_filter",
//   "description": "Filter spam messages and explain why it is spam",
//   "parameters": {
//     "type": "object",
//     "properties": {
//       "messages": {
//         "type": "array",
//         "description": "The list of messages to filter",
//         "items": {
//           "type": "object",
//           "properties": {
//             "id": {
//               "type": "string",
//               "description": "The id of the message"
//             },
//             "snippet": {
//               "type": "string",
//               "description": "The snippet of the message"
//             },
//             "is_spam_or_marketing": {
//               "type": "boolean",
//               "description": "the decision"
//             },
//             "reason": {
//               "type": "string",
//               "description": "The reason why the message is spam"
//             }
//           },
//           "required": [
//             "id",
//             "snippet",
//             "reason",
//             "is_spam_or_marketing"
//           ]
//         }
//       }
//     },
//     "required": [
//       "messages"
//     ]
//   }
// };

async function askQuestion(question: string) {
  return new Promise<string>((resolve, _reject) => {
    readline.question(question, (answer: string) => {
      resolve(`${answer}\n`);
    });
  });
}

type Message = {
  id: string;
  snippet: string;
  is_spam_or_marketing: boolean;
  reason: string;
};

export async function initGmailAuth() {
  try {
    const auth = await authorize();
    return auth;
  } catch (error) {
    console.error(error);
    throw error;
  }
}

async function spamMessageFilter(messages: Message[], auth) {
  const delIds = messages
    .filter((message) => message.is_spam_or_marketing)
    .map((message) => message.id);

  // delete the messages
  deleteMessages(auth, delIds)
    .then(() => console.log('messages deleted', delIds))
    .catch(() => {
      // throw
      throw new Error('error deleting messages');
    });

  const readIds = messages
    .filter((message) => !message.is_spam_or_marketing)
    .map((message) => message.id);

  // mark as read
  markAsRead(auth, readIds)
    .then(() => console.log('messages marked as read', readIds))
    .catch(() => {
      // throw
      throw new Error('error marking messages as read');
    });
}

export async function fetchLatestUnreadEmails(quantity: number = 2, auth) {
  return await listUnreadMessages(auth, quantity);
}

async function main() {
  // use the assistant created using the OpenAI playground
  const assistantId = process.env.OPENAI_SPAM_FILTER_ASSISTANT_ID;

  if (!assistantId) {
    throw new Error('OPENAI_SPAM_FILTER_ASSISTANT_ID not found');
  }
  const assistant = await openai.beta.assistants.retrieve(assistantId);

  // Log the first greeting
  console.log(
    "\nHello there, I'm your personal spam filter. I'll help you filter your emails.\n"
  );

  let keepCleaning = true;
  let threadId: string;
  while(keepCleaning) {
    // fetch the latest unread emails
    const gmailAuth = await initGmailAuth();

    // todo: ask email quantity
    const messages = await fetchLatestUnreadEmails(2, gmailAuth);
    if (Array.isArray(messages) && messages.length === 0) {
      console.log('Failed to fetch messages');
      return;
    }
    console.log('messages', messages);
  
    // Create a thread
    let thread: Thread;
    if (!threadId) {
      thread = await openai.beta.threads.create();
    } else {
      thread = await openai.beta.threads.retrieve(threadId);
    }
    threadId = thread.id;

    console.log('starting thread with id: ', threadId);
  
    const messagesAsString = JSON.stringify(messages);
    await openai.beta.threads.messages.create(thread.id, {
      role: 'user',
      // todo?: when not passed as markdown, the assistant will not be able to parse the json
      content: `\`\`\`json\n${messagesAsString}\n\`\`\``,
    });
    console.log('thinking...');
  
    // Use runs to wait for the assistant response and then retrieve it
    const run = await openai.beta.threads.runs.create(thread.id, {
      assistant_id: assistant.id,
    });
  
    let actualRun = await openai.beta.threads.runs.retrieve(thread.id, run.id);
  
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
        const messages = args.messages;

        console.log('messages', messages);
  
        if (name === 'spam_message_filter') {
          await spamMessageFilter(messages, gmailAuth);
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
    const assisstantMessages = await openai.beta.threads.messages.list(thread.id);
  
    // Find the last message for the current run
    const lastMessageForRun = assisstantMessages.data
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
  
      console.log(messageValue?.text?.value);
    }

    const answer = await askQuestion('Do you want to continue? (y/n) ');
    if (answer.startsWith('n')) {
      keepCleaning = false;
    }
  }

}

main().catch(console.error);

export {};
