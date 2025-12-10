import { put, list } from '@vercel/blob';

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
};

const TOKEN_PREFIX = 'tokens/';
const SUBSCRIPTION_PREFIX = 'subscriptions/';

export const storage = {
  async getToken(userId: string = 'default'): Promise<TokenData | null> {
    try {
      const { blobs } = await list({ prefix: `${TOKEN_PREFIX}${userId}.json` });

      if (blobs.length === 0) {
        console.log(`[Storage] No token found for ${userId}`);
        return null;
      }

      const response = await fetch(blobs[0].url);
      const data = await response.json();

      console.log(`[Storage] Token retrieved for ${userId}`);
      return data as TokenData;
    } catch (error) {
      console.error('[Storage] Error getting token:', error);
      return null;
    }
  },

  async saveToken(
    userId: string,
    accessToken: string,
    refreshToken: string,
    expiresIn: number
  ): Promise<void> {
    try {
      const expiresAt = Date.now() + expiresIn * 1000;
      const tokenData: TokenData = {
        accessToken,
        refreshToken,
        expiresAt,
        userId,
      };

      const blob = await put(`${TOKEN_PREFIX}${userId}.json`, JSON.stringify(tokenData), {
        access: 'public',
        addRandomSuffix: false,
      });

      console.log(`[Storage] Token saved for ${userId} at ${blob.url}`);
    } catch (error) {
      console.error('[Storage] Error saving token:', error);
      throw error;
    }
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
  },

  async saveSubscription(subscriptionId: string, resource: string, expiresAt: number): Promise<void> {
    try {
      const data: SubscriptionData = { subscriptionId, resource, expiresAt };
      await put(`${SUBSCRIPTION_PREFIX}${subscriptionId}.json`, JSON.stringify(data), {
        access: 'public',
        addRandomSuffix: false,
      });
      console.log(`[Storage] Subscription saved: ${subscriptionId}`);
    } catch (error) {
      console.error('[Storage] Error saving subscription:', error);
    }
  },

  async updateSubscription(subscriptionId: string, expiresAt: number): Promise<void> {
    try {
      const { blobs } = await list({ prefix: `${SUBSCRIPTION_PREFIX}${subscriptionId}.json` });
      if (blobs.length > 0) {
        const response = await fetch(blobs[0].url);
        const data = await response.json();
        data.expiresAt = expiresAt;
        await put(`${SUBSCRIPTION_PREFIX}${subscriptionId}.json`, JSON.stringify(data), {
          access: 'public',
          addRandomSuffix: false,
        });
      }
    } catch (error) {
      console.error('[Storage] Error updating subscription:', error);
    }
  },

  async getExpiredSubscriptions(): Promise<SubscriptionData[]> {
    try {
      const { blobs } = await list({ prefix: SUBSCRIPTION_PREFIX });
      const subscriptions: SubscriptionData[] = [];

      for (const blob of blobs) {
        const response = await fetch(blob.url);
        const data = await response.json();
        subscriptions.push(data as SubscriptionData);
      }

      return subscriptions.filter((sub) => sub.expiresAt < Date.now());
    } catch (error) {
      console.error('[Storage] Error getting expired subscriptions:', error);
      return [];
    }
  },
};
