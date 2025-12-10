import { put } from '@vercel/blob';

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

const TOKEN_PREFIX = 'tokens/';
const SUBSCRIPTION_INDEX = 'subscriptions/index.json';
const BLOB_TOKEN = process.env.BLOB_READ_WRITE_TOKEN;
const BASE_URL = BLOB_TOKEN ? `https://blob.vercel-storage.com/${BLOB_TOKEN}/` : null;

async function fetchBlobJson<T>(key: string): Promise<T | null> {
  if (!BASE_URL) {
    console.warn('[Storage] BLOB_READ_WRITE_TOKEN not configured');
    return null;
  }
  try {
    const res = await fetch(`${BASE_URL}${key}`);
    if (!res.ok) {
      return null;
    }
    return (await res.json()) as T;
  } catch (error) {
    console.error('[Storage] Error fetching blob json:', error);
    return null;
  }
}

async function writeBlob(key: string, data: unknown) {
  await put(key, JSON.stringify(data), {
    access: 'public',
    addRandomSuffix: false,
  });
}

async function readSubscriptions(): Promise<Record<string, SubscriptionData>> {
  const data = await fetchBlobJson<Record<string, SubscriptionData>>(SUBSCRIPTION_INDEX);
  return data || {};
}

export const storage = {
  async getToken(userId: string = 'default'): Promise<TokenData | null> {
    const key = `${TOKEN_PREFIX}${userId}.json`;
    const token = await fetchBlobJson<TokenData>(key);
    if (!token) {
      console.log(`[Storage] No token found for ${userId}`);
      return null;
    }
    console.log(`[Storage] Token retrieved for ${userId}`);
    return token;
  },

  async saveToken(userId: string, accessToken: string, refreshToken: string, expiresIn: number): Promise<void> {
    const expiresAt = Date.now() + expiresIn * 1000;
    const tokenData: TokenData = {
      accessToken,
      refreshToken,
      expiresAt,
      userId,
    };

    const key = `${TOKEN_PREFIX}${userId}.json`;
    const blob = await put(key, JSON.stringify(tokenData), {
      access: 'public',
      addRandomSuffix: false,
    });

    console.log(`[Storage] Token saved for ${userId} at ${blob.url}`);
  },

  async updateAccessToken(userId: string, accessToken: string, expiresIn: number): Promise<void> {
    const existing = await this.getToken(userId);
    if (!existing) {
      throw new Error('No existing token to update');
    }

    await this.saveToken(userId, accessToken, existing.refreshToken, expiresIn);
  },

  async getRefreshToken(userId: string = 'default'): Promise<string | null> {
    const token = await this.getToken(userId);
    return token?.refreshToken || null;
  },

  async clearToken(userId: string = 'default'): Promise<void> {
    console.log(`[Storage] Token clear requested for ${userId}`);
    // Deletion not implemented; would require signed URLs or management API.
  },

  // Subscription helpers (stored in a single index file)
  async saveSubscription(subscriptionId: string, resource: string, expiresAt: number) {
    const subs = await readSubscriptions();
    subs[subscriptionId] = {
      subscriptionId,
      resource,
      expiresAt,
      createdAt: Date.now(),
    };
    await writeBlob(SUBSCRIPTION_INDEX, subs);
    console.log(`[Storage] Subscription saved: ${subscriptionId}`);
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
    await writeBlob(SUBSCRIPTION_INDEX, subs);
    console.log(`[Storage] Subscription renewed: ${subscriptionId}`);
  },

  async deleteSubscription(subscriptionId: string) {
    const subs = await readSubscriptions();
    if (subs[subscriptionId]) {
      delete subs[subscriptionId];
      await writeBlob(SUBSCRIPTION_INDEX, subs);
      console.log(`[Storage] Subscription deleted: ${subscriptionId}`);
    }
  },
};
