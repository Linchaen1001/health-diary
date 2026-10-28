import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../api.js';
import ItemInput, { validateAnswer } from '../components/ItemInput.jsx';

export const FREE_TEXT_MAX = 1000;

export default function Record() {
  const navigate = useNavigate();
  const [items, setItems] = useState(null);
  const [answers, setAnswers] = useState({});
  const [freeText, setFreeText] = useState('');
  const [errors, setErrors] = useState({});
  const [formError, setFormError] = useState('');
  const [busy, setBusy] = useState(false);
  const [loadError, setLoadError] = useState('');

  useEffect(() => {
    let alive = true;
    Promise.all([api.getItems(), api.getToday()])
      .then(([i, t]) => {
        if (!alive) return;
        setItems(i.items.filter((x) => x.enabled));
        if (t.log) {
          setAnswers(t.log.answers);
          setFreeText(t.log.free_text);
        }
      })
      .catch((e) => alive && setLoadError(e.message));
    return () => {
      alive = false;
    };
  }, []);

  async function submit(e) {
    e.preventDefault();
    setFormError('');
    const errs = {};
    for (const it of items) {
      const m = validateAnswer(it.type, answers[it.key]);
      if (m) errs[it.key] = m;
    }
    setErrors(errs);
    if (Object.keys(errs).length) return setFormError('未入力または不正な項目があります');
    if (freeText.length > FREE_TEXT_MAX) return setFormError(`自由記述は${FREE_TEXT_MAX}文字以内で入力してください`);
    setBusy(true);
    try {
      await api.postLog(answers, freeText);
      navigate('/dashboard');
    } catch (err) {
      if (err.fields) setErrors(err.fields);
      setFormError(err.message);
    } finally {
      setBusy(false);
    }
  }

  if (loadError) return <p className="error" role="alert">{loadError}</p>;
  if (!items) return <p>読み込み中…</p>;

  return (
    <form onSubmit={submit} noValidate>
      <h1>今日の記録</h1>
      {items.map((it) => (
        <ItemInput
          key={it.key}
          item={it}
          value={answers[it.key]}
          error={errors[it.key]}
          onChange={(v) => setAnswers((a) => ({ ...a, [it.key]: v }))}
        />
      ))}
      <div className="field">
        <label className="field-label" htmlFor="free-text">自由記述(AIへの補足)</label>
        <textarea
          id="free-text"
          rows={4}
          placeholder="例: 昼食後にだるさがあった"
          value={freeText}
          onChange={(e) => setFreeText(e.target.value)}
        />
        <p className={freeText.length > FREE_TEXT_MAX ? 'error' : 'hint'}>{freeText.length} / {FREE_TEXT_MAX}</p>
      </div>
      {formError ? <p className="error" role="alert">{formError}</p> : null}
      <button className="btn" type="submit" disabled={busy}>
        {busy ? 'AIが採点中…' : '送信してAIフィードバックを受け取る'}
      </button>
    </form>
  );
}
