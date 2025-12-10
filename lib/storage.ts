import { put, list } from '@vercel/blob';

type TokenData = {
  accessToken: string;
  refreshToken: string;
  expiresAt: number;
  userId: string;
};

const TOKEN_PREFIX = 'tokens/';

export const storage = {
  async getToken(userId: string = 'default'): Promise<TokenData | null> {
    try {
      // List blobs to find the token
      const { blobs } = await list({ prefix: `${TOKEN_PREFIX}${userId}.json` });

      if (blobs.length === 0) {
        console.log(`[Storage] No token found for ${userId}`);
        return null;
      }

      // Fetch the blob content
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

  async saveSubscription(id: string, resource: string, expiresAt: number): Promise<void> {
    // Implement if needed
  },

  async updateSubscription(id: string, expiresAt: number): Promise<void> {
    // Implement if needed
  },
};
