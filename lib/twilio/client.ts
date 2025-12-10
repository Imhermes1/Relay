import twilio from 'twilio';

const accountSid = process.env.TWILIO_ACCOUNT_SID;
const authToken = process.env.TWILIO_AUTH_TOKEN;
const twilioPhoneNumber = process.env.TWILIO_PHONE_NUMBER;

if (!accountSid || !authToken || !twilioPhoneNumber) {
  throw new Error('Missing required Twilio environment variables');
}

const client = twilio(accountSid, authToken);

export interface SendSmsOptions {
  to: string;
  body: string;
}

export async function sendSms(options: SendSmsOptions): Promise<string> {
  try {
    const message = await client.messages.create({
      from: twilioPhoneNumber,
      to: options.to,
      body: options.body,
    });

    console.log(`[Twilio] SMS sent to ${options.to}, SID: ${message.sid}`);
    return message.sid;
  } catch (error) {
    console.error('[Twilio] Error sending SMS:', error);
    throw error;
  }
}

export function validateTwilioRequest(
  requestBody: Record<string, string>,
  requestUrl: string,
  twilioSignature: string
): boolean {
  // Extra guard to keep TypeScript happy in this scope
  if (!authToken) {
    console.error('[Twilio] Auth token not available for validation');
    return false;
  }

  try {
    const isValid = twilio.validateRequest(
      authToken,
      twilioSignature,
      requestUrl,
      requestBody
    );

    console.log(`[Twilio] Request validation: ${isValid}`);
    return isValid;
  } catch (error) {
    console.error('[Twilio] Error validating request:', error);
    return false;
  }
}
