import { Router } from 'express';
import { insertItem, listItems, nextSort } from '../services/items.js';
import { CUSTOM_TYPES, MAX_CUSTOM_ITEMS, PRESET_ITEMS } from '../services/presets.js';
import { isTime } from '../services/validate.js';

const bad = (res, msg, status = 400) => res.status(status).json({ error: msg });

function cleanName(v) {
  const s = typeof v === 'string' ? v.trim() : '';
  return s.length >= 1 && s.length <= 30 ? s : null;
}
function cleanDesc(v) {
  if (v === undefined) return '';
  return typeof v === 'string' && v.length <= 200 ? v.trim() : null;
}

export function settingsRouter({ db }) {
  const r = Router();

  r.get('/items', (req, res) => {
    res.json({ items: listItems(db, req.user.id), presets: PRESET_ITEMS });
  });

  // action: add_preset | add | update | delete
  r.post('/items', (req, res) => {
    const uid = req.user.id;
    const b = req.body ?? {};
    const customCount = () => db.prepare('SELECT COUNT(*) AS c FROM items WHERE user_id = ? AND is_custom = 1').get(uid).c;
    const find = (id) => (Number.isInteger(id) ? db.prepare('SELECT * FROM items WHERE id = ? AND user_id = ?').get(id, uid) : null);

    switch (b.action) {
      case 'add_preset': {
        const p = PRESET_ITEMS.find((x) => x.key === b.presetKey);
        if (!p) return bad(res, '不明なプリセットです');
        if (db.prepare('SELECT 1 FROM items WHERE user_id = ? AND key = ?').get(uid, p.key)) return bad(res, 'このプリセットは既に追加されています', 409);
        if (customCount() >= MAX_CUSTOM_ITEMS) return bad(res, `追加項目は最大${MAX_CUSTOM_ITEMS}件までです`);
        insertItem(db, uid, p, { isCustom: true, sort: nextSort(db, uid) });
        break;
      }
      case 'add': {
        const name = cleanName(b.name);
        const description = cleanDesc(b.description);
        if (!name) return bad(res, '項目名は1〜30文字で入力してください');
        if (description === null) return bad(res, '説明は200文字以内で入力してください');
        if (!CUSTOM_TYPES.includes(b.type)) return bad(res, `入力形式は ${CUSTOM_TYPES.join('/')} のいずれかです`);
        if (customCount() >= MAX_CUSTOM_ITEMS) return bad(res, `追加項目は最大${MAX_CUSTOM_ITEMS}件までです`);
        const key = `c_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
        insertItem(db, uid, { key, name, type: b.type, description }, { isCustom: true, sort: nextSort(db, uid) });
        break;
      }
      case 'update': {
        const it = find(b.id);
        if (!it) return bad(res, '項目が見つかりません', 404);
        const config = JSON.parse(it.config_json);
        let name = it.name;
        let description = it.description;
        let enabled = it.enabled;
        if (b.name !== undefined) {
          name = cleanName(b.name);
          if (!name) return bad(res, '項目名は1〜30文字で入力してください');
        }
        if (b.description !== undefined) {
          description = cleanDesc(b.description);
          if (description === null) return bad(res, '説明は200文字以内で入力してください');
        }
        if (b.enabled !== undefined) {
          if (typeof b.enabled !== 'boolean') return bad(res, 'enabled は真偽値で指定してください');
          enabled = b.enabled ? 1 : 0;
        }
        if (b.target !== undefined) {
          if (it.type !== 'time' || !isTime(b.target)) return bad(res, '目標時刻は時間項目に HH:MM 形式で指定してください');
          config.target = b.target;
        }
        if (!enabled && it.enabled) {
          const left = db.prepare('SELECT COUNT(*) AS c FROM items WHERE user_id = ? AND enabled = 1 AND id != ?').get(uid, it.id).c;
          if (left < 1) return bad(res, '有効な項目を最低1つ残してください');
        }
        db.prepare('UPDATE items SET name = ?, description = ?, enabled = ?, config_json = ? WHERE id = ?').run(
          name, description, enabled, JSON.stringify(config), it.id,
        );
        break;
      }
      case 'delete': {
        const it = find(b.id);
        if (!it) return bad(res, '項目が見つかりません', 404);
        if (!it.is_custom) return bad(res, '基本項目は削除できません(無効化はできます)');
        if (it.enabled) {
          const left = db.prepare('SELECT COUNT(*) AS c FROM items WHERE user_id = ? AND enabled = 1 AND id != ?').get(uid, it.id).c;
          if (left < 1) return bad(res, '有効な項目を最低1つ残してください');
        }
        db.prepare('DELETE FROM items WHERE id = ?').run(it.id);
        break;
      }
      default:
        return bad(res, 'action が不正です');
    }
    res.json({ items: listItems(db, uid) });
  });

  return r;
}
