import { Router } from 'express';
import { listItems } from '../services/items.js';
import { PythonApiError } from '../services/pythonClient.js';
import { checkValue } from '../services/validate.js';

const FREE_TEXT_MAX = 1000;
const RANGE_DAYS = { week: 7, month: 30 };

export const tokyoDate = (d = new Date()) => d.toLocaleDateString('sv-SE', { timeZone: 'Asia/Tokyo' });

function shiftDate(ymd, days) {
  const d = new Date(`${ymd}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

const toLog = (r) => ({
  date: r.date,
  answers: JSON.parse(r.answers_json),
  free_text: r.free_text,
  item_scores: JSON.parse(r.item_scores_json),
  total_score: r.total_score,
  feedback: r.feedback,
  feedback_source: r.feedback_source,
});

export function logsRouter({ db, python, now }) {
  const r = Router();

  r.post('/', async (req, res) => {
    const uid = req.user.id;
    const { answers, free_text: freeRaw } = req.body ?? {};
    if (!answers || typeof answers !== 'object' || Array.isArray(answers))
      return res.status(400).json({ error: 'answers が必要です' });
    const free_text = freeRaw === undefined || freeRaw === null ? '' : freeRaw;
    if (typeof free_text !== 'string' || free_text.length > FREE_TEXT_MAX)
      return res.status(400).json({ error: `自由記述は${FREE_TEXT_MAX}文字以内で入力してください` });

    const items = listItems(db, uid).filter((i) => i.enabled);
    const errors = {};
    for (const it of items) {
      if (!(it.key in answers)) errors[it.key] = '未入力です';
      else {
        const msg = checkValue(it.type, answers[it.key]);
        if (msg) errors[it.key] = msg;
      }
    }
    if (Object.keys(errors).length) return res.status(400).json({ error: '入力内容に誤りがあります', fields: errors });

    const payload = {
      items: items.map((it) => ({
        key: it.key, name: it.name, type: it.type, weight: it.weight, value: answers[it.key],
        ...(it.type === 'time' ? { target: it.config.target ?? '07:00' } : {}),
      })),
      free_text,
    };

    let result;
    try {
      result = await python.evaluate(payload);
    } catch (e) {
      if (e instanceof PythonApiError) {
        const status = e.status === 422 ? 400 : 502;
        return res.status(status).json({ error: status === 400 ? e.message : 'AI採点サービスに接続できませんでした。時間をおいて再度お試しください' });
      }
      throw e;
    }

    const date = tokyoDate(now());
    const answersOnly = Object.fromEntries(items.map((it) => [it.key, answers[it.key]]));
    db.prepare(
      `INSERT INTO logs (user_id, date, answers_json, free_text, item_scores_json, total_score, feedback, feedback_source)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT(user_id, date) DO UPDATE SET
         answers_json = excluded.answers_json, free_text = excluded.free_text,
         item_scores_json = excluded.item_scores_json, total_score = excluded.total_score,
         feedback = excluded.feedback, feedback_source = excluded.feedback_source,
         created_at = datetime('now')`,
    ).run(uid, date, JSON.stringify(answersOnly), free_text, JSON.stringify(result.item_scores ?? []),
      result.total_score, result.feedback, result.feedback_source ?? 'gemini');

    res.status(201).json({ log: toLog(db.prepare('SELECT * FROM logs WHERE user_id = ? AND date = ?').get(uid, date)) });
  });

  r.get('/today', (req, res) => {
    const row = db.prepare('SELECT * FROM logs WHERE user_id = ? AND date = ?').get(req.user.id, tokyoDate(now()));
    res.json({ date: tokyoDate(now()), log: row ? toLog(row) : null });
  });

  r.get('/history', (req, res) => {
    const range = req.query.range ?? 'month';
    if (range !== 'all' && !RANGE_DAYS[range]) return res.status(400).json({ error: 'range は week / month / all のいずれかです' });
    const today = tokyoDate(now());
    const rows = range === 'all'
      ? db.prepare('SELECT * FROM logs WHERE user_id = ? ORDER BY date DESC LIMIT 365').all(req.user.id)
      : db.prepare('SELECT * FROM logs WHERE user_id = ? AND date >= ? AND date <= ? ORDER BY date DESC')
          .all(req.user.id, shiftDate(today, -(RANGE_DAYS[range] - 1)), today);
    const logs = rows.map(toLog);
    const trend = logs.map((l) => ({ date: l.date, score: l.total_score })).reverse();
    res.json({ range, logs, trend });
  });

  return r;
}
