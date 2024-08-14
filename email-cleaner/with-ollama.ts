import { listUnreadMessages, initGmailAuth } from './email';


type Tool = {
  name: string;
  description: string;
  parameters: {
    type: string;
    properties: Record<string, any>;
    required: string[];
  };
};

// shape of the object to return by the assistant which will be used by the filter_spam function
const filterSpamTool: Tool = {
  name: 'filter_spam',
  description: 'Filter spam messages and explain why it is spam',
  parameters: {
    type: 'object',
    properties: {
      messages: {
        type: 'array',
        description: 'The list of messages to filter',
        items: {
          type: 'object',
          properties: {
            id: {
              type: 'string',
              description: 'The id of the message',
            },
            snippet: {
              type: 'string',
              description: 'The snippet of the message',
            },
            is_spam_or_marketing: {
              type: 'boolean',
              description: 'the decision',
            },
            reason: {
              type: 'string',
              description: 'The reason why the message is spam',
            },
          },
          required: ['id', 'snippet', 'reason', 'is_spam_or_marketing'],
        },
      },
    },
    required: ['messages'],
  },
};

/* 
  Start of the implementation. Above only tool description
*/

type Message = {
  id: string;
  snippet: string;
};

type AssessedMessage = {
  id: string;
  snippet: string;
  is_spam_or_marketing: boolean;
  reason: string;
}

function createPrompt(messages: Message[]) {
  return `You are a helpful assistant that filters spam emails.
  From the following list of emails: 
  ${messages.map((message) => {
    return `- id: ${message.id}, snippet: ${message.snippet}.\n`;
  })}
  For every provided email, tell whether that email is spam or not and give a clear explanation.
  You should return an array of objects with the following structure:

    {
      "messages": [
        {
          "id": The id of the message,
          "snippet": The snippet of the message,
          "is_spam_or_marketing": true/false,
          "reason": A comprehensive description of the reason why the message is spam
        }
      ]
    }

  I will give you 1 million dollars if you return only JSON using the format above and
  one object per email.
  `;
}

async function cleanWithOllama() {
  try {
    const emails = await getEmails();
    const prompt = createPrompt(emails);

    const curl = await fetch('http://localhost:11434/api/generate', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gemma2:2b',
        format: 'json',
        prompt,
        stream: false,
        // tools is not supported by gemma only by ollama3
        // tools,
      }),
    });
    const res = await curl.json();

    const { response } = res;

    let messages: AssessedMessage[] = [];
    if (response) {
      messages = JSON.parse(response).messages;
    } else {
      return "the assistant didn't return any response key";
    }

    return { res, messages };
  } catch (error) {
    return `The assistant didn't return a correctly formatted response. Error: ${error}`;
  }
}

async function getEmails(): Promise<Message[]> {
  const auth = await initGmailAuth();
  const deleteFlag = process.argv.find((arg) => arg.startsWith('deleteCount='));
  const toDelete = deleteFlag ? parseInt(deleteFlag.split('=')[1]) : 2;
  // having problems getting gemma to output more than 3 messages
  // probably other models will work better
  const deleteCount = toDelete > 3 ? 3 : toDelete;

  return await listUnreadMessages(auth, toDelete);
}

cleanWithOllama()
  .then((res) => console.log(res))
  .catch(console.error);

export {};
