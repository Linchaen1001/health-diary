export class PythonApiError extends Error {
  constructor(message, status) {
    super(message);
    this.status = status; // Python 側の HTTP ステータス(接続失敗時は undefined)
  }
}

// Python(FastAPI) の /internal/evaluate を呼ぶ。テストでは差し替え可能。
export function createPythonClient({ baseUrl, token, timeoutMs = 30000, fetchImpl = fetch }) {
  return {
    async evaluate(payload) {
      let res;
      try {
        res = await fetchImpl(`${baseUrl}/internal/evaluate`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'X-Internal-Token': token },
          body: JSON.stringify(payload),
          signal: AbortSignal.timeout(timeoutMs),
        });
      } catch (e) {
        throw new PythonApiError(`採点サービスに接続できません: ${e.message}`);
      }
      if (!res.ok) {
        let detail = '';
        try {
          const j = await res.json();
          detail = typeof j.detail === 'string' ? j.detail : '';
        } catch { /* ignore */ }
        throw new PythonApiError(detail || `採点サービスがエラーを返しました (${res.status})`, res.status);
      }
      return res.json();
    },
  };
}
