import { createApp } from './app.js';
import { openDb } from './db.js';
import { createPythonClient } from './services/pythonClient.js';

const { PORT = '3001', JWT_SECRET, PYTHON_API_URL = 'http://127.0.0.1:8000', INTERNAL_TOKEN, DB_FILE = 'health.db' } = process.env;

if (!JWT_SECRET || !INTERNAL_TOKEN) {
  console.error('JWT_SECRET と INTERNAL_TOKEN を .env に設定してください(.env.example 参照)');
  process.exit(1);
}

const app = createApp({
  db: openDb(DB_FILE),
  python: createPythonClient({ baseUrl: PYTHON_API_URL, token: INTERNAL_TOKEN }),
  jwtSecret: JWT_SECRET,
});
app.listen(Number(PORT), () => console.log(`API server listening on http://localhost:${PORT}`));
