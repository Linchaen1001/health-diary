import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ApiError, api, storeSession } from './api.js';
import App from './App.jsx';
import { AuthProvider } from './auth.jsx';
import ItemInput, { validateAnswer } from './components/ItemInput.jsx';
import ScoreCard from './components/ScoreCard.jsx';

vi.mock('./api.js', async (orig) => {
  const actual = await orig();
  return {
    ...actual,
    api: {
      register: vi.fn(), login: vi.fn(), getItems: vi.fn(), saveItem: vi.fn(),
      postLog: vi.fn(), getToday: vi.fn(), getHistory: vi.fn(),
    },
  };
});

const renderAt = (path) =>
  render(
    <MemoryRouter initialEntries={[path]}>
      <AuthProvider><App /></AuthProvider>
    </MemoryRouter>,
  );
const signIn = () => storeSession('tok', { id: 1, email: 'a@example.com' });

const ITEMS = [
  { id: 1, key: 'breakfast', name: '朝食の摂取', type: 'bool', description: '', enabled: true, is_custom: false, weight: 50, config: {} },
  { id: 2, key: 'sleep', name: '睡眠', type: 'scale5', description: '', enabled: true, is_custom: false, weight: 50, config: {} },
];
const LOG = (over = {}) => ({
  date: '2026-10-15', answers: {}, free_text: '', total_score: 85, feedback: '朝食が素晴らしいです',
  feedback_source: 'gemini', item_scores: [{ key: 'breakfast', name: '朝食の摂取', weight: 50, score: 50 }], ...over,
});

beforeEach(() => vi.clearAllMocks());

describe('認証ガード', () => {
  it('未認証で保護ページに行くとログイン画面へ', () => {
    renderAt('/dashboard');
    expect(screen.getByRole('button', { name: 'ログイン' })).toBeInTheDocument();
  });

  it('認証済みならダッシュボードが見える', async () => {
    signIn();
    api.getToday.mockResolvedValue({ log: LOG() });
    api.getHistory.mockResolvedValue({ trend: [], logs: [] });
    renderAt('/dashboard');
    expect(await screen.findByText('朝食が素晴らしいです')).toBeInTheDocument();
  });
});

