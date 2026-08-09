import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { authConfig, authStore } from '../auth/authStore';
import { exchangeCodeForToken } from '../auth/pkce';

export default function CallbackPage() {
  const navigate = useNavigate();
  const [error, setError] = useState<string | null>(null);
  const started = useRef(false);

  useEffect(() => {
    if (started.current) return;
    started.current = true;

    const params = new URLSearchParams(window.location.search);
    const code = params.get('code');
    const state = params.get('state');
    const errorParam = params.get('error');

    if (errorParam) {
      setError(`Authentication failed: ${errorParam}`);
      return;
    }
    if (!code) {
      setError('Missing authorization code');
      return;
    }

    const expectedState = sessionStorage.getItem('roadtrip4me.pkce_state');
    if (state !== expectedState) {
      setError('State mismatch — please try logging in again');
      return;
    }

    const codeVerifier = sessionStorage.getItem('roadtrip4me.pkce_verifier');
    if (!codeVerifier) {
      setError('Missing PKCE verifier — please try logging in again');
      return;
    }

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
  }, [navigate]);

  if (error) {
    return (
      <div className="page">
        <p className="error">{error}</p>
      </div>
    );
  }
  return <p className="muted">Signing you in…</p>;
}
