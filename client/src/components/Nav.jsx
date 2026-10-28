import { NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../auth.jsx';

const links = [
  ['/record', '今日の記録'],
  ['/dashboard', 'ダッシュボード'],
  ['/history', '履歴'],
  ['/settings', '項目設定'],
];

export default function Nav() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  return (
    <header className="nav">
      <strong className="brand">健康スコア日記</strong>
      <nav aria-label="メインメニュー">
        {links.map(([to, label]) => (
          <NavLink key={to} to={to} className={({ isActive }) => (isActive ? 'active' : '')}>
            {label}
          </NavLink>
        ))}
      </nav>
      <span className="who">{user?.email}</span>
      <button
        className="btn ghost"
        onClick={() => {
          logout();
          navigate('/login');
        }}
      >
        ログアウト
      </button>
    </header>
  );
}
