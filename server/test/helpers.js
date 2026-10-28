import request from 'supertest';
import { createApp } from '../src/app.js';
import { openDb } from '../src/db.js';
import { PythonApiError } from '../src/services/pythonClient.js';

export const SECRET = 'test-secret';

export function fakePython(overrides = {}) {
  const calls = [];
  return {
    calls,
    async evaluate(payload) {
      calls.push(payload);
      if (overrides.error) throw overrides.error;
      return {
        total_score: 80,
        item_scores: payload.items.map((i) => ({ key: i.key, name: i.name, weight: i.weight, score: i.weight * 0.8 })),
        feedback: 'よくできました',
        feedback_source: 'gemini',
        ...overrides.result,
      };
    },
  };
}

export function setup({ python = fakePython(), now } = {}) {
  const db = openDb(':memory:');
  const clock = { t: new Date(now ?? '2026-10-15T03:00:00Z') };
  const app = createApp({ db, python, jwtSecret: SECRET, now: () => clock.t });
  return { app, db, python, clock, api: request(app) };
}

export async function registerUser(api, email = 'a@example.com', password = 'password123') {
  const r = await api.post('/api/auth/register').send({ email, password });
  return { token: r.body.token, id: r.body.user?.id, res: r };
}

export const bearer = (t) => ({ Authorization: `Bearer ${t}` });

export const fullAnswers = (over = {}) => ({
  wake: '07:00', sleep: 4, breakfast: true, lunch: true, dinner: 3, water: 1.5,
  activity: 8000, bath: true, screen_off: false, mood: 5, ...over,
});

export { PythonApiError };
