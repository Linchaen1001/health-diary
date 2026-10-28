export default function ScoreCard({ score, itemScores = [] }) {
  const tone = score >= 80 ? 'good' : score >= 50 ? 'mid' : 'low';
  return (
    <section className="card">
      <h2>本日の総合スコア</h2>
      <p className={`big-score ${tone}`} data-testid="total-score">
        {score}<span> / 100</span>
      </p>
      <ul className="bars">
        {itemScores.map((s) => (
          <li key={s.key}>
            <span className="bar-name">{s.name}</span>
            <span
              className="bar"
              role="meter"
              aria-label={s.name}
              aria-valuemin={0}
              aria-valuemax={s.weight}
              aria-valuenow={s.score}
            >
              <i style={{ width: `${s.weight ? Math.min(100, (s.score / s.weight) * 100) : 0}%` }} />
            </span>
            <span className="bar-num">{s.score}/{s.weight}</span>
          </li>
        ))}
      </ul>
    </section>
  );
}
