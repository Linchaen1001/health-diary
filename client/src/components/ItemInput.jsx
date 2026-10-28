const SCALE_LABELS = {
  scale3: ['1 悪い', '2 普通', '3 良い'],
  scale5: ['1 悪い', '2', '3 普通', '4', '5 良い'],
};

// 項目タイプに応じた入力UI。value が undefined のときは未入力。
export default function ItemInput({ item, value, onChange, error }) {
  const id = `item-${item.key}`;
  let control = null;

  if (item.type === 'bool') {
    control = (
      <div role="radiogroup" aria-labelledby={`${id}-label`} className="choices">
        {[[true, 'はい'], [false, 'いいえ']].map(([v, label]) => (
          <label key={label} className={value === v ? 'choice on' : 'choice'}>
            <input type="radio" name={id} checked={value === v} onChange={() => onChange(v)} />
            {label}
          </label>
        ))}
      </div>
    );
  } else if (item.type === 'scale3' || item.type === 'scale5') {
    control = (
      <div role="radiogroup" aria-labelledby={`${id}-label`} className="choices">
        {SCALE_LABELS[item.type].map((label, i) => (
          <label key={label} className={value === i + 1 ? 'choice on' : 'choice'}>
            <input type="radio" name={id} checked={value === i + 1} onChange={() => onChange(i + 1)} />
            {label}
          </label>
        ))}
      </div>
    );
  } else if (item.type === 'water' || item.type === 'steps') {
    const water = item.type === 'water';
    control = (
      <div className="num">
        <input
          id={id}
          type="number"
          inputMode="decimal"
          aria-labelledby={`${id}-label`}
          min={0}
          max={water ? 20 : 100000}
          step={water ? 0.1 : 100}
          value={value ?? ''}
          onChange={(e) => onChange(e.target.value === '' ? undefined : Number(e.target.value))}
        />
        <span>{water ? 'L' : '歩'}</span>
      </div>
    );
  } else if (item.type === 'time') {
    control = (
      <input
        id={id}
        type="time"
        aria-labelledby={`${id}-label`}
        value={value ?? ''}
        onChange={(e) => onChange(e.target.value === '' ? undefined : e.target.value)}
      />
    );
  }

  return (
    <div className={error ? 'field has-error' : 'field'}>
      <div id={`${id}-label`} className="field-label">
        {item.name}
        {item.type === 'time' && item.config?.target ? <small>(目標 {item.config.target})</small> : null}
      </div>
      {item.description ? <p className="hint">{item.description}</p> : null}
      {control}
      {error ? <p className="error" role="alert">{error}</p> : null}
    </div>
  );
}

// クライアント側の入力チェック(サーバーと同じ規則)。エラー文 or null。
export function validateAnswer(type, v) {
  if (v === undefined || v === null || v === '') return '入力してください';
  if (type === 'water' && !(v >= 0 && v <= 20)) return '0〜20L で入力してください';
  if (type === 'steps' && !(v >= 0 && v <= 100000)) return '0〜100000歩で入力してください';
  return null;
}
