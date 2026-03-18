const crypto = require('node:crypto');

function toBase64Url(value) {
  return Buffer.from(value)
    .toString('base64')
    .replace(/=/g, '')
    .replace(/\+/g, '-')
    .replace(/\//g, '_');
}

function fromBase64Url(value) {
  const normalized = value.replace(/-/g, '+').replace(/_/g, '/');
  const padded = normalized.padEnd(normalized.length + ((4 - (normalized.length % 4)) % 4), '=');
  return Buffer.from(padded, 'base64').toString('utf-8');
}

function parseExpiration(expiresIn) {
  if (typeof expiresIn === 'number') {
    return expiresIn;
  }

  const match = /^(\d+)([smhd])$/.exec(expiresIn);

  if (!match) {
    return 60 * 60;
  }

  const amount = Number(match[1]);
  const unit = match[2];
  const multipliers = {
    s: 1,
    m: 60,
    h: 60 * 60,
    d: 60 * 60 * 24,
  };

  return amount * multipliers[unit];
}

function createSignature(headerEncoded, payloadEncoded, secret) {
  return crypto
    .createHmac('sha256', secret)
    .update(`${headerEncoded}.${payloadEncoded}`)
    .digest('base64')
    .replace(/=/g, '')
    .replace(/\+/g, '-')
    .replace(/\//g, '_');
}

function signToken(payload, secret, expiresIn) {
  const headerEncoded = toBase64Url(JSON.stringify({ alg: 'HS256', typ: 'JWT' }));
  const payloadWithExp = {
    ...payload,
    exp: Math.floor(Date.now() / 1000) + parseExpiration(expiresIn),
  };
  const payloadEncoded = toBase64Url(JSON.stringify(payloadWithExp));
  const signature = createSignature(headerEncoded, payloadEncoded, secret);

  return `${headerEncoded}.${payloadEncoded}.${signature}`;
}

function verifyToken(token, secret) {
  const [headerEncoded, payloadEncoded, signature] = token.split('.');

  if (!headerEncoded || !payloadEncoded || !signature) {
    throw new Error('Token mal formado.');
  }

  const expectedSignature = createSignature(headerEncoded, payloadEncoded, secret);
  const signaturesMatch = crypto.timingSafeEqual(
    Buffer.from(signature),
    Buffer.from(expectedSignature)
  );

  if (!signaturesMatch) {
    throw new Error('Firma inválida.');
  }

  const payload = JSON.parse(fromBase64Url(payloadEncoded));

  if (!payload.exp || payload.exp <= Math.floor(Date.now() / 1000)) {
    throw new Error('Token expirado.');
  }

  return payload;
}

module.exports = {
  signToken,
  verifyToken,
};
