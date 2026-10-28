import { useEffect, useState } from 'react';
import { api } from '../api.js';

const TYPE_LABELS = { bool: 'はい/いいえ', scale3: '3段階', scale5: '5段階', water: '水分(L)', steps: '歩数', time: '時刻' };

function ItemRow({ item, onSave, onDelete }) {
  const [name, setName] = useState(item.name);
  const [target, setTarget] = useState(item.config?.target ?? '');
  const dirty = name !== item.name || (item.type === 'time' && target !== (item.config?.target ?? ''));
  return (
    <li className={item.enabled ? 'item' : 'item off'}>
      <input aria-label={`${item.name}の名前`} value={name} maxLength={30} onChange={(e) => setName(e.target.value)} />
      <small>{TYPE_LABELS[item.type]}</small>
      {item.type === 'time' ? (
        <input type="time" aria-label="目標時刻" value={target} onChange={(e) => setTarget(e.target.value)} />
      ) : null}
      <span className="weight">{item.enabled ? `${item.weight}点` : '—'}</span>
      <button className="btn small" disabled={!dirty} onClick={() => onSave({ action: 'update', id: item.id, name, ...(item.type === 'time' ? { target } : {}) })}>
        保存
      </button>
      <button className="btn small ghost" onClick={() => onSave({ action: 'update', id: item.id, enabled: !item.enabled })}>
        {item.enabled ? '無効にする' : '有効にする'}
      </button>
      {item.is_custom ? (
        <button className="btn small danger" onClick={() => onDelete(item)}>削除</button>
      ) : null}
    </li>
  );
}

export default function Settings() {
  const [items, setItems] = useState(null);
  const [presets, setPresets] = useState([]);
  const [error, setError] = useState('');
  const [form, setForm] = useState({ name: '', type: 'bool', description: '' });

  useEffect(() => {
    api.getItems().then((r) => {
      setItems(r.items);
      setPresets(r.presets);
    }).catch((e) => setError(e.message));
  }, []);

  async function act(body) {
    setError('');
    try {
      const r = await api.saveItem(body);
      setItems(r.items);
      return true;
    } catch (e) {
      setError(e.message);
      return false;
    }
  }

  async function addCustom(e) {
    e.preventDefault();
    if (!form.name.trim()) return setError('項目名を入力してください');
    if (await act({ action: 'add', ...form })) setForm({ name: '', type: 'bool', description: '' });
  }

  if (!items) return error ? <p className="error" role="alert">{error}</p> : <p>読み込み中…</p>;
  const have = new Set(items.map((i) => i.key));

  return (
    <>
      <h1>採点項目の設定</h1>
      <p className="hint">有効な項目の配点は合計100点になるよう自動で按分されます。</p>
      {error ? <p className="error" role="alert">{error}</p> : null}
      <ul className="plain items">
        {items.map((it) => (
          <ItemRow
            key={`${it.id}-${it.name}-${it.config?.target ?? ''}`}
            item={it}
            onSave={act}
            onDelete={(x) => window.confirm(`「${x.name}」を削除しますか?`) && act({ action: 'delete', id: x.id })}
          />
        ))}
      </ul>

      <section className="card">
        <h2>おすすめ項目を追加</h2>
        <ul className="plain">
          {presets.map((p) => (
            <li key={p.key} className="preset">
              <div>
                <strong>{p.name}</strong>
                <p className="hint">{p.description}</p>
              </div>
              <button className="btn small" disabled={have.has(p.key)} onClick={() => act({ action: 'add_preset', presetKey: p.key })}>
                {have.has(p.key) ? '追加済み' : '追加'}
              </button>
            </li>
          ))}
        </ul>
      </section>

      <form className="card" onSubmit={addCustom}>
        <h2>オリジナル項目を追加</h2>
        <label>
          項目名
          <input value={form.name} maxLength={30} placeholder="例: 運動を30分したか" onChange={(e) => setForm({ ...form, name: e.target.value })} />
        </label>
        <label>
          入力形式
          <select value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value })}>
            <option value="bool">はい/いいえ</option>
            <option value="scale3">3段階</option>
            <option value="scale5">5段階</option>
          </select>
        </label>
        <label>
          説明(任意)
          <input value={form.description} maxLength={200} onChange={(e) => setForm({ ...form, description: e.target.value })} />
        </label>
        <button className="btn" type="submit">追加</button>
      </form>
    </>
  );
}
