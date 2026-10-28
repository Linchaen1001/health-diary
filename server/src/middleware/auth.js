import jwt from 'jsonwebtoken';

export function requireAuth(secret) {
  return (req, res, next) => {
    const h = req.headers.authorization || '';
    const m = /^Bearer (.+)$/.exec(h);
    if (!m) return res.status(401).json({ error: '認証が必要です' });
    try {
      const p = jwt.verify(m[1], secret, { algorithms: ['HS256'] });
      req.user = { id: p.sub };
      next();
    } catch {
      res.status(401).json({ error: 'トークンが無効または期限切れです' });
    }
  };
}

export const signToken = (userId, secret) =>
  jwt.sign({}, secret, { subject: String(userId), expiresIn: '7d', algorithm: 'HS256' });
