import qz from 'qz-tray';

export const QZ_TRAY_ENABLED = import.meta.env.VITE_ENABLE_QZ_TRAY === '1';

let securityConfigured = false;

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
    await qz.websocket.connect({ retries: 3, delay: 1 });
  }

  const result = await qz.printers.find() as string | string[];
  return Array.isArray(result) ? result : result ? [result] : [];
}

export function isQzConnected() {
  return QZ_TRAY_ENABLED && qz.websocket.isActive();
}
