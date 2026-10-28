// 回答値の検証(Python 側の scoring.py と同じ規則)。不正なら理由の文字列、正常なら null。
const TIME_RE = /^([01]\d|2[0-3]):[0-5]\d$/;
const num = (v) => typeof v === 'number' && Number.isFinite(v);

export function checkValue(type, v) {
  switch (type) {
    case 'bool':
      return typeof v === 'boolean' ? null : 'はい/いいえで入力してください';
    case 'scale3':
      return Number.isInteger(v) && v >= 1 && v <= 3 ? null : '1〜3 の整数で入力してください';
    case 'scale5':
      return Number.isInteger(v) && v >= 1 && v <= 5 ? null : '1〜5 の整数で入力してください';
    case 'water':
      return num(v) && v >= 0 && v <= 20 ? null : '0〜20L の数値で入力してください';
    case 'steps':
      return num(v) && v >= 0 && v <= 100000 ? null : '0〜100000 の数値で入力してください';
    case 'time':
      return typeof v === 'string' && TIME_RE.test(v) ? null : 'HH:MM 形式で入力してください';
    default:
      return '未知の項目タイプです';
  }
}

export const isTime = (s) => typeof s === 'string' && TIME_RE.test(s);
