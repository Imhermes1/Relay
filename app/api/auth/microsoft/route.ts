import { NextResponse } from 'next/server';

const MICROSOFT_CLIENT_ID = process.env.MICROSOFT_CLIENT_ID!;
const MICROSOFT_TENANT_ID = process.env.MICROSOFT_TENANT_ID || 'common';
const REDIRECT_URI = process.env.NEXT_PUBLIC_APP_URL 
  ? `${process.env.NEXT_PUBLIC_APP_URL}/api/auth/callback`
  : 'http://localhost:3000/api/auth/callback';

const SCOPES = [
  'Calendars.ReadWrite',
  'Contacts.ReadWrite',
  'Mail.Read',
  'Mail.Send',
  'User.Read',
  'offline_access'
].join(' ');

export async function GET() {
  const authUrl = new URL(`https://login.microsoftonline.com/${MICROSOFT_TENANT_ID}/oauth2/v2.0/authorize`);
  
  authUrl.searchParams.set('client_id', MICROSOFT_CLIENT_ID);
  authUrl.searchParams.set('response_type', 'code');
  authUrl.searchParams.set('redirect_uri', REDIRECT_URI);
  authUrl.searchParams.set('scope', SCOPES);
  authUrl.searchParams.set('response_mode', 'query');
  
  return NextResponse.redirect(authUrl.toString());
}
