const crypto = require('crypto');

exports.handler = async (event) => {
  const privateKey = process.env.QZ_PRIVATE_KEY;
  if (!privateKey) {
    return { statusCode: 500, body: 'QZ_PRIVATE_KEY não configurada nas variáveis de ambiente do Netlify' };
  }

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
