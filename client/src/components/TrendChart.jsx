import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';

export default function TrendChart({ trend }) {
  if (!trend.length) return <p className="hint">まだ記録がありません。</p>;
  const data = trend.map((t) => ({ ...t, label: t.date.slice(5).replace('-', '/') }));
  return (
    <div className="chart" role="img" aria-label="スコア推移グラフ">
      <ResponsiveContainer width="100%" height={240}>
        <LineChart data={data} margin={{ top: 8, right: 16, bottom: 0, left: -16 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
          <XAxis dataKey="label" fontSize={12} />
          <YAxis domain={[0, 100]} fontSize={12} />
          <Tooltip formatter={(v) => [`${v}点`, 'スコア']} />
          <Line type="monotone" dataKey="score" stroke="#2f7d5b" strokeWidth={2.5} dot={{ r: 3 }} />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
