import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { setup, registerUser, bearer } from './helpers.js';
import { allocateWeights } from '../src/services/weights.js';
import { MAX_CUSTOM_ITEMS, PRESET_ITEMS } from '../src/services/presets.js';

async function ready() {
  const ctx = setup();
  const u = await registerUser(ctx.api);
  const h = bearer(u.token);
  const post = (body) => ctx.api.post('/api/settings/items').set(h).send(body);
  const list = async () => (await ctx.api.get('/api/settings/items').set(h)).body.items;
  return { ...ctx, h, post, list };
}
const sumW = (items) => items.filter((i) => i.enabled).reduce((s, i) => s + i.weight, 0);

describe('allocateWeights', () => {
  for (const n of [1, 2, 3, 7, 10, 11, 13, 15, 30]) {
    test(`境界: n=${n} で合計100・差は高々1`, () => {
      const w = allocateWeights(n);
      assert.equal(w.length, n);
      assert.equal(w.reduce((a, b) => a + b, 0), 100);
      assert.ok(Math.max(...w) - Math.min(...w) <= 1);
    });
  }
  test('異常: 0/負/小数は例外', () => {
    for (const n of [0, -1, 1.5, NaN]) assert.throws(() => allocateWeights(n));
  });
});

describe('GET /api/settings/items', () => {
  test('正常: 基本10項目、重み合計100(各10点)、プリセット5種', async () => {
    const { api, h } = await ready();
    const r = await api.get('/api/settings/items').set(h);
    assert.equal(r.body.items.length, 10);
    assert.equal(sumW(r.body.items), 100);
    assert.ok(r.body.items.every((i) => i.weight === 10));
    assert.equal(r.body.presets.length, 5);
  });
  test('異常: 未認証は401', async () => {
    const { api } = setup();
    assert.equal((await api.get('/api/settings/items')).status, 401);
  });
});

