import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { authConfig, authStore } from '../auth/authStore';
import { exchangeCodeForToken } from '../auth/pkce';

export default function CallbackPage() {
  const navigate = useNavigate();
  const started = useRef(false);

  // Parse and validate the redirect params synchronously at render time.
  const params = new URLSearchParams(window.location.search);
  const code = params.get('code');
  const state = params.get('state');
  const errorParam = params.get('error');
  const expectedState = sessionStorage.getItem('roadtrip4me.pkce_state');
  const codeVerifier = sessionStorage.getItem('roadtrip4me.pkce_verifier');

  const initialError = errorParam
    ? `Authentication failed: ${errorParam}`
    : !code
      ? 'Missing authorization code'
      : state !== expectedState
        ? 'State mismatch — please try logging in again'
        : !codeVerifier
          ? 'Missing PKCE verifier — please try logging in again'
          : null;

  const [error, setError] = useState<string | null>(initialError);

  useEffect(() => {
    if (started.current || !code || !codeVerifier || error) return;
    started.current = true;

    exchangeCodeForToken({
      domain: authConfig.domain,
      clientId: authConfig.clientId,
      code,
      codeVerifier,
      redirectUri: `${window.location.origin}/auth/callback`,
    })
      .then((token) => {
        authStore.setToken(token);
        sessionStorage.removeItem('roadtrip4me.pkce_verifier');
        sessionStorage.removeItem('roadtrip4me.pkce_state');
        navigate('/', { replace: true });
      })
      .catch((e) => setError((e as Error).message));
  }, [code, codeVerifier, error, navigate]);

  if (error) {
    return (
      <div className="page">
        <p className="error">{error}</p>
      </div>
    );
  }
  return <p className="muted">Signing you in…</p>;
}
