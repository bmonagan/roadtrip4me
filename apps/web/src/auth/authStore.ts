// Minimal synchronous token store so the API client can attach the current
// Auth0 access token without a React context.
let token: string | null = localStorage.getItem('roadtrip4me.token');

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
  subscribe(listener: () => void): () => void {
    listeners.add(listener);
    return () => listeners.delete(listener);
  },
};

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
