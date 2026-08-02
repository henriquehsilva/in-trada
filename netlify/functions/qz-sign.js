import crypto from 'crypto';

export const handler = async (event) => {
  const rawPrivateKey = process.env.QZ_PRIVATE_KEY;
  if (!rawPrivateKey) {
    return { statusCode: 500, body: 'QZ_PRIVATE_KEY não configurada nas variáveis de ambiente do Netlify' };
  }
  // Env vars costumam achatar as quebras de linha do PEM em "\n" literais; normaliza antes de assinar.
  const privateKey = rawPrivateKey.replace(/\\n/g, '\n');

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
