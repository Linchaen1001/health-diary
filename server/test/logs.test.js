import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { setup, registerUser, bearer, fullAnswers, fakePython, PythonApiError } from './helpers.js';

async function ready(opts) {
  const ctx = setup(opts);
  const u = await registerUser(ctx.api);
  return { ...ctx, ...u, h: bearer(u.token) };
}

describe('POST /api/logs', () => {
  test('正常: Pythonに重み付きで渡し、結果を保存して返す', async () => {
    const { api, h, python } = await ready();
    const r = await api.post('/api/logs').set(h).send({ answers: fullAnswers(), free_text: 'だるい' });
    assert.equal(r.status, 201);
    assert.equal(r.body.log.total_score, 80);
    assert.equal(r.body.log.feedback, 'よくできました');
    assert.equal(r.body.log.date, '2026-10-15');
    const p = python.calls[0];
    assert.equal(p.items.length, 10);
    assert.equal(p.items.reduce((s, i) => s + i.weight, 0), 100);
    assert.equal(p.items.find((i) => i.key === 'wake').target, '07:00');
    assert.equal(p.free_text, 'だるい');
    const today = await api.get('/api/logs/today').set(h);
    assert.equal(today.body.log.total_score, 80);
  });

  test('正常: 同日の再送信は上書き(1件のまま)', async () => {
    const { api, h, db } = await ready();
    await api.post('/api/logs').set(h).send({ answers: fullAnswers() });
    await api.post('/api/logs').set(h).send({ answers: fullAnswers({ mood: 1 }) });
    assert.equal(db.prepare('SELECT COUNT(*) c FROM logs').get().c, 1);
    assert.equal((await api.get('/api/logs/today').set(h)).body.log.answers.mood, 1);
  });

  test('正常: JST基準の日付(UTC 15:00 以降は翌日)', async () => {
    const { api, h } = await ready({ now: '2026-10-15T15:00:00Z' });
    const r = await api.post('/api/logs').set(h).send({ answers: fullAnswers() });
    assert.equal(r.body.log.date, '2026-10-16');
  });

  test('異常: answers 欠落/配列/文字列は400', async () => {
    const { api, h } = await ready();
    for (const body of [{}, { answers: [] }, { answers: 'x' }, { answers: null }]) {
      assert.equal((await api.post('/api/logs').set(h).send(body)).status, 400);
    }
  });

  test('異常: 必須項目が欠けると400で項目別エラー、Pythonは呼ばれない', async () => {
    const { api, h, python } = await ready();
    const a = fullAnswers();
    delete a.sleep;
    const r = await api.post('/api/logs').set(h).send({ answers: a });
    assert.equal(r.status, 400);
    assert.equal(r.body.fields.sleep, '未入力です');
    assert.equal(python.calls.length, 0);
  });

  const invalid = [
    ['bool に文字列', { breakfast: 'yes' }],
    ['scale5 が小数', { sleep: 2.5 }],
    ['scale3 が 4', { dinner: 4 }],
    ['water が負', { water: -0.1 }],
    ['steps が文字列', { activity: '8000' }],
    ['time の形式不正', { wake: '7:00' }],
    ['time が範囲外', { wake: '24:00' }],
    ['null', { mood: null }],
  ];
  for (const [name, over] of invalid) {
    test(`異常: ${name} は400`, async () => {
      const { api, h } = await ready();
      const r = await api.post('/api/logs').set(h).send({ answers: fullAnswers(over) });
      assert.equal(r.status, 400);
    });
  }

  test('境界: 各項目の上下限は受理される', async () => {
    const { api, h } = await ready();
    for (const over of [
      { sleep: 1, dinner: 1, water: 0, activity: 0, wake: '00:00', mood: 1 },
      { sleep: 5, dinner: 3, water: 20, activity: 100000, wake: '23:59', mood: 5 },
    ]) {
      assert.equal((await api.post('/api/logs').set(h).send({ answers: fullAnswers(over) })).status, 201);
    }
  });

  test('境界: 上限超過(water 20.1 / steps 100001 / scale5 0,6)は400', async () => {
    const { api, h } = await ready();
    for (const over of [{ water: 20.1 }, { activity: 100001 }, { sleep: 0 }, { sleep: 6 }]) {
      assert.equal((await api.post('/api/logs').set(h).send({ answers: fullAnswers(over) })).status, 400);
    }
  });

  test('境界: 自由記述 1000文字OK / 1001文字は400 / 省略OK', async () => {
    const { api, h } = await ready();
    const post = (free_text) => api.post('/api/logs').set(h).send({ answers: fullAnswers(), free_text });
    assert.equal((await post('あ'.repeat(1000))).status, 201);
    assert.equal((await post('あ'.repeat(1001))).status, 400);
    assert.equal((await post(123)).status, 400);
    assert.equal((await api.post('/api/logs').set(h).send({ answers: fullAnswers() })).status, 201);
  });

  test('異常: Python接続失敗/5xxは502', async () => {
    const { api, h } = await ready({ python: fakePython({ error: new PythonApiError('down') }) });
    assert.equal((await api.post('/api/logs').set(h).send({ answers: fullAnswers() })).status, 502);
    const c2 = await ready({ python: fakePython({ error: new PythonApiError('boom', 500) }) });
    assert.equal((await c2.api.post('/api/logs').set(c2.h).send({ answers: fullAnswers() })).status, 502);
  });

  test('異常: Pythonが422を返したら400', async () => {
    const { api, h } = await ready({ python: fakePython({ error: new PythonApiError('重みの合計は 100 である必要があります', 422) }) });
    assert.equal((await api.post('/api/logs').set(h).send({ answers: fullAnswers() })).status, 400);
  });

  test('異常: Python失敗時はDBに保存されない', async () => {
    const { api, h, db } = await ready({ python: fakePython({ error: new PythonApiError('down') }) });
    await api.post('/api/logs').set(h).send({ answers: fullAnswers() });
    assert.equal(db.prepare('SELECT COUNT(*) c FROM logs').get().c, 0);
  });

  test('異常: 未認証は401', async () => {
    const { api } = setup();
    assert.equal((await api.post('/api/logs').send({ answers: fullAnswers() })).status, 401);
  });

  test('正常: 無効化した項目は回答不要で、重みは再按分される', async () => {
    const { api, h, python } = await ready();
    const items = (await api.get('/api/settings/items').set(h)).body.items;
    await api.post('/api/settings/items').set(h).send({ action: 'update', id: items[0].id, enabled: false });
    const a = fullAnswers();
    delete a.wake;
    assert.equal((await api.post('/api/logs').set(h).send({ answers: a })).status, 201);
    const w = python.calls[0].items.map((i) => i.weight);
    assert.equal(w.length, 9);
    assert.equal(w.reduce((s, x) => s + x, 0), 100);
  });

  test('正常: ユーザー間でデータが分離される', async () => {
    const { api, h } = await ready();
    await api.post('/api/logs').set(h).send({ answers: fullAnswers() });
    const other = await registerUser(api, 'b@example.com');
    const r = await api.get('/api/logs/today').set(bearer(other.token));
    assert.equal(r.body.log, null);
  });
});

