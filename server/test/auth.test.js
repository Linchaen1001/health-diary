import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import jwt from 'jsonwebtoken';
import { setup, registerUser, bearer, SECRET } from './helpers.js';

describe('POST /api/auth/register', () => {
  test('正常: 登録でトークンと基本10項目が作られる', async () => {
    const { api } = setup();
    const { token, res } = await registerUser(api);
    assert.equal(res.status, 201);
    assert.ok(token);
    const items = await api.get('/api/settings/items').set(bearer(token));
    assert.equal(items.body.items.length, 10);
  });

  test('正常: メールは小文字化・前後空白除去される', async () => {
    const { api } = setup();
    await registerUser(api, '  Foo@Example.COM ');
    const r = await api.post('/api/auth/login').send({ email: 'foo@example.com', password: 'password123' });
    assert.equal(r.status, 200);
  });

  test('異常: 重複メールは409', async () => {
    const { api } = setup();
    await registerUser(api);
    const { res } = await registerUser(api, 'A@example.com');
    assert.equal(res.status, 409);
  });

  for (const email of ['', 'abc', 'a@b', '@x.com', 'a b@x.com', undefined, 123]) {
    test(`異常: 不正メール ${JSON.stringify(email)} は400`, async () => {
      const { api } = setup();
      const r = await api.post('/api/auth/register').send({ email, password: 'password123' });
      assert.equal(r.status, 400);
    });
  }

  test('境界: パスワード7文字は400、8文字は201', async () => {
    const { api } = setup();
    assert.equal((await api.post('/api/auth/register').send({ email: 'a@x.com', password: '1234567' })).status, 400);
    assert.equal((await api.post('/api/auth/register').send({ email: 'a@x.com', password: '12345678' })).status, 201);
  });

  test('境界: パスワード72バイトは201、73バイトは400', async () => {
    const { api } = setup();
    assert.equal((await api.post('/api/auth/register').send({ email: 'a@x.com', password: 'a'.repeat(72) })).status, 201);
    assert.equal((await api.post('/api/auth/register').send({ email: 'b@x.com', password: 'a'.repeat(73) })).status, 400);
  });

  test('異常: ボディなし/壊れたJSONは400', async () => {
    const { api } = setup();
    assert.equal((await api.post('/api/auth/register')).status, 400);
    const r = await api.post('/api/auth/register').set('Content-Type', 'application/json').send('{bad');
    assert.equal(r.status, 400);
  });
});

describe('POST /api/auth/login', () => {
  test('正常: ログインでトークン発行', async () => {
    const { api } = setup();
    await registerUser(api);
    const r = await api.post('/api/auth/login').send({ email: 'a@example.com', password: 'password123' });
    assert.equal(r.status, 200);
    assert.ok(r.body.token);
    assert.equal(r.body.user.email, 'a@example.com');
  });

  test('異常: 誤パスワード/未登録/空は401', async () => {
    const { api } = setup();
    await registerUser(api);
    for (const body of [
      { email: 'a@example.com', password: 'wrong-password' },
      { email: 'nobody@example.com', password: 'password123' },
      {},
    ]) {
      assert.equal((await api.post('/api/auth/login').send(body)).status, 401);
    }
  });
});

describe('認証ミドルウェア', () => {
  test('異常: トークンなし/不正形式/改ざん/別秘密鍵/期限切れは401', async () => {
    const { api, } = setup();
    const { token, id } = await registerUser(api);
    const expired = jwt.sign({}, SECRET, { subject: String(id), expiresIn: -10 });
    const otherKey = jwt.sign({}, 'other', { subject: String(id) });
    const cases = [
      {},
      { Authorization: 'Token abc' },
      { Authorization: 'Bearer ' },
      bearer(token + 'x'),
      bearer(otherKey),
      bearer(expired),
    ];
    for (const h of cases) {
      assert.equal((await api.get('/api/logs/today').set(h)).status, 401, JSON.stringify(h));
    }
  });

  test('正常: 有効トークンは通る', async () => {
    const { api } = setup();
    const { token } = await registerUser(api);
    assert.equal((await api.get('/api/logs/today').set(bearer(token))).status, 200);
  });
});
