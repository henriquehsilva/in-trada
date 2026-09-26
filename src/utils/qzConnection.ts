import qz from 'qz-tray';

export const QZ_TRAY_ENABLED = import.meta.env.VITE_ENABLE_QZ_TRAY === '1';
const QZ_CONNECTION_TIMEOUT_MS = 15_000;

let securityConfigured = false;

function withTimeout<T>(promise: Promise<T>, timeoutMs: number, message: string): Promise<T> {
  return new Promise((resolve, reject) => {
    const timeoutId = window.setTimeout(() => reject(new Error(message)), timeoutMs);
    promise.then(
      (value) => {
        window.clearTimeout(timeoutId);
        resolve(value);
      },
      (error) => {
        window.clearTimeout(timeoutId);
        reject(error);
      },
    );
  });
}

export function configureQzSecurity() {
  if (!QZ_TRAY_ENABLED || securityConfigured) return;

  qz.security.setCertificatePromise((resolve, reject) => {
    fetch('/qz/digital-certificate.txt', { cache: 'no-store' })
      .then((response) => (response.ok ? response.text().then(resolve) : response.text().then(reject)));
  });

  qz.security.setSignatureAlgorithm('SHA512');
  qz.security.setSignaturePromise((toSign) => (resolve, reject) => {
    const signUrl = import.meta.env.VITE_QZ_SIGN_URL || '/.netlify/functions/qz-sign';
    fetch(`${signUrl}?request=${encodeURIComponent(toSign)}`, { cache: 'no-store' })
      .then((response) => (response.ok ? response.text().then(resolve) : response.text().then(reject)));
  });

  securityConfigured = true;
}

export async function connectQz(): Promise<string[]> {
  configureQzSecurity();
  if (!QZ_TRAY_ENABLED) return [];

  if (!qz.websocket.isActive()) {
    await withTimeout(
      qz.websocket.connect({ retries: 3, delay: 1 }),
      QZ_CONNECTION_TIMEOUT_MS,
      'O QZ Tray não respondeu em 15 segundos. Confirme se o aplicativo está aberto e autorizado.',
    );
  }

  const result = await qz.printers.find() as string | string[];
  const printers = Array.isArray(result) ? result : result ? [result] : [];

  // Mantém a impressora padrão do sistema no topo sem alterar os nomes que o QZ exige.
  try {
    const systemDefault = await qz.printers.getDefault();
    return printers.sort((a, b) => {
      if (a === systemDefault) return -1;
      if (b === systemDefault) return 1;
      return a.localeCompare(b);
    });
  } catch {
    return printers.sort((a, b) => a.localeCompare(b));
  }
}

export function selectQzPrinter(printers: string[], savedPrinter: string): string {
  return savedPrinter && printers.includes(savedPrinter) ? savedPrinter : printers[0] || '';
}

export function isQzConnected() {
  return QZ_TRAY_ENABLED && qz.websocket.isActive();
}
