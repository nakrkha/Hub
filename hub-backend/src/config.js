module.exports = {
  port: Number(process.env.PORT) || 3000,
  jwtSecret: process.env.JWT_SECRET || 'hub-personal-secret-dev',
  tokenExpiration: '12h',
};
