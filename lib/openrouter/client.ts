const OPENROUTER_API_URL = 'https://openrouter.ai/api/v1/chat/completions';
const MODEL = 'anthropic/claude-sonnet-4.5';

interface Message {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

interface ToolCall {
  type: 'function';
  function: {
    name: string;
    arguments: string;
  };
}

interface OpenRouterResponse {
  choices: Array<{
    message: {
      content: string | null;
      tool_calls?: ToolCall[];
    };
  }>;
}

const tools = [
  {
    type: 'function',
    function: {
      name: 'get_calendar_events',
      description: 'Fetch calendar events for today or a specific date range',
      parameters: {
        type: 'object',
        properties: {
          days_ahead: {
            type: 'number',
            description: 'Number of days to look ahead (default: 7)',
          },
        },
        required: [],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'create_calendar_event',
      description: 'Create a new calendar event',
      parameters: {
        type: 'object',
        properties: {
          title: { type: 'string', description: 'Event title' },
          startTime: { type: 'string', description: 'Start time (ISO 8601)' },
          endTime: { type: 'string', description: 'End time (ISO 8601)' },
          description: { type: 'string', description: 'Event description' },
          attendees: {
            type: 'array',
            items: { type: 'string' },
            description: 'Email addresses of attendees',
          },
        },
        required: ['title', 'startTime', 'endTime'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'send_email',
      description: 'Send an email through Outlook',
      parameters: {
        type: 'object',
        properties: {
          to: {
            type: 'array',
            items: { type: 'string' },
            description: 'Recipient email addresses',
          },
          subject: { type: 'string', description: 'Email subject' },
          body: { type: 'string', description: 'Email body' },
          cc: {
            type: 'array',
            items: { type: 'string' },
            description: 'CC recipients',
          },
          bcc: {
            type: 'array',
            items: { type: 'string' },
            description: 'BCC recipients',
          },
        },
        required: ['to', 'subject', 'body'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'get_contacts',
      description: 'Fetch contact information',
      parameters: {
        type: 'object',
        properties: {
          limit: {
            type: 'number',
            description: 'Maximum number of contacts (default: 10)',
          },
        },
        required: [],
      },
    },
  },
];

export async function callOpenRouter(
  messages: Message[],
  systemPrompt: string,
  maxTokens: number = 500
): Promise<OpenRouterResponse> {
  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) {
    throw new Error('OPENROUTER_API_KEY not set');
  }

  const payload = {
    model: MODEL,
    messages: [
      {
        role: 'system',
        content: systemPrompt,
      },
      ...messages,
    ],
    tools: tools as any,
    tool_choice: 'auto',
    max_tokens: maxTokens,
    temperature: 0.7,
  };

  try {
    const response = await fetch(OPENROUTER_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
        'HTTP-Referer': process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000',
        'X-Title': 'AI SMS Assistant',
      },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      const error = await response.text();
      console.error('[OpenRouter] API error:', error);
      throw new Error(`OpenRouter API error: ${response.status}`);
    }

    const data = (await response.json()) as OpenRouterResponse;
    console.log('[OpenRouter] Response received successfully');
    return data;
  } catch (error) {
    console.error('[OpenRouter] Error calling API:', error);
    throw error;
  }
}

export function extractSystemPrompt(): string {
  return `You are a personal AI assistant integrated with Microsoft 365. You have access to:
- Calendar (view/create events)
- Email (read inbox, send emails)
- Contacts (view and manage)

Always respond concisely, as messages are delivered via SMS (max 160 characters when possible).

When the user asks about calendar, email, or contacts:
1. Use the appropriate function to fetch/create the data
2. Summarize the results in a natural, brief way
3. If multiple functions are needed, call them sequentially

Available functions: get_calendar_events, create_calendar_event, send_email, get_contacts

Always be helpful, friendly, and respect the user's privacy.`;
}

export function parseToolCalls(response: OpenRouterResponse): ToolCall[] {
  const message = response.choices?.[0]?.message;
  return message?.tool_calls || [];
}