describe('ログイン/登録画面', () => {
  it('異常: 不正メール・空パスワード・短い登録パスワードでAPIを呼ばない', async () => {
    const u = userEvent.setup();
    renderAt('/login');
    await u.click(screen.getByRole('button', { name: 'ログイン' }));
    expect(screen.getByRole('alert')).toHaveTextContent('メールアドレスの形式');
    await u.type(screen.getByLabelText('メールアドレス'), 'a@example.com');
    await u.click(screen.getByRole('button', { name: 'ログイン' }));
    expect(screen.getByRole('alert')).toHaveTextContent('パスワードを入力');
    await u.click(screen.getByRole('button', { name: 'アカウントを作成する' }));
    await u.type(screen.getByLabelText(/パスワード/), '1234567');
    await u.click(screen.getByRole('button', { name: '登録する' }));
    expect(screen.getByRole('alert')).toHaveTextContent('8文字以上');
    expect(api.login).not.toHaveBeenCalled();
    expect(api.register).not.toHaveBeenCalled();
  });

  it('異常: サーバーのエラーメッセージを表示', async () => {
    const u = userEvent.setup();
    api.login.mockRejectedValue(new ApiError('メールアドレスまたはパスワードが違います', 401));
    renderAt('/login');
    await u.type(screen.getByLabelText('メールアドレス'), 'a@example.com');
    await u.type(screen.getByLabelText('パスワード'), 'wrongpass');
    await u.click(screen.getByRole('button', { name: 'ログイン' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('違います');
  });

  it('境界: パスワード8文字で登録APIが呼ばれ記録画面へ遷移', async () => {
    const u = userEvent.setup();
    api.register.mockResolvedValue({ token: 't', user: { id: 1, email: 'a@example.com' } });
    api.getItems.mockResolvedValue({ items: ITEMS, presets: [] });
    api.getToday.mockResolvedValue({ log: null });
    renderAt('/login');
    await u.click(screen.getByRole('button', { name: 'アカウントを作成する' }));
    await u.type(screen.getByLabelText('メールアドレス'), 'a@example.com');
    await u.type(screen.getByLabelText(/パスワード/), '12345678');
    await u.click(screen.getByRole('button', { name: '登録する' }));
    expect(api.register).toHaveBeenCalledWith('a@example.com', '12345678');
    expect(await screen.findByRole('heading', { name: '今日の記録' })).toBeInTheDocument();
  });

  it('正常: ログイン成功', async () => {
    const u = userEvent.setup();
    api.login.mockResolvedValue({ token: 't', user: { id: 1, email: 'a@example.com' } });
    api.getItems.mockResolvedValue({ items: ITEMS, presets: [] });
    api.getToday.mockResolvedValue({ log: null });
    renderAt('/login');
    await u.type(screen.getByLabelText('メールアドレス'), 'a@example.com');
    await u.type(screen.getByLabelText('パスワード'), 'password123');
    await u.click(screen.getByRole('button', { name: 'ログイン' }));
    await waitFor(() => expect(api.login).toHaveBeenCalledWith('a@example.com', 'password123'));
    expect(await screen.findByRole('heading', { name: '今日の記録' })).toBeInTheDocument();
  });
});

describe('今日の記録画面', () => {
  beforeEach(() => {
    signIn();
    api.getItems.mockResolvedValue({ items: ITEMS, presets: [] });
    api.getToday.mockResolvedValue({ log: null });
  });

  it('異常: 未入力のまま送信するとエラーでAPIを呼ばない', async () => {
    const u = userEvent.setup();
    renderAt('/record');
    await u.click(await screen.findByRole('button', { name: /送信/ }));
    expect(screen.getAllByText('入力してください')).toHaveLength(2);
    expect(api.postLog).not.toHaveBeenCalled();
  });

  it('正常: 入力して送信すると回答と自由記述が送られダッシュボードへ', async () => {
    const u = userEvent.setup();
    api.postLog.mockResolvedValue({ log: LOG() });
    api.getHistory.mockResolvedValue({ trend: [], logs: [] });
    api.getToday.mockResolvedValueOnce({ log: null }).mockResolvedValue({ log: LOG() });
    renderAt('/record');
    await screen.findByText('朝食の摂取');
    await u.click(screen.getByLabelText('はい'));
    await u.click(screen.getByLabelText('4'));
    await u.type(screen.getByLabelText(/自由記述/), 'だるい');
    await u.click(screen.getByRole('button', { name: /送信/ }));
    expect(api.postLog).toHaveBeenCalledWith({ breakfast: true, sleep: 4 }, 'だるい');
    expect(await screen.findByText('本日の総合スコア')).toBeInTheDocument();
  });

  it('異常: サーバーエラーを表示し、画面に留まる', async () => {
    const u = userEvent.setup();
    api.postLog.mockRejectedValue(new ApiError('AI採点サービスに接続できませんでした', 502));
    renderAt('/record');
    await screen.findByText('朝食の摂取');
    await u.click(screen.getByLabelText('いいえ'));
    await u.click(screen.getByLabelText(/^1/));
    await u.click(screen.getByRole('button', { name: /送信/ }));
    expect(await screen.findByText(/接続できませんでした/)).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: '今日の記録' })).toBeInTheDocument();
  });

  it('境界: 「いいえ(false)」「1」も有効な回答として送れる', async () => {
    const u = userEvent.setup();
    api.postLog.mockResolvedValue({ log: LOG() });
    api.getHistory.mockResolvedValue({ trend: [], logs: [] });
    renderAt('/record');
    await screen.findByText('朝食の摂取');
    await u.click(screen.getByLabelText('いいえ'));
    await u.click(screen.getByLabelText('1', { exact: false }));
    await u.click(screen.getByRole('button', { name: /送信/ }));
    expect(api.postLog).toHaveBeenCalledWith({ breakfast: false, sleep: 1 }, '');
  });

  it('境界: 自由記述 1001文字は送信不可', async () => {
    const u = userEvent.setup();
    renderAt('/record');
    await screen.findByText('朝食の摂取');
    await u.click(screen.getByLabelText('はい'));
    await u.click(screen.getByLabelText('5', { exact: false }));
    const ta = screen.getByLabelText(/自由記述/);
    await u.click(ta);
    await u.paste('あ'.repeat(1001));
    await u.click(screen.getByRole('button', { name: /送信/ }));
    expect(screen.getByRole('alert')).toHaveTextContent('1000文字以内');
    expect(api.postLog).not.toHaveBeenCalled();
  });

  it('正常: 今日の記録済みなら入力が復元される', async () => {
    api.getToday.mockResolvedValue({ log: LOG({ answers: { breakfast: true, sleep: 4 }, free_text: 'メモ' }) });
    renderAt('/record');
    expect(await screen.findByDisplayValue('メモ')).toBeInTheDocument();
    expect(screen.getByLabelText('はい')).toBeChecked();
  });

  it('異常: 読み込み失敗でエラー表示', async () => {
    api.getItems.mockRejectedValue(new ApiError('サーバーに接続できません', 0));
    renderAt('/record');
    expect(await screen.findByRole('alert')).toHaveTextContent('接続できません');
  });
});

