import crypto from 'crypto';

export const handler = async (event) => {
  const privateKeyB64 = process.env.QZ_PRIVATE_KEY_B64;
  if (!privateKeyB64) {
    return { statusCode: 500, body: 'QZ_PRIVATE_KEY_B64 não configurada nas variáveis de ambiente do Netlify' };
  }
  // Guarda a chave em base64 (uma linha só) pra evitar que a UI do Netlify corrompa as quebras de linha do PEM.
  const privateKey = Buffer.from(privateKeyB64, 'base64').toString('utf8');

  const request = event.queryStringParameters?.request || '';

  const signer = crypto.createSign('RSA-SHA512');
  signer.update(request);
  signer.end();
  const signature = signer.sign(privateKey, 'base64');

  return {
    statusCode: 200,
    headers: { 'Content-Type': 'text/plain' },
    body: signature,
  };
};
