const { jwtSecret } = require('../config');
const { verifyToken } = require('../utils/jwt');

function requireAuth(req, res, next) {
  const authorizationHeader = req.headers.authorization;

  if (!authorizationHeader || !authorizationHeader.startsWith('Bearer ')) {
    return res.status(401).json({ message: 'Falta el token de autenticación.' });
  }

  const token = authorizationHeader.replace('Bearer ', '');

  try {
    const payload = verifyToken(token, jwtSecret);
    req.user = payload;
    return next();
  } catch {
    return res.status(401).json({ message: 'El token no es válido o ha expirado.' });
  }
}

module.exports = { requireAuth };
