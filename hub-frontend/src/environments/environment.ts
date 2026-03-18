declare global {
  interface Window {
    __APP_CONFIG__?: {
      apiUrl?: string;
    };
  }
}

const runtimeApiUrl =
  typeof window !== 'undefined' ? window.__APP_CONFIG__?.apiUrl?.trim() : undefined;

export const environment = {
  apiUrl: runtimeApiUrl || '/api',
};
