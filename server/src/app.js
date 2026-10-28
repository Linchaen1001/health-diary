import express from 'express';
import { requireAuth } from './middleware/auth.js';
import { authRouter } from './routes/auth.js';
import { logsRouter } from './routes/logs.js';
import { settingsRouter } from './routes/settings.js';

// 依存(db / python / jwtSecret / now)は注入できる。テストでは Python をモックする。
export function createApp({ db, python, jwtSecret, now = () => new Date() }) {
  if (!jwtSecret) throw new Error('jwtSecret is required');
  const app = express();
  app.use(express.json({ limit: '100kb' }));

  app.get('/api/health', (_req, res) => res.json({ ok: true }));
  app.use('/api/auth', authRouter({ db, jwtSecret }));
  const auth = requireAuth(jwtSecret);
  app.use('/api/logs', auth, logsRouter({ db, python, now }));
  app.use('/api/settings', auth, settingsRouter({ db }));

  app.use('/api', (_req, res) => res.status(404).json({ error: 'Not Found' }));
  // eslint-disable-next-line no-unused-vars
  app.use((err, _req, res, _next) => {
    if (err.type === 'entity.parse.failed') return res.status(400).json({ error: 'JSON の形式が正しくありません' });
    if (err.type === 'entity.too.large') return res.status(413).json({ error: 'リクエストが大きすぎます' });
    console.error(err);
    res.status(500).json({ error: 'サーバーエラーが発生しました' });
  });
  return app;
}
