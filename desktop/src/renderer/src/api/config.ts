// Sidecar sunucu bağlantı bilgisini (port + token) main süreçten alır ve saklar.
interface ApiConfig {
  base: string;
  wsBase: string;
  token: string;
}

let cfg: ApiConfig | null = null;

export async function initApi(): Promise<ApiConfig> {
  const info = await window.asoterm.getServerInfo();
  cfg = {
    base: `http://127.0.0.1:${info.port}`,
    wsBase: `ws://127.0.0.1:${info.port}`,
    token: info.token,
  };
  return cfg;
}

export function api(): ApiConfig {
  if (!cfg) throw new Error('API henüz başlatılmadı');
  return cfg;
}
