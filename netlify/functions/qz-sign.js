import crypto from 'crypto';

export const handler = async (event) => {
  const privateKeyB64 = process.env.QZ_PRIVATE_KEY_B64;
  if (!privateKeyB64) {
    return { statusCode: 500, body: 'QZ_PRIVATE_KEY_B64 não configurada nas variáveis de ambiente do Netlify' };
  }
  // Guarda a chave em base64 (uma linha só) pra evitar que a UI do Netlify corrompa as quebras de linha do PEM.
  const privateKey = Buffer.from(privateKeyB64, 'base64').toString('utf8');

  // POST evita o limite de tamanho da URL para trabalhos que contêm imagens
  // Base64. O parâmetro GET continua aceito para clientes antigos.
  const request = event.httpMethod === 'POST'
    ? (event.isBase64Encoded ? Buffer.from(event.body || '', 'base64').toString('utf8') : event.body || '')
    : event.queryStringParameters?.request || '';

  if (!request) {
    return { statusCode: 400, body: 'Conteúdo para assinatura não informado' };
  }

  const signer = crypto.createSign('RSA-SHA512');
  signer.update(request);
  signer.end();
  const signature = signer.sign(privateKey, 'base64');

  return {
    statusCode: 200,
    headers: {
      'Content-Type': 'text/plain',
      'Cache-Control': 'no-store',
    },
    body: signature,
  };
};
