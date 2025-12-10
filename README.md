# AI SMS Assistant

A production-ready personal AI assistant that integrates Twilio, OpenRouter (Claude), and Microsoft 365.

## Features

- 💬 **SMS Interface**: Receive and respond to SMS messages
- 🤖 **AI Powered**: Claude Sonnet 4.5 via OpenRouter with function calling
- 📅 **Calendar Integration**: View and create calendar events
- 📧 **Email Management**: Read inbox and send emails
- 👥 **Contact Management**: Access and manage contacts
- 🔔 **Real-time Notifications**: Microsoft Graph webhooks for email alerts
- 🔄 **Auto Renewal**: Automatic subscription renewal before expiration
- 🔐 **OAuth 2.0 with PKCE**: Secure Microsoft authentication

## Prerequisites

- Node.js 18+
- Twilio account (Account SID, Auth Token, Phone Number)
- OpenRouter API key (for Claude access)
- Microsoft 365 account and Azure AD application
- Public URL for webhook (ngrok for local development)

## Setup

### 1. Create Azure AD Application

1. Go to [Azure Portal](https://portal.azure.com/)
2. Create new app registration
3. Note: Client ID, Client Secret, Tenant ID
4. Add Redirect URI: `http://localhost:3000/api/auth/callback`
5. Grant API permissions:
   - Calendars.ReadWrite
   - Contacts.ReadWrite
   - Mail.ReadWrite
   - User.Read

### 2. Configure Environment Variables

```env
# .env.local
TWILIO_ACCOUNT_SID=your_sid
TWILIO_AUTH_TOKEN=your_token
TWILIO_PHONE_NUMBER=+1234567890
OPENROUTER_API_KEY=your_key
MICROSOFT_CLIENT_ID=your_client_id
MICROSOFT_CLIENT_SECRET=your_secret
MICROSOFT_TENANT_ID=your_tenant
MICROSOFT_REDIRECT_URI=http://localhost:3000/api/auth/callback
NEXT_PUBLIC_APP_URL=http://localhost:3000
USER_PHONE_NUMBER=+1234567890
```

### 3. Install & Run

```bash
npm install
npm run dev
```

### 4. Configure Twilio Webhook

1. Go to Twilio Console
2. Select Phone Number
3. Messaging Webhook: `https://your-domain.com/api/sms`
4. Method: POST

### 5. Test OAuth Flow

Visit: `http://localhost:3000/api/auth/microsoft`

### 6. Subscribe to Email Notifications

```bash
curl -X POST http://localhost:3000/api/webhooks/microsoft/subscribe
```

## Project Structure

```
app/
├── api/
│   ├── sms/
│   │   └── route.ts          # SMS webhook handler
│   ├── auth/
│   │   ├── microsoft.ts       # OAuth initiation
│   │   └── callback.ts        # OAuth callback
│   └── webhooks/
│       └── microsoft/
│           ├── route.ts       # Webhook receiver
│           └── subscribe.ts   # Subscription management
lib/
├── microsoft/
│   └── graph.ts              # Graph API helpers
├── openrouter/
│   └── client.ts             # OpenRouter integration
├── twilio/
│   └── client.ts             # Twilio SMS client
└── storage.ts                # Token storage (in-memory)
```

## Usage Examples

### Send SMS

```bash
curl -X POST http://localhost:3000/api/sms \
  -d "From=+1234567890&Body=What's on my calendar?&MessageSid=SM123"
```

### Get Subscriptions

```bash
curl http://localhost:3000/api/webhooks/microsoft/subscribe
```

### Renew Subscriptions

```bash
curl -X PATCH http://localhost:3000/api/webhooks/microsoft/subscribe
```

## AI System Prompt

The assistant has access to these functions:
- `get_calendar_events` - Fetch upcoming events
- `create_calendar_event` - Create new events
- `send_email` - Send emails
- `get_contacts` - List contacts

Example SMS interactions:
- "What's on my calendar tomorrow?"
- "Send an email to john@example.com saying hello"
- "Create a meeting with Sarah tomorrow at 3pm"
- "Show me my top 5 contacts"

## Production Deployment

### Important Notes

1. **Token Storage**: Currently uses in-memory storage. For production:
   - Integrate with PostgreSQL, MongoDB, or Redis
   - Encrypt tokens at rest
   - Implement proper session management
2. **Webhooks**: Must be publicly accessible
   - Use Vercel, Heroku, or AWS for hosting
   - Update NEXT_PUBLIC_APP_URL to your domain
   - Use HTTPS for all endpoints
3. **Rate Limiting**: Implement to prevent abuse
   - Add middleware to limit SMS requests
   - Throttle OpenRouter API calls
   - Validate user phone numbers
4. **Error Handling**: Enhanced error logging
   - Send detailed errors to Sentry or similar
   - Implement retry logic for failed requests
   - Add monitoring and alerting
5. **Security**:
   - Never commit .env.local
   - Use strong, unique API keys
   - Implement request signing verification
   - Add CORS restrictions

### Deployment Steps

```bash
# Build
npm run build

# Deploy to Vercel
vercel deploy

# Or Docker
docker build -t ai-sms-assistant .
docker run -p 3000:3000 --env-file .env.local ai-sms-assistant
```

### Subscription Renewal

Add a cron job to renew subscriptions:

```ts
// In a background job service
const expiredSubs = storage.getExpiredSubscriptions();
for (const sub of expiredSubs) {
  await renewSubscription(sub.subscriptionId);
}
```

## Testing Locally with ngrok

```bash
# Start ngrok
ngrok http 3000

# Update webhook URLs to ngrok URL
# Add to .env.local
NEXT_PUBLIC_APP_URL=https://xxxx-xx-xxx-xxxx-xx.ngrok.io
```

## Troubleshooting

### OAuth Flow Not Working
- Check Client ID, Secret, and Tenant ID
- Verify Redirect URI matches exactly
- Check that app has required API permissions

### SMS Not Sending
- Verify Twilio credentials
- Check phone number format (+1234567890)
- Ensure Twilio account has credits

### Graph API Errors
- Token may be expired - check OAuth flow
- Verify user has appropriate Microsoft 365 license
- Check that required permissions are granted

### Webhooks Not Firing
- Webhook URL must be publicly accessible
- Check subscription status: GET /api/webhooks/microsoft/subscribe
- Verify clientState matches (sms-assistant)

## Future Enhancements

- [ ] Database integration for persistent token storage
- [ ] Multi-user support with user identification
- [ ] Advanced AI functions (summarization, sentiment analysis)
- [ ] File handling (OneDrive integration)
- [ ] Teams message integration
- [ ] Voice message support
- [ ] Analytics and logging
- [ ] Admin dashboard

## License

MIT

## Support

For issues or questions, create a GitHub issue or contact support.