describe('ダッシュボード', () => {
  beforeEach(() => {
    signIn();
    api.getHistory.mockResolvedValue({ trend: [{ date: '2026-10-15', score: 85 }], logs: [] });
  });

  it('正常: スコア・項目別・フィードバックを表示', async () => {
    api.getToday.mockResolvedValue({ log: LOG() });
    renderAt('/dashboard');
    expect(await screen.findByTestId('total-score')).toHaveTextContent('85');
    expect(screen.getByRole('meter', { name: '朝食の摂取' })).toHaveAttribute('aria-valuenow', '50');
    expect(screen.getByText('朝食が素晴らしいです')).toBeInTheDocument();
  });

  it('正常: 未記録なら入力への導線', async () => {
    api.getToday.mockResolvedValue({ log: null });
    renderAt('/dashboard');
    expect(await screen.findByRole('link', { name: '今日の記録を入力する' })).toBeInTheDocument();
  });

  it('正常: フォールバック時は注記を表示', async () => {
    api.getToday.mockResolvedValue({ log: LOG({ feedback_source: 'fallback' }) });
    renderAt('/dashboard');
    expect(await screen.findByText(/簡易コメント/)).toBeInTheDocument();
  });

  it('正常: 週/月の切替で履歴APIの range が変わる', async () => {
    const u = userEvent.setup();
    api.getToday.mockResolvedValue({ log: null });
    renderAt('/dashboard');
    await screen.findByRole('button', { name: '週' });
    expect(api.getHistory).toHaveBeenCalledWith('week');
    await u.click(screen.getByRole('button', { name: '月' }));
    expect(api.getHistory).toHaveBeenCalledWith('month');
  });

  it('正常: 履歴が空なら空メッセージ', async () => {
    api.getToday.mockResolvedValue({ log: null });
    api.getHistory.mockResolvedValue({ trend: [], logs: [] });
    renderAt('/dashboard');
    expect(await screen.findByText('まだ記録がありません。')).toBeInTheDocument();
  });
});

describe('ScoreCard 境界値', () => {
  it.each([[0, 'low'], [49, 'low'], [50, 'mid'], [79, 'mid'], [80, 'good'], [100, 'good']])('score=%i は %s', (s, tone) => {
    render(<ScoreCard score={s} />);
    expect(screen.getByTestId('total-score')).toHaveTextContent(String(s));
    expect(screen.getByTestId('total-score')).toHaveClass(tone);
  });

  it('配点0の項目でもバーが壊れない', () => {
    render(<ScoreCard score={0} itemScores={[{ key: 'a', name: 'A', weight: 0, score: 0 }]} />);
    expect(screen.getByRole('meter', { name: 'A' })).toBeInTheDocument();
  });
});

describe('validateAnswer', () => {
  it.each([
    ['bool', undefined, '入力してください'], ['bool', false, null], ['bool', true, null],
    ['scale5', 1, null], ['water', 0, null], ['water', 20, null], ['water', 20.1, '0〜20L'], ['water', -1, '0〜20L'],
    ['steps', 0, null], ['steps', 100000, null], ['steps', 100001, '0〜100000'], ['time', '', '入力してください'], ['time', '07:00', null],
  ])('%s %s', (t, v, expected) => {
    const r = validateAnswer(t, v);
    expected === null ? expect(r).toBeNull() : expect(r).toContain(expected);
  });
});

