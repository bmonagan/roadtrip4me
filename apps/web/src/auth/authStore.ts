// Minimal synchronous token store so the API client can attach the current
// Auth0 access token without a React context.
let token: string | null = localStorage.getItem('roadtrip4me.token');

// Dev-mode fallback identity (used only when Auth0 is not configured). The
// API trusts the x-user-id header while AUTH_DISABLED=true, so switching this
// "logs in" as a different seeded user.
let devUserId: string | null = localStorage.getItem('roadtrip4me.devUserId');

const listeners = new Set<() => void>();

export const authStore = {
  getToken(): string | null {
    return token;
  },
  setToken(next: string | null): void {
    token = next;
    if (next) localStorage.setItem('roadtrip4me.token', next);
    else localStorage.removeItem('roadtrip4me.token');
    listeners.forEach((l) => l());
  },
  getDevUserId(): string | null {
    return devUserId;
  },
  setDevUserId(next: string | null): void {
    devUserId = next;
    if (next) localStorage.setItem('roadtrip4me.devUserId', next);
    else localStorage.removeItem('roadtrip4me.devUserId');
    listeners.forEach((l) => l());
  },
  subscribe(listener: () => void): () => void {
    listeners.add(listener);
    return () => listeners.delete(listener);
  },
};

// Keep auth state in sync across browser tabs: when another tab logs in/out or
// switches dev user, this tab's store updates so the UI doesn't show stale data.
if (typeof window !== 'undefined') {
  window.addEventListener('storage', (event) => {
    if (event.key === 'roadtrip4me.token') {
      token = event.newValue;
      listeners.forEach((l) => l());
    } else if (event.key === 'roadtrip4me.devUserId') {
      devUserId = event.newValue;
      listeners.forEach((l) => l());
    }
  });
}

export const authConfig = {
  get domain(): string {
    return import.meta.env.VITE_AUTH0_DOMAIN ?? '';
  },
  get clientId(): string {
    return import.meta.env.VITE_AUTH0_CLIENT_ID ?? '';
  },
  get audience(): string {
    return import.meta.env.VITE_AUTH0_AUDIENCE ?? '';
  },
  get configured(): boolean {
    return Boolean(this.domain && this.clientId);
  },
};
