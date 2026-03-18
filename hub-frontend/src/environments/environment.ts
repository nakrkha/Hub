declare global {
  interface Window {
    __APP_CONFIG__?: {
      apiUrl?: string;
      authBypass?: boolean;
    };
  }
}

const runtimeConfig = typeof window !== 'undefined' ? window.__APP_CONFIG__ : undefined;
const runtimeApiUrl = runtimeConfig?.apiUrl?.trim();

export const environment = {
  apiUrl: runtimeApiUrl || '/api',
  authBypass: runtimeConfig?.authBypass ?? true,
};
