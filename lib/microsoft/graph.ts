import { storage } from '../storage';

type TokenData = {
  accessToken: string;
  refreshToken: string;
  expiresAt: number;
  userId: string;
};

const GRAPH_API_URL = 'https://graph.microsoft.com/v1.0';
const GRAPH_SUBSCRIBE_URL = 'https://graph.microsoft.com/v1.0/subscriptions';

const MICROSOFT_CLIENT_ID = process.env.MICROSOFT_CLIENT_ID;
const MICROSOFT_CLIENT_SECRET = process.env.MICROSOFT_CLIENT_SECRET;
const MICROSOFT_TENANT_ID = process.env.MICROSOFT_TENANT_ID;
const MICROSOFT_REDIRECT_URI = process.env.MICROSOFT_REDIRECT_URI;

if (!MICROSOFT_CLIENT_ID || !MICROSOFT_CLIENT_SECRET || !MICROSOFT_TENANT_ID) {
  throw new Error('Missing Microsoft Graph environment variables');
}

async function getAuthHeader(userId: string = 'default'): Promise<string> {
  let token = storage.getToken(userId);

  if (!token) {
    throw new Error('No access token available. User needs to authenticate.');
  }

  // Check if token is within 5 minutes of expiry
  if (Date.now() >= token.expiresAt - 5 * 60 * 1000) {
    console.log('[Graph] Token near expiry, refreshing...');
    token = await refreshAccessToken(userId);
    if (!token) {
      throw new Error('No access token available after refresh');
    }
  }

  return `Bearer ${token.accessToken}`;
}

async function refreshAccessToken(userId: string = 'default'): Promise<TokenData | null> {
  const refreshToken = storage.getRefreshToken(userId);
  if (!refreshToken) {
    throw new Error('No refresh token available');
  }

  try {
    const response = await fetch(
      `https://login.microsoftonline.com/${MICROSOFT_TENANT_ID}/oauth2/v2.0/token`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          client_id: MICROSOFT_CLIENT_ID!,
          client_secret: MICROSOFT_CLIENT_SECRET!,
          refresh_token: refreshToken,
          grant_type: 'refresh_token',
          scope: 'Calendars.ReadWrite Contacts.ReadWrite Mail.ReadWrite User.Read',
        }).toString(),
      }
    );

    if (!response.ok) {
      throw new Error('Token refresh failed');
    }

    const data = await response.json();
    storage.updateAccessToken(userId, data.access_token, data.expires_in);

    return storage.getToken(userId);
  } catch (error) {
    console.error('[Graph] Error refreshing token:', error);
    storage.clearToken(userId);
    throw new Error('Failed to refresh access token');
  }
}

export async function getCalendarEvents(
  daysAhead: number = 7,
  userId: string = 'default'
): Promise<any[]> {
  try {
    const authHeader = await getAuthHeader(userId);
    const now = new Date();
    const future = new Date(now.getTime() + daysAhead * 24 * 60 * 60 * 1000);

    const response = await fetch(
      `${GRAPH_API_URL}/me/calendarview?startDateTime=${now.toISOString()}&endDateTime=${future.toISOString()}`,
      {
        headers: { Authorization: authHeader },
      }
    );

    if (!response.ok) throw new Error(`Graph API error: ${response.status}`);

    const data = await response.json();
    console.log(`[Graph] Retrieved ${data.value?.length || 0} calendar events`);
    return data.value || [];
  } catch (error) {
    console.error('[Graph] Error fetching calendar events:', error);
    throw error;
  }
}

