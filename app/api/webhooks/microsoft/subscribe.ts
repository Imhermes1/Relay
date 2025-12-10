import { NextRequest, NextResponse } from 'next/server';
import { createSubscription, getSubscriptions, renewSubscription } from '@/lib/microsoft/graph';
import { storage } from '@/lib/storage';

/**
 * POST /api/webhooks/microsoft/subscribe
 * Creates a subscription to Microsoft Graph for email notifications
 */
export async function POST(request: NextRequest) {
  try {
    const appUrl = process.env.NEXT_PUBLIC_APP_URL;
    if (!appUrl) {
      return NextResponse.json(
        { error: 'NEXT_PUBLIC_APP_URL not configured' },
        { status: 500 }
      );
    }

    const notificationUrl = `${appUrl}/api/webhooks/microsoft`;

    // Create subscription for new emails in Inbox
    const subscription = await createSubscription(
      "me/mailFolders('Inbox')/messages",
      notificationUrl,
      'created',
      4200, // 70 hours (max is 4230 for email)
      'sms-assistant'
    );

    console.log('[Subscribe] Email notification subscription created:', subscription.id);

    return NextResponse.json({
      success: true,
      subscriptionId: subscription.id,
      resource: subscription.resource,
      expirationDateTime: subscription.expirationDateTime,
      message: 'Successfully subscribed to email notifications',
    });
  } catch (error) {
    console.error('[Subscribe] Error creating subscription:', error);
    return NextResponse.json(
      { error: 'Failed to create subscription', details: String(error) },
      { status: 500 }
    );
  }
}

/**
 * GET /api/webhooks/microsoft/subscribe
 * Lists active subscriptions
 */
export async function GET(request: NextRequest) {
  try {
    const subscriptions = await getSubscriptions();

    // Also check local storage for subscriptions needing renewal
    const expiredSubs = storage.getExpiredSubscriptions();
    const renewalNeeded = expiredSubs.filter((sub) => {
      const expiresIn = sub.expiresAt - Date.now();
      return expiresIn < 60 * 60 * 1000; // Less than 1 hour to expiry
    });

    return NextResponse.json({
      subscriptions: subscriptions.map((s) => ({
        id: s.id,
        resource: s.resource,
        changeType: s.changeType,
        notificationUrl: s.notificationUrl,
        expirationDateTime: s.expirationDateTime,
        clientState: s.clientState,
      })),
      renewalRequired: renewalNeeded.length > 0,
      renewalCount: renewalNeeded.length,
    });
  } catch (error) {
    console.error('[Subscribe] Error listing subscriptions:', error);
    return NextResponse.json(
      { error: 'Failed to retrieve subscriptions', details: String(error) },
      { status: 500 }
    );
  }
}

/**
 * PATCH /api/webhooks/microsoft/subscribe
 * Renews subscriptions that are about to expire
 */
export async function PATCH(request: NextRequest) {
  try {
    const expiredSubs = storage.getExpiredSubscriptions();
    const renewed = [];

    for (const sub of expiredSubs) {
      try {
        await renewSubscription(sub.subscriptionId, 4200);
        renewed.push(sub.subscriptionId);
        console.log('[Subscribe] Subscription renewed:', sub.subscriptionId);
      } catch (error) {
        console.error('[Subscribe] Error renewing subscription:', error);
      }
    }

    return NextResponse.json({
      success: true,
      renewedCount: renewed.length,
      renewedIds: renewed,
      message: `${renewed.length} subscription(s) renewed`,
    });
  } catch (error) {
    console.error('[Subscribe] Error in renewal:', error);
    return NextResponse.json(
      { error: 'Renewal process failed', details: String(error) },
      { status: 500 }
    );
  }
}
