// In-memory token storage
// ⚠️ For production, use a database (PostgreSQL, MongoDB) or Redis

interface TokenData {
  accessToken: string;
  refreshToken: string;
  expiresAt: number;
  userId: string;
}

interface SubscriptionData {
  subscriptionId: string;
  resource: string;
  expiresAt: number;
  createdAt: number;
}

class InMemoryStorage {
  private tokens: Map<string, TokenData> = new Map();
  private subscriptions: Map<string, SubscriptionData> = new Map();

  // Token Management
  saveToken(userId: string, accessToken: string, refreshToken: string, expiresInSeconds: number) {
    const expiresAt = Date.now() + expiresInSeconds * 1000;
    this.tokens.set(userId, { accessToken, refreshToken, expiresAt, userId });
    console.log(`[Storage] Token saved for user ${userId}, expires at ${new Date(expiresAt).toISOString()}`);
  }

  getToken(userId: string): TokenData | null {
    const token = this.tokens.get(userId);
    if (!token) return null;

    // Check if token is expired
    if (Date.now() >= token.expiresAt) {
      console.log(`[Storage] Token expired for user ${userId}`);
      return null;
    }

    return token;
  }

  getRefreshToken(userId: string): string | null {
    const token = this.tokens.get(userId);
    return token?.refreshToken || null;
  }

  updateAccessToken(userId: string, newAccessToken: string, expiresInSeconds: number) {
    const token = this.tokens.get(userId);
    if (token) {
      token.accessToken = newAccessToken;
      token.expiresAt = Date.now() + expiresInSeconds * 1000;
      console.log(`[Storage] Access token refreshed for user ${userId}`);
    }
  }

  clearToken(userId: string) {
    this.tokens.delete(userId);
    console.log(`[Storage] Token cleared for user ${userId}`);
  }

  // Subscription Management
  saveSubscription(subscriptionId: string, resource: string, expiresAt: number) {
    this.subscriptions.set(subscriptionId, {
      subscriptionId,
      resource,
      expiresAt,
      createdAt: Date.now(),
    });
    console.log(`[Storage] Subscription saved: ${subscriptionId} for resource ${resource}, expires at ${new Date(expiresAt).toISOString()}`);
  }

  getSubscription(subscriptionId: string): SubscriptionData | null {
    return this.subscriptions.get(subscriptionId) || null;
  }

  getAllSubscriptions(): SubscriptionData[] {
    return Array.from(this.subscriptions.values());
  }

  getExpiredSubscriptions(): SubscriptionData[] {
    const now = Date.now();
    return Array.from(this.subscriptions.values()).filter(
      (sub) => sub.expiresAt - now < 60 * 60 * 1000 // Expires within 1 hour
    );
  }

  updateSubscription(subscriptionId: string, expiresAt: number) {
    const sub = this.subscriptions.get(subscriptionId);
    if (sub) {
      sub.expiresAt = expiresAt;
      console.log(`[Storage] Subscription renewed: ${subscriptionId}, new expiry: ${new Date(expiresAt).toISOString()}`);
    }
  }

  deleteSubscription(subscriptionId: string) {
    this.subscriptions.delete(subscriptionId);
    console.log(`[Storage] Subscription deleted: ${subscriptionId}`);
  }

  getTokenStats() {
    return {
      totalTokens: this.tokens.size,
      validTokens: Array.from(this.tokens.values()).filter((t) => Date.now() < t.expiresAt).length,
    };
  }
}

// Singleton instance
export const storage = new InMemoryStorage();
