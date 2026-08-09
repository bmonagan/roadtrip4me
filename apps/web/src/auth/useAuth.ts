import { useCallback, useEffect, useState } from 'react';
import { authConfig, authStore } from './authStore';
import {
  buildAuthorizeUrl,
  createCodeChallenge,
  createCodeVerifier,
  randomState,
} from './pkce';

const REDIRECT_PATH = '/auth/callback';

export interface AuthContextValue {
  token: string | null;
  isAuthenticated: boolean;
  authMode: 'auth0' | 'dev';
  login: () => void;
  logout: () => void;
}

export function useAuthState(): AuthContextValue {
  const [token, setToken] = useState<string | null>(authStore.getToken());

  useEffect(() => authStore.subscribe(() => setToken(authStore.getToken())), []);

  const login = useCallback(() => {
    if (!authConfig.configured) return;
    const redirectUri = `${window.location.origin}${REDIRECT_PATH}`;
    const codeVerifier = createCodeVerifier();
    const state = randomState();
    sessionStorage.setItem('roadtrip4me.pkce_verifier', codeVerifier);
    sessionStorage.setItem('roadtrip4me.pkce_state', state);

    createCodeChallenge(codeVerifier).then((codeChallenge) => {
      const url = buildAuthorizeUrl({
        domain: authConfig.domain,
        clientId: authConfig.clientId,
        redirectUri,
        state,
        codeChallenge,
        ...(authConfig.audience ? { audience: authConfig.audience } : {}),
      });
      window.location.href = url;
    });
  }, []);

  const logout = useCallback(() => {
    authStore.setToken(null);
    sessionStorage.removeItem('roadtrip4me.pkce_verifier');
    sessionStorage.removeItem('roadtrip4me.pkce_state');
  }, []);

  return {
    token,
    isAuthenticated: authConfig.configured ? Boolean(token) : true,
    authMode: authConfig.configured ? 'auth0' : 'dev',
    login,
    logout,
  };
}
