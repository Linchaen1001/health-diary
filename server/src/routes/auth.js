import { Router } from 'express';
import bcrypt from 'bcryptjs';
import { transaction } from '../db.js';
import { signToken } from '../middleware/auth.js';
import { seedBaseItems } from '../services/items.js';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function parseCreds(body) {
  const email = typeof body?.email === 'string' ? body.email.trim().toLowerCase() : '';
  const password = typeof body?.password === 'string' ? body.password : '';
  return { email, password };
}

export function authRouter({ db, jwtSecret }) {
  const r = Router();

  r.post('/register', async (req, res) => {
    const { email, password } = parseCreds(req.body);
    if (!EMAIL_RE.test(email) || email.length > 254) return res.status(400).json({ error: 'メールアドレスの形式が正しくありません' });
    if (password.length < 8 || Buffer.byteLength(password) > 72)
      return res.status(400).json({ error: 'パスワードは8文字以上72バイト以下で入力してください' });
    if (db.prepare('SELECT 1 FROM users WHERE email = ?').get(email))
      return res.status(409).json({ error: 'このメールアドレスは既に登録されています' });

    const hash = await bcrypt.hash(password, 10);
    let id;
    try {
      id = transaction(db, () => {
        const ins = db.prepare('INSERT INTO users (email, password_hash) VALUES (?, ?)').run(email, hash);
        const uid = Number(ins.lastInsertRowid);
        seedBaseItems(db, uid);
        return uid;
      });
    } catch (e) {
      if (/UNIQUE/i.test(e.message)) return res.status(409).json({ error: 'このメールアドレスは既に登録されています' });
      throw e;
    }
    res.status(201).json({ token: signToken(id, jwtSecret), user: { id, email } });
  });

  r.post('/login', async (req, res) => {
    const { email, password } = parseCreds(req.body);
    const u = email && password ? db.prepare('SELECT * FROM users WHERE email = ?').get(email) : null;
    const ok = u && (await bcrypt.compare(password, u.password_hash));
    if (!ok) return res.status(401).json({ error: 'メールアドレスまたはパスワードが違います' });
    res.json({ token: signToken(u.id, jwtSecret), user: { id: Number(u.id), email: u.email } });
  });

  return r;
}
