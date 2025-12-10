import { NextRequest, NextResponse } from 'next/server';
import { storage } from '@/lib/storage';

const MICROSOFT_CLIENT_ID = process.env.MICROSOFT_CLIENT_ID!;
const MICROSOFT_CLIENT_SECRET = process.env.MICROSOFT_CLIENT_SECRET!;
const MICROSOFT_TENANT_ID = process.env.MICROSOFT_TENANT_ID || 'common';
const REDIRECT_URI = process.env.NEXT_PUBLIC_APP_URL
  ? `${process.env.NEXT_PUBLIC_APP_URL}/api/auth/callback`
  : 'http://localhost:3000/api/auth/callback';

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const code = searchParams.get('code');
  const error = searchParams.get('error');

  console.log('=== OAuth Callback Debug ===');
  console.log('Code:', code ? 'received' : 'missing');
  console.log('Error:', error);

  if (error) {
    return NextResponse.json(
      {
        error: `OAuth error: ${error}`,
        description: searchParams.get('error_description'),
      },
      { status: 400 }
    );
  }

  if (!code) {
    return NextResponse.json(
      {
        error: 'No authorization code received',
      },
      { status: 400 }
    );
  }

  try {
    // Exchange code for tokens
    const tokenResponse = await fetch(
      `https://login.microsoftonline.com/${MICROSOFT_TENANT_ID}/oauth2/v2.0/token`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: new URLSearchParams({
          client_id: MICROSOFT_CLIENT_ID,
          client_secret: MICROSOFT_CLIENT_SECRET,
          code: code,
          redirect_uri: REDIRECT_URI,
          grant_type: 'authorization_code',
        }),
      }
    );

    const tokens = await tokenResponse.json();

    if (tokens.error) {
      console.error('[Auth] Token error:', tokens.error_description);
      return NextResponse.json({ error: tokens.error_description }, { status: 400 });
    }

    // Store tokens using Blob storage
    await storage.saveToken('default', tokens.access_token, tokens.refresh_token, tokens.expires_in);

    console.log('✅ Tokens stored successfully in Blob!');

    return NextResponse.json({
      success: true,
      message: 'Successfully authenticated! You can now text your assistant.',
    });
  } catch (error: any) {
    console.error('[Auth] Token exchange error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
