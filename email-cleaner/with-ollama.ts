// shape of the object to return by the assistant which will be used by the filter_spam function
const filterSpamTool = {
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

type Tool = {
  name: string;
  description: string;
  parameters: {
    type: string;
    properties: Record<string, any>;
    required: string[];
  };
};

type Message = {
  id: string;
  snippet: string;
  is_spam_or_marketing: boolean;
  reason: string;
};

const emails: Omit<Message, 'reason' | 'is_spam_or_marketing'>[] = [
  {
    id: '1',
    snippet: 'buy bitcoin now',
  },
  {
    id: '2',
    snippet: 'Hi Fer, I loved to see you the other day in your home...',
  },
  {
    id: '3',
    snippet: 'Get this deal! I’m going to be rich!',
  },
];

function createPrompt(
  messages: Omit<Message, 'reason' | 'is_spam_or_marketing'>[]
) {
  return `You are a helpful assistant that filters spam emails.
  From the following list of emails, please provide a list of messages that are considered spam. 
  Use the filter_spam function to return a list of messages that are considered spam.
  ${messages.forEach((message) => {
    return `id: ${message.id}, snippet: ${message.snippet}.\n`;
  })}`;
}

async function main(
  emails: Omit<Message, 'reason' | 'is_spam_or_marketing'>[],
  tools: Tool[]
) {
  const curl = await fetch('http://localhost:11434/api/generate', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: 'gemma2:2b',
      messages: [
        {
          role: 'user',
          content: createPrompt(emails),
        },
      ],
      // format: "json",
      stream: false,
      tools,
    }),
  });
  const response = await curl.json();
  console.log(response);

  return response;
}

main(emails, [filterSpamTool]).catch(console.error);

export {};