describe('ItemInput', () => {
  it('数値入力: 空欄は undefined、数値は Number で通知', async () => {
    const u = userEvent.setup();
    const onChange = vi.fn();
    render(<ItemInput item={{ key: 'water', name: '水分', type: 'water', config: {} }} value={1} onChange={onChange} />);
    const input = screen.getByLabelText('水分');
    await u.clear(input);
    expect(onChange).toHaveBeenLastCalledWith(undefined);
    await u.type(input, '2');
    expect(onChange).toHaveBeenLastCalledWith(12);
  });

  it('時間項目は目標時刻を表示', () => {
    render(<ItemInput item={{ key: 'wake', name: '起床', type: 'time', config: { target: '06:30' } }} onChange={() => {}} />);
    expect(screen.getByText('(目標 06:30)')).toBeInTheDocument();
  });

  it('エラー表示', () => {
    render(<ItemInput item={{ key: 'a', name: 'A', type: 'bool', config: {} }} error="入力してください" onChange={() => {}} />);
    expect(screen.getByRole('alert')).toHaveTextContent('入力してください');
  });
});

describe('履歴・設定画面', () => {
  beforeEach(signIn);

  it('履歴: 一覧と空状態', async () => {
    api.getHistory.mockResolvedValue({ logs: [LOG()], trend: [] });
    renderAt('/history');
    expect(await screen.findByText('2026-10-15')).toBeInTheDocument();
    expect(screen.getByText('85点')).toBeInTheDocument();
  });

  it('履歴: 記録なし', async () => {
    api.getHistory.mockResolvedValue({ logs: [], trend: [] });
    renderAt('/history');
    expect(await screen.findByText('まだ記録がありません。')).toBeInTheDocument();
  });

  it('設定: プリセット追加で saveItem が呼ばれ、追加済みは無効化', async () => {
    const u = userEvent.setup();
    const presets = [{ key: 'caffeine', name: 'カフェインコントロール', type: 'bool', description: 'd' }];
    api.getItems.mockResolvedValue({ items: ITEMS, presets });
    api.saveItem.mockResolvedValue({ items: [...ITEMS, { id: 3, key: 'caffeine', name: 'カフェインコントロール', type: 'bool', description: '', enabled: true, is_custom: true, weight: 33, config: {} }] });
    renderAt('/settings');
    const row = (await screen.findByText('カフェインコントロール')).closest('li');
    await u.click(within(row).getByRole('button', { name: '追加' }));
    expect(api.saveItem).toHaveBeenCalledWith({ action: 'add_preset', presetKey: 'caffeine' });
    expect(await screen.findByRole('button', { name: '追加済み' })).toBeDisabled();
  });

  it('設定: 独自項目は名前が空だと追加できない、入力すれば送信', async () => {
    const u = userEvent.setup();
    api.getItems.mockResolvedValue({ items: ITEMS, presets: [] });
    api.saveItem.mockResolvedValue({ items: ITEMS });
    renderAt('/settings');
    await u.click(await screen.findByRole('button', { name: '追加' }));
    expect(screen.getByRole('alert')).toHaveTextContent('項目名を入力');
    expect(api.saveItem).not.toHaveBeenCalled();
    await u.type(screen.getByLabelText('項目名'), '運動を30分したか');
    await u.click(screen.getByRole('button', { name: '追加' }));
    expect(api.saveItem).toHaveBeenCalledWith({ action: 'add', name: '運動を30分したか', type: 'bool', description: '' });
  });

  it('設定: サーバーエラー(上限超過など)を表示', async () => {
    const u = userEvent.setup();
    api.getItems.mockResolvedValue({ items: ITEMS, presets: [] });
    api.saveItem.mockRejectedValue(new ApiError('追加項目は最大20件までです', 400));
    renderAt('/settings');
    await screen.findByText('採点項目の設定');
    await u.type(screen.getByLabelText('項目名'), 'x');
    await u.click(screen.getByRole('button', { name: '追加' }));
    expect(await screen.findByText(/最大20件/)).toBeInTheDocument();
  });

  it('設定: 重みが表示され、無効化の操作が送られる', async () => {
    const u = userEvent.setup();
    api.getItems.mockResolvedValue({ items: ITEMS, presets: [] });
    api.saveItem.mockResolvedValue({ items: ITEMS });
    renderAt('/settings');
    expect((await screen.findAllByText('50点')).length).toBe(2);
    await u.click(screen.getAllByRole('button', { name: '無効にする' })[0]);
    expect(api.saveItem).toHaveBeenCalledWith({ action: 'update', id: 1, enabled: false });
  });
});