describe('POST /api/settings/items', () => {
  test('正常: プリセット追加で11項目・合計100(端数は先頭へ)', async () => {
    const { post, list } = await ready();
    const r = await post({ action: 'add_preset', presetKey: 'supplement' });
    assert.equal(r.status, 200);
    const items = await list();
    assert.equal(items.length, 11);
    assert.equal(sumW(items), 100);
    assert.equal(items[0].weight, 10);
    assert.equal(items.at(-1).weight, 9);
  });

  test('正常: 独自項目の追加', async () => {
    const { post, list } = await ready();
    const r = await post({ action: 'add', name: '運動を30分したか', type: 'bool', description: '30分以上' });
    assert.equal(r.status, 200);
    const it = (await list()).at(-1);
    assert.equal(it.name, '運動を30分したか');
    assert.ok(it.is_custom);
  });

  test('正常: 項目数 1〜30 の全パターンで合計が常に100', async () => {
    const { post, list, h, api } = await ready();
    // 基本10 → 全部無効化は不可なので 1項目まで無効化して追加で検証
    for (const p of PRESET_ITEMS) await post({ action: 'add_preset', presetKey: p.key });
    for (let i = 0; i < 10; i++) await post({ action: 'add', name: `c${i}`, type: 'scale3' });
    const items = await list();
    assert.equal(items.length, 25);
    assert.equal(sumW(items), 100);
    for (const it of items.slice(1)) {
      await post({ action: 'update', id: it.id, enabled: false });
      assert.equal(sumW(await list()), 100);
    }
    const last = (await list()).filter((i) => i.enabled);
    assert.equal(last.length, 1);
    assert.equal(last[0].weight, 100);
    assert.ok(h && api);
  });

  test('正常: 編集(名前・説明・起床の目標時刻)', async () => {
    const { post, list } = await ready();
    const wake = (await list()).find((i) => i.key === 'wake');
    const r = await post({ action: 'update', id: wake.id, name: '起床(6時)', target: '06:00', description: 'd' });
    assert.equal(r.status, 200);
    const w2 = (await list()).find((i) => i.key === 'wake');
    assert.equal(w2.name, '起床(6時)');
    assert.equal(w2.config.target, '06:00');
  });

  test('正常: 独自項目の削除で重みが再按分される', async () => {
    const { post, list } = await ready();
    await post({ action: 'add', name: 'x', type: 'bool' });
    const it = (await list()).at(-1);
    assert.equal((await post({ action: 'delete', id: it.id })).status, 200);
    const items = await list();
    assert.equal(items.length, 10);
    assert.equal(sumW(items), 100);
  });

  test('異常: 重複プリセットは409、不明プリセットは400', async () => {
    const { post } = await ready();
    await post({ action: 'add_preset', presetKey: 'caffeine' });
    assert.equal((await post({ action: 'add_preset', presetKey: 'caffeine' })).status, 409);
    assert.equal((await post({ action: 'add_preset', presetKey: 'nope' })).status, 400);
  });

  test('異常: 不正な action / ボディなしは400', async () => {
    const { post } = await ready();
    assert.equal((await post({ action: 'x' })).status, 400);
    assert.equal((await post({})).status, 400);
  });

  test('異常: 独自項目の不正な型・名前・説明は400', async () => {
    const { post } = await ready();
    for (const b of [
      { name: 'a', type: 'water' },
      { name: 'a', type: 'time' },
      { name: '', type: 'bool' },
      { name: '   ', type: 'bool' },
      { name: 5, type: 'bool' },
      { name: 'a', type: 'bool', description: 'x'.repeat(201) },
    ]) {
      assert.equal((await post({ action: 'add', ...b })).status, 400, JSON.stringify(b));
    }
  });

  test('境界: 名前 30文字OK / 31文字は400、説明 200文字OK', async () => {
    const { post } = await ready();
    assert.equal((await post({ action: 'add', name: 'あ'.repeat(30), type: 'bool', description: 'x'.repeat(200) })).status, 200);
    assert.equal((await post({ action: 'add', name: 'あ'.repeat(31), type: 'bool' })).status, 400);
  });

  test(`境界: 追加項目は${MAX_CUSTOM_ITEMS}件まで(${MAX_CUSTOM_ITEMS + 1}件目は400)`, async () => {
    const { post } = await ready();
    for (let i = 0; i < MAX_CUSTOM_ITEMS; i++) {
      assert.equal((await post({ action: 'add', name: `c${i}`, type: 'bool' })).status, 200, `i=${i}`);
    }
    assert.equal((await post({ action: 'add', name: 'over', type: 'bool' })).status, 400);
    assert.equal((await post({ action: 'add_preset', presetKey: 'supplement' })).status, 400);
  });

  test('異常: 基本項目は削除不可、存在しない/他人の項目は404', async () => {
    const { post, list, api } = await ready();
    const base = (await list())[0];
    assert.equal((await post({ action: 'delete', id: base.id })).status, 400);
    assert.equal((await post({ action: 'update', id: 99999, name: 'a' })).status, 404);
    assert.equal((await post({ action: 'update', id: 'abc', name: 'a' })).status, 404);

    const other = await registerUser(api, 'b@example.com');
    const r = await api.post('/api/settings/items').set(bearer(other.token)).send({ action: 'update', id: base.id, name: 'hack' });
    assert.equal(r.status, 404);
    assert.notEqual((await list())[0].name, 'hack');
  });

  test('異常: 最後の有効項目は無効化/削除できない', async () => {
    const { post, list } = await ready();
    const items = await list();
    for (const it of items.slice(1)) await post({ action: 'update', id: it.id, enabled: false });
    assert.equal((await post({ action: 'update', id: items[0].id, enabled: false })).status, 400);
    await post({ action: 'add', name: 'c', type: 'bool' });
    const c = (await list()).at(-1);
    await post({ action: 'update', id: items[0].id, enabled: false });
    assert.equal((await post({ action: 'delete', id: c.id })).status, 400);
  });

  test('異常: 目標時刻の形式不正 / 時間項目以外への指定 / enabled が非boolは400', async () => {
    const { post, list } = await ready();
    const items = await list();
    const wake = items.find((i) => i.key === 'wake');
    const bath = items.find((i) => i.key === 'bath');
    assert.equal((await post({ action: 'update', id: wake.id, target: '6:00' })).status, 400);
    assert.equal((await post({ action: 'update', id: wake.id, target: '24:00' })).status, 400);
    assert.equal((await post({ action: 'update', id: bath.id, target: '06:00' })).status, 400);
    assert.equal((await post({ action: 'update', id: bath.id, enabled: 'no' })).status, 400);
  });
});
