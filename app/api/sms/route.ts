import { NextRequest, NextResponse } from 'next/server';
import { sendSms, validateTwilioRequest } from '@/lib/twilio/client';
import { callOpenRouter, extractSystemPrompt, parseToolCalls } from '@/lib/openrouter/client';
import {
  getCalendarEvents,
  createCalendarEvent,
  sendEmail,
  getContacts,
} from '@/lib/microsoft/graph';

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const body = Object.fromEntries(formData.entries()) as Record<string, string>;

    const from = body.From || '';
    const message = body.Body || '';
    const twilioSignature = request.headers.get('x-twilio-signature') || '';
    const requestUrl =
      process.env.NEXT_PUBLIC_APP_URL?.endsWith('/api/sms')
        ? process.env.NEXT_PUBLIC_APP_URL
        : process.env.NEXT_PUBLIC_APP_URL
        ? `${process.env.NEXT_PUBLIC_APP_URL}/api/sms`
        : request.url;

    // Validate Twilio request
    const isValid = validateTwilioRequest(body, requestUrl, twilioSignature);
    console.log(`[Twilio] Request validation: ${isValid}`);

    if (!isValid && process.env.NODE_ENV === 'production') {
      return NextResponse.json({ error: 'Invalid signature' }, { status: 403 });
    }

    console.log(`[SMS] Incoming message from ${from}: "${message}"`);

    // Respond to Twilio immediately
    const response = NextResponse.json({ success: true }, { status: 200 });

    // Process asynchronously
    processMessage(from, message).catch((err) => {
      console.error('[SMS] Error processing message:', err);
    });

    return response;
  } catch (error: any) {
    console.error('[SMS] Error handling webhook:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

async function processMessage(from: string, incomingMessage: string) {
  try {
    const systemPrompt = extractSystemPrompt();
    const messages = [
      {
        role: 'user' as const,
        content: incomingMessage,
      },
    ];

    const response = await callOpenRouter(messages, systemPrompt, 500);
    const firstChoice = response.choices[0];
    const toolCalls = parseToolCalls(response);

    let finalResponse = firstChoice.message.content || 'I did not understand that.';

    // Process tool calls if any
    if (toolCalls.length > 0) {
      console.log(`[SMS] Processing ${toolCalls.length} tool call(s)`);

      for (const toolCall of toolCalls) {
        try {
          const args = JSON.parse(toolCall.function.arguments);
          let toolResult = '';

          switch (toolCall.function.name) {
            case 'get_calendar_events': {
              const events = await getCalendarEvents(args.days_ahead || 7);
              if (events.length === 0) {
                toolResult = 'No upcoming events found.';
              } else {
                toolResult = events
                  .slice(0, 3)
                  .map((e) => `${e.subject} at ${new Date(e.start.dateTime).toLocaleTimeString()}`)
                  .join('; ');
              }
              break;
            }

            case 'create_calendar_event': {
              await createCalendarEvent(
                args.title,
                args.startTime,
                args.endTime,
                args.description,
                args.attendees
              );
              toolResult = `Event "${args.title}" created successfully.`;
              break;
            }

            case 'send_email': {
              await sendEmail(args.to, args.subject, args.body, args.cc, args.bcc);
              toolResult = `Email sent to ${args.to.join(', ')}.`;
              break;
            }

            case 'get_contacts': {
              const contacts = await getContacts(args.limit || 10);
              if (contacts.length === 0) {
                toolResult = 'No contacts found.';
              } else {
                toolResult = contacts
                  .slice(0, 3)
                  .map((c) => c.displayName || c.emailAddresses?.[0]?.address || 'Unknown')
                  .join(', ');
              }
              break;
            }

            default:
              toolResult = `Unknown tool: ${toolCall.function.name}`;
          }

          console.log(`[SMS] Tool result: ${toolResult}`);

          // Call AI again with tool result
          const followUpMessages = [
            ...messages,
            {
              role: 'assistant' as const,
              content: firstChoice.message.content || '',
            },
            {
              role: 'user' as const,
              content: `Tool result: ${toolResult}`,
            },
          ];

          const followUpResponse = await callOpenRouter(followUpMessages, systemPrompt, 300);
          finalResponse = followUpResponse.choices[0].message.content || finalResponse;
        } catch (error) {
          console.error('[SMS] Error processing tool:', error);
          finalResponse = 'Error processing request. Please try again.';
        }
      }
    }

    // Truncate response for SMS (roughly 160 chars for standard SMS)
    const smsResponse = finalResponse.substring(0, 160);

    // Send response via SMS
    await sendSms({
      to: from,
      body: smsResponse,
    });

    console.log(`[SMS] Response sent to ${from}`);
  } catch (error) {
    console.error('[SMS] Error in processMessage:', error);
    try {
      await sendSms({
        to: from,
        body: 'Sorry, an error occurred processing your message. Please try again.',
      });
    } catch (smsError) {
      console.error('[SMS] Error sending error message:', smsError);
    }
  }
}