describe('GET /api/logs/today', () => {
  test('正常: 未記録なら log:null', async () => {
    const { api, h } = await ready();
    const r = await api.get('/api/logs/today').set(h);
    assert.equal(r.status, 200);
    assert.equal(r.body.log, null);
  });
});

describe('GET /api/logs/history', () => {
  function seed(db, uid, dates) {
    for (const [i, d] of dates.entries()) {
      db.prepare(
        `INSERT INTO logs (user_id, date, answers_json, free_text, item_scores_json, total_score, feedback)
         VALUES (?, ?, '{}', '', '[]', ?, 'fb')`,
      ).run(uid, d, 50 + i);
    }
  }

  test('正常: 新しい順の一覧と、古い順のtrend', async () => {
    const { api, h, db, id } = await ready();
    seed(db, id, ['2026-10-13', '2026-10-14', '2026-10-15']);
    const r = await api.get('/api/logs/history?range=week').set(h);
    assert.equal(r.status, 200);
    assert.deepEqual(r.body.logs.map((l) => l.date), ['2026-10-15', '2026-10-14', '2026-10-13']);
    assert.deepEqual(r.body.trend.map((t) => t.date), ['2026-10-13', '2026-10-14', '2026-10-15']);
  });

  test('境界: week は今日を含む7日(6日前=含む / 7日前=除外)', async () => {
    const { api, h, db, id } = await ready();
    seed(db, id, ['2026-10-08', '2026-10-09', '2026-10-15']);
    const r = await api.get('/api/logs/history?range=week').set(h);
    assert.deepEqual(r.body.logs.map((l) => l.date), ['2026-10-15', '2026-10-09']);
  });

  test('境界: month は30日(29日前=含む / 30日前=除外)', async () => {
    const { api, h, db, id } = await ready();
    seed(db, id, ['2026-09-15', '2026-09-16', '2026-10-15']);
    const r = await api.get('/api/logs/history?range=month').set(h);
    assert.deepEqual(r.body.logs.map((l) => l.date), ['2026-10-15', '2026-09-16']);
  });

  test('正常: all は全期間 / 未指定は month', async () => {
    const { api, h, db, id } = await ready();
    seed(db, id, ['2025-01-01', '2026-10-15']);
    assert.equal((await api.get('/api/logs/history?range=all').set(h)).body.logs.length, 2);
    const d = await api.get('/api/logs/history').set(h);
    assert.equal(d.body.range, 'month');
    assert.equal(d.body.logs.length, 1);
  });

  test('正常: データなしは空配列', async () => {
    const { api, h } = await ready();
    const r = await api.get('/api/logs/history?range=week').set(h);
    assert.deepEqual(r.body, { range: 'week', logs: [], trend: [] });
  });

  test('異常: 不正な range は400', async () => {
    const { api, h } = await ready();
    assert.equal((await api.get('/api/logs/history?range=year').set(h)).status, 400);
  });
});
