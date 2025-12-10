import { del, get, put } from '@vercel/blob';

type TokenData = {
  accessToken: string;
  refreshToken: string;
  expiresAt: number;
  userId: string;
};

type SubscriptionData = {
  subscriptionId: string;
  resource: string;
  expiresAt: number;
  createdAt: number;
};

const TOKEN_PREFIX = 'token:';
const SUBSCRIPTION_KEY = 'subscriptions.json';

async function readSubscriptions(): Promise<Record<string, SubscriptionData>> {
  try {
    const blob = await get(SUBSCRIPTION_KEY);
    if (!blob) return {};
    const data = await blob.json();
    return (data as Record<string, SubscriptionData>) || {};
  } catch (error: any) {
    if (error?.status === 404) {
      return {};
    }
    console.error('[Storage] Error reading subscriptions:', error);
    return {};
  }
}

async function writeSubscriptions(subs: Record<string, SubscriptionData>) {
  await put(SUBSCRIPTION_KEY, JSON.stringify(subs), { access: 'private' });
}

export const storage = {
  // Token Management
  async saveToken(userId: string, accessToken: string, refreshToken: string, expiresInSeconds: number) {
    const expiresAt = Date.now() + expiresInSeconds * 1000;
    const tokenData: TokenData = { accessToken, refreshToken, expiresAt, userId };
    await put(`${TOKEN_PREFIX}${userId}`, JSON.stringify(tokenData), { access: 'private' });
    console.log(`[Storage] Token saved for user ${userId}, expires at ${new Date(expiresAt).toISOString()}`);
  },

  async getToken(userId: string): Promise<TokenData | null> {
    try {
      const blob = await get(`${TOKEN_PREFIX}${userId}`);
      if (!blob) return null;
      const data = await blob.json();
      const token = data as TokenData;
      if (Date.now() >= token.expiresAt) {
        console.log(`[Storage] Token expired for user ${userId}`);
        return null;
      }
      return token;
    } catch (error: any) {
      if (error?.status === 404) return null;
      console.error('[Storage] Error retrieving token:', error);
      return null;
    }
  },

  async getRefreshToken(userId: string): Promise<string | null> {
    const token = await this.getToken(userId);
    return token?.refreshToken || null;
  },

  async updateAccessToken(userId: string, newAccessToken: string, expiresInSeconds: number) {
    const token = await this.getToken(userId);
    if (!token) {
      throw new Error('No existing token to update');
    }
    await this.saveToken(userId, newAccessToken, token.refreshToken, expiresInSeconds);
    console.log(`[Storage] Access token refreshed for user ${userId}`);
  },

  async clearToken(userId: string) {
    try {
      await del(`${TOKEN_PREFIX}${userId}`);
      console.log(`[Storage] Token cleared for user ${userId}`);
    } catch (error) {
      console.error('[Storage] Error clearing token:', error);
    }
  },

  getTokenStats: async () => {
    // Blob storage doesn't support listing by prefix without additional metadata.
    return {
      totalTokens: 'unknown',
      validTokens: 'unknown',
    };
  },

  // Subscription Management
  async saveSubscription(subscriptionId: string, resource: string, expiresAt: number) {
    const subs = await readSubscriptions();
    subs[subscriptionId] = {
      subscriptionId,
      resource,
      expiresAt,
      createdAt: Date.now(),
    };
    await writeSubscriptions(subs);
    console.log(`[Storage] Subscription saved: ${subscriptionId} for resource ${resource}, expires at ${new Date(expiresAt).toISOString()}`);
  },

  async getSubscription(subscriptionId: string): Promise<SubscriptionData | null> {
    const subs = await readSubscriptions();
    return subs[subscriptionId] || null;
  },

  async getAllSubscriptions(): Promise<SubscriptionData[]> {
    const subs = await readSubscriptions();
    return Object.values(subs);
  },

  async getExpiredSubscriptions(): Promise<SubscriptionData[]> {
    const subs = await readSubscriptions();
    const now = Date.now();
    return Object.values(subs).filter((sub) => sub.expiresAt - now < 60 * 60 * 1000);
  },

  async updateSubscription(subscriptionId: string, expiresAt: number) {
    const subs = await readSubscriptions();
    const sub = subs[subscriptionId];
    if (!sub) return;
    sub.expiresAt = expiresAt;
    await writeSubscriptions(subs);
    console.log(`[Storage] Subscription renewed: ${subscriptionId}, new expiry: ${new Date(expiresAt).toISOString()}`);
  },

  async deleteSubscription(subscriptionId: string) {
    const subs = await readSubscriptions();
    if (subs[subscriptionId]) {
      delete subs[subscriptionId];
      await writeSubscriptions(subs);
      console.log(`[Storage] Subscription deleted: ${subscriptionId}`);
    }
  },
};
