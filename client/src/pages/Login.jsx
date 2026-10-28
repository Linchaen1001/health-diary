import { useState } from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../auth.jsx';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export default function Login() {
  const { user, login, register } = useAuth();
  const [mode, setMode] = useState('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  if (user) return <Navigate to="/record" replace />;

  async function submit(e) {
    e.preventDefault();
    setError('');
    if (!EMAIL_RE.test(email.trim())) return setError('メールアドレスの形式が正しくありません');
    if (mode === 'register' && password.length < 8) return setError('パスワードは8文字以上で入力してください');
    if (!password) return setError('パスワードを入力してください');
    setBusy(true);
    try {
      await (mode === 'login' ? login : register)(email.trim(), password); // 成功すると user が設定され /record へ遷移
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="auth">
      <form className="card" onSubmit={submit} noValidate>
        <h1>健康スコア日記</h1>
        <p className="hint">{mode === 'login' ? 'ログイン' : '新規登録'}</p>
        <label>
          メールアドレス
          <input type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} />
        </label>
        <label>
          パスワード{mode === 'register' ? '(8文字以上)' : ''}
          <input
            type="password"
            autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
        </label>
        {error ? <p className="error" role="alert">{error}</p> : null}
        <button className="btn" type="submit" disabled={busy}>
          {busy ? '送信中…' : mode === 'login' ? 'ログイン' : '登録する'}
        </button>
        <button
          type="button"
          className="btn link"
          onClick={() => {
            setMode(mode === 'login' ? 'register' : 'login');
            setError('');
          }}
        >
          {mode === 'login' ? 'アカウントを作成する' : 'ログインに戻る'}
        </button>
      </form>
    </main>
  );
}
