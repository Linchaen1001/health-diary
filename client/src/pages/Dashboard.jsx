import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api.js';
import ScoreCard from '../components/ScoreCard.jsx';
import TrendChart from '../components/TrendChart.jsx';

export default function Dashboard() {
  const [today, setToday] = useState(undefined);
  const [range, setRange] = useState('week');
  const [trend, setTrend] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    api.getToday().then((r) => setToday(r.log)).catch((e) => setError(e.message));
  }, []);

  useEffect(() => {
    let alive = true;
    setTrend(null);
    api.getHistory(range).then((r) => alive && setTrend(r.trend)).catch((e) => alive && setError(e.message));
    return () => {
      alive = false;
    };
  }, [range]);

  return (
    <>
      <h1>ダッシュボード</h1>
      {error ? <p className="error" role="alert">{error}</p> : null}
      {today === undefined ? (
        <p>読み込み中…</p>
      ) : today === null ? (
        <section className="card">
          <p>今日の記録はまだありません。</p>
          <Link className="btn" to="/record">今日の記録を入力する</Link>
        </section>
      ) : (
        <>
          <ScoreCard score={today.total_score} itemScores={today.item_scores} />
          <section className="card">
            <h2>AIからのフィードバック</h2>
            <p className="feedback">{today.feedback}</p>
            {today.feedback_source === 'fallback' ? (
              <p className="hint">※ AIに接続できなかったため、簡易コメントを表示しています。</p>
            ) : null}
          </section>
        </>
      )}
      <section className="card">
        <div className="row">
          <h2>スコア推移</h2>
          <div className="seg" role="group" aria-label="期間">
            {[['week', '週'], ['month', '月']].map(([v, l]) => (
              <button key={v} className={range === v ? 'on' : ''} aria-pressed={range === v} onClick={() => setRange(v)}>
                {l}
              </button>
            ))}
          </div>
        </div>
        {trend ? <TrendChart trend={trend} /> : <p>読み込み中…</p>}
      </section>
    </>
  );
}
