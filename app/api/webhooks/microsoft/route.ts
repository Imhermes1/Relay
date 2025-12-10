import { NextRequest, NextResponse } from 'next/server';
import { sendSms } from '@/lib/twilio/client';
import { storage } from '@/lib/storage';
import crypto from 'crypto';

const EXPECTED_CLIENT_STATE = 'sms-assistant';

// Validation token for initial setup
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    // Handle validation token on initial subscription setup
    if (body.value && body.value.length === 1 && body.value[0].changeType === 'created') {
      const notification = body.value[0];

      // Verify client state
      if (notification.clientState !== EXPECTED_CLIENT_STATE) {
        console.warn('[Webhook] Invalid client state received');
        return new NextResponse('Unauthorized', { status: 403 });
      }

      console.log('[Webhook] Microsoft Graph webhook configured successfully');

      // Return 200 OK to confirm webhook
      return new NextResponse('OK', { status: 200 });
    }

    // Process subscription validation token
    if (body.validationTokens && body.validationTokens.length > 0) {
      const validationToken = body.validationTokens[0];
      console.log('[Webhook] Returning validation token for subscription setup');
      return new NextResponse(validationToken, {
        headers: { 'Content-Type': 'text/plain' },
      });
    }

    // Process actual notifications
    if (body.value && Array.isArray(body.value)) {
      for (const notification of body.value) {
        try {
          await processNotification(notification);
        } catch (error) {
          console.error('[Webhook] Error processing notification:', error);
        }
      }
    }

    // Return 202 Accepted (notifications don't expect a response body)
    return new NextResponse(null, { status: 202 });
  } catch (error) {
    console.error('[Webhook] Error processing request:', error);
    return new NextResponse('Error', { status: 500 });
  }
}

async function processNotification(notification: any) {
  const { changeType, clientState, subscriptionId, resource, resourceData } = notification;

  console.log(`[Webhook] Processing ${changeType} notification for ${resource}`);

  // Verify client state for security
  if (clientState !== EXPECTED_CLIENT_STATE) {
    console.warn('[Webhook] Invalid client state in notification');
    return;
  }

  try {
    // Get the user's phone number from env
    const userPhoneNumber = process.env.USER_PHONE_NUMBER;
    if (!userPhoneNumber) {
      console.warn('[Webhook] USER_PHONE_NUMBER not configured');
      return;
    }

    if (changeType === 'created' && resource.includes('messages')) {
      // New email received
      const senderInfo = resourceData?.subject || 'New Email';
      const message = `📧 New email: ${senderInfo.substring(0, 100)}`;

      await sendSms({
        to: userPhoneNumber,
        body: message,
      });

      console.log('[Webhook] SMS notification sent for new email');
    }
  } catch (error) {
    console.error('[Webhook] Error sending SMS notification:', error);
  }
}

// Endpoint to subscribe to email changes
export async function PUT(request: NextRequest) {
  try {
    const { sendSmsFunction } = await request.json();

    if (!sendSmsFunction) {
      return NextResponse.json({ error: 'Missing required parameters' }, { status: 400 });
    }

    // Note: This endpoint would need to be called manually with proper auth
    // In production, this should be protected and integrated with your app startup

    console.log('[Webhook] Manual subscription request received');
    return NextResponse.json({
      success: true,
      message: 'Subscription endpoint ready',
    });
  } catch (error) {
    console.error('[Webhook] Error in PUT:', error);
    return NextResponse.json({ error: 'Error processing request' }, { status: 500 });
  }
}
