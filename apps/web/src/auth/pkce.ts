// PKCE helpers for the Auth0 Authorization Code + PKCE flow.

function toBase64Url(bytes: Uint8Array): string {
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

export function createCodeVerifier(): string {
  const bytes = new Uint8Array(48);
  crypto.getRandomValues(bytes);
  return toBase64Url(bytes);
}

export async function createCodeChallenge(verifier: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(verifier));
  return toBase64Url(new Uint8Array(digest));
}

export function randomState(): string {
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  return toBase64Url(bytes);
}

export function buildAuthorizeUrl(opts: {
  domain: string;
  clientId: string;
  audience?: string;
  redirectUri: string;
  state: string;
  codeChallenge: string;
  screenHint?: 'signup';
  prompt?: 'login';
}): string {
  const params = new URLSearchParams({
    response_type: 'code',
    client_id: opts.clientId,
    redirect_uri: opts.redirectUri,
    code_challenge: opts.codeChallenge,
    code_challenge_method: 'S256',
    state: opts.state,
    scope: 'openid profile email',
  });
  if (opts.audience) params.set('audience', opts.audience);
  if (opts.screenHint) params.set('screen_hint', opts.screenHint);
  if (opts.prompt) params.set('prompt', opts.prompt);
  return `https://${opts.domain}/authorize?${params.toString()}`;
}

export async function exchangeCodeForToken(opts: {
  domain: string;
  clientId: string;
  code: string;
  codeVerifier: string;
  redirectUri: string;
}): Promise<string> {
  const res = await fetch(`https://${opts.domain}/oauth/token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      grant_type: 'authorization_code',
      client_id: opts.clientId,
      code: opts.code,
      code_verifier: opts.codeVerifier,
      redirect_uri: opts.redirectUri,
    }),
  });
  const data = (await res.json()) as { access_token?: string; error_description?: string };
  if (!res.ok || !data.access_token) {
    throw new Error(data.error_description ?? 'Failed to exchange authorization code');
  }
  return data.access_token;
}
