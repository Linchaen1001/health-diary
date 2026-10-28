import { useEffect, useState } from 'react';
import { api } from '../api.js';

export default function History() {
  const [logs, setLogs] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    api.getHistory('all').then((r) => setLogs(r.logs)).catch((e) => setError(e.message));
  }, []);

  if (error) return <p className="error" role="alert">{error}</p>;
  if (!logs) return <p>読み込み中…</p>;

  return (
    <>
      <h1>履歴</h1>
      {logs.length === 0 ? <p>まだ記録がありません。</p> : null}
      {logs.map((l) => (
        <details key={l.date} className="card">
          <summary>
            <span>{l.date}</span>
            <strong>{l.total_score}点</strong>
          </summary>
          <h3>AIアドバイス</h3>
          <p className="feedback">{l.feedback}</p>
          {l.free_text ? (
            <>
              <h3>自由記述</h3>
              <p>{l.free_text}</p>
            </>
          ) : null}
          <h3>項目別</h3>
          <ul className="plain">
            {l.item_scores.map((s) => (
              <li key={s.key}>{s.name}: {s.score}/{s.weight}</li>
            ))}
          </ul>
        </details>
      ))}
    </>
  );
}