export async function createCalendarEvent(
  title: string,
  startTime: string,
  endTime: string,
  description?: string,
  attendees?: string[],
  userId: string = 'default'
): Promise<any> {
  try {
    const authHeader = await getAuthHeader(userId);

    const eventBody = {
      subject: title,
      start: {
        dateTime: startTime,
        timeZone: 'UTC',
      },
      end: {
        dateTime: endTime,
        timeZone: 'UTC',
      },
      body: {
        contentType: 'HTML',
        content: description || '',
      },
      attendees: attendees?.map((email) => ({
        emailAddress: { address: email },
        type: 'required',
      })) || [],
    };

    const response = await fetch(`${GRAPH_API_URL}/me/events`, {
      method: 'POST',
      headers: {
        Authorization: authHeader,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(eventBody),
    });

    if (!response.ok) throw new Error(`Graph API error: ${response.status}`);

    const data = await response.json();
    console.log('[Graph] Calendar event created:', data.id);
    return data;
  } catch (error) {
    console.error('[Graph] Error creating calendar event:', error);
    throw error;
  }
}

export async function sendEmail(
  to: string[],
  subject: string,
  body: string,
  cc?: string[],
  bcc?: string[],
  userId: string = 'default'
): Promise<void> {
  try {
    const authHeader = await getAuthHeader(userId);

    const messageBody = {
      message: {
        subject,
        body: {
          contentType: 'HTML',
          content: body,
        },
        toRecipients: to.map((email) => ({
          emailAddress: { address: email },
        })),
        ccRecipients: cc?.map((email) => ({
          emailAddress: { address: email },
        })) || [],
        bccRecipients: bcc?.map((email) => ({
          emailAddress: { address: email },
        })) || [],
      },
    };

    const response = await fetch(`${GRAPH_API_URL}/me/sendMail`, {
      method: 'POST',
      headers: {
        Authorization: authHeader,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(messageBody),
    });

    if (!response.ok) throw new Error(`Graph API error: ${response.status}`);

    console.log('[Graph] Email sent to:', to.join(', '));
  } catch (error) {
    console.error('[Graph] Error sending email:', error);
    throw error;
  }
}

export async function getContacts(limit: number = 10, userId: string = 'default'): Promise<any[]> {
  try {
    const authHeader = await getAuthHeader(userId);

    const response = await fetch(`${GRAPH_API_URL}/me/contacts?$top=${limit}`, {
      headers: { Authorization: authHeader },
    });

    if (!response.ok) throw new Error(`Graph API error: ${response.status}`);

    const data = await response.json();
    console.log(`[Graph] Retrieved ${data.value?.length || 0} contacts`);
    return data.value || [];
  } catch (error) {
    console.error('[Graph] Error fetching contacts:', error);
    throw error;
  }
}

export async function createSubscription(
  resource: string,
  notificationUrl: string,
  changeType: 'created' | 'updated' | 'deleted' = 'created',
  expirationMinutes: number = 4200,
  clientState: string = 'sms-assistant',
  userId: string = 'default'
): Promise<any> {
  try {
    const authHeader = await getAuthHeader(userId);

    const now = new Date();
    const expirationTime = new Date(now.getTime() + expirationMinutes * 60 * 1000);

    const subscription = {
      changeType,
      notificationUrl,
      resource,
      expirationDateTime: expirationTime.toISOString(),
      clientState,
    };

    const response = await fetch(GRAPH_SUBSCRIBE_URL, {
      method: 'POST',
      headers: {
        Authorization: authHeader,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(subscription),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Graph API error: ${response.status} - ${error}`);
    }

    const data = await response.json();
    console.log('[Graph] Subscription created:', data.id);

    // Store subscription for renewal tracking
    storage.saveSubscription(data.id, resource, expirationTime.getTime());

    return data;
  } catch (error) {
    console.error('[Graph] Error creating subscription:', error);
    throw error;
  }
}

export async function renewSubscription(
  subscriptionId: string,
  expirationMinutes: number = 4200,
  userId: string = 'default'
): Promise<any> {
  try {
    const authHeader = await getAuthHeader(userId);

    const expirationTime = new Date(Date.now() + expirationMinutes * 60 * 1000);

    const response = await fetch(`${GRAPH_SUBSCRIBE_URL}/${subscriptionId}`, {
      method: 'PATCH',
      headers: {
        Authorization: authHeader,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        expirationDateTime: expirationTime.toISOString(),
      }),
    });

    if (!response.ok) throw new Error(`Graph API error: ${response.status}`);

    const data = await response.json();
    console.log('[Graph] Subscription renewed:', subscriptionId);

    // Update storage
    storage.updateSubscription(subscriptionId, expirationTime.getTime());

    return data;
  } catch (error) {
    console.error('[Graph] Error renewing subscription:', error);
    throw error;
  }
}

export async function getSubscriptions(userId: string = 'default'): Promise<any[]> {
  try {
    const authHeader = await getAuthHeader(userId);

    const response = await fetch(GRAPH_SUBSCRIBE_URL, {
      headers: { Authorization: authHeader },
    });

    if (!response.ok) throw new Error(`Graph API error: ${response.status}`);

    const data = await response.json();
    console.log(`[Graph] Retrieved ${data.value?.length || 0} subscriptions`);
    return data.value || [];
  } catch (error) {
    console.error('[Graph] Error fetching subscriptions:', error);
    throw error;
  }
}
