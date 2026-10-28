import { BASE_ITEMS } from './presets.js';
import { allocateWeights } from './weights.js';

const toItem = (r) => ({
  id: Number(r.id),
  key: r.key,
  name: r.name,
  type: r.type,
  description: r.description,
  is_custom: !!r.is_custom,
  enabled: !!r.enabled,
  sort: r.sort,
  config: JSON.parse(r.config_json),
  weight: 0,
});

// 有効な項目に合計100の重みを按分して返す(無効項目の重みは0)。
export function listItems(db, userId) {
  const items = db
    .prepare('SELECT * FROM items WHERE user_id = ? ORDER BY sort, id')
    .all(userId)
    .map(toItem);
  const enabled = items.filter((i) => i.enabled);
  if (enabled.length) {
    const w = allocateWeights(enabled.length);
    enabled.forEach((it, idx) => (it.weight = w[idx]));
  }
  return items;
}

export function insertItem(db, userId, it, { isCustom, sort }) {
  const r = db
    .prepare(
      `INSERT INTO items (user_id, key, name, type, description, is_custom, enabled, sort, config_json)
       VALUES (?, ?, ?, ?, ?, ?, 1, ?, ?)`,
    )
    .run(userId, it.key, it.name, it.type, it.description ?? '', isCustom ? 1 : 0, sort, JSON.stringify(it.config ?? {}));
  return Number(r.lastInsertRowid);
}

export function seedBaseItems(db, userId) {
  BASE_ITEMS.forEach((it, i) => insertItem(db, userId, it, { isCustom: false, sort: i }));
}

export function nextSort(db, userId) {
  const r = db.prepare('SELECT COALESCE(MAX(sort), -1) + 1 AS n FROM items WHERE user_id = ?').get(userId);
  return r.n;
}
