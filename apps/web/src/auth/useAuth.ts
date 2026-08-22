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
  devUserId: string | null;
  login: () => void;
  logout: () => void;
  switchUser: (userId: string) => void;
}

export function useAuthState(): AuthContextValue {
  const [token, setToken] = useState<string | null>(authStore.getToken());
  const [devUserId, setDevUserId] = useState<string | null>(
    authStore.getDevUserId()
  );

  useEffect(
    () =>
      authStore.subscribe(() => {
        setToken(authStore.getToken());
        setDevUserId(authStore.getDevUserId());
      }),
    []
  );

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
    authStore.setDevUserId(null);
    sessionStorage.removeItem('roadtrip4me.pkce_verifier');
    sessionStorage.removeItem('roadtrip4me.pkce_state');
  }, []);

  const switchUser = useCallback((userId: string) => {
    authStore.setDevUserId(userId);
  }, []);

  return {
    token,
    isAuthenticated: authConfig.configured ? Boolean(token) : true,
    authMode: authConfig.configured ? 'auth0' : 'dev',
    devUserId,
    login,
    logout,
    switchUser,
  };
}
