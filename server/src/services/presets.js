// 基本10項目と、任意追加できるプリセット5項目。
// type: bool | scale3 | scale5 | water | steps | time
export const BASE_ITEMS = [
  { key: 'wake', name: '起床時間', type: 'time', description: '設定した目標時間通りに起きられたか', config: { target: '07:00' } },
  { key: 'sleep', name: '就寝時間・睡眠の質', type: 'scale5', description: '十分な睡眠時間を確保し、すっきり起きられたか' },
  { key: 'breakfast', name: '朝食の摂取', type: 'bool', description: '朝食を食べたか(軽くでも可)' },
  { key: 'lunch', name: '昼食の摂取', type: 'bool', description: '適切な量・時間帯に昼食を摂れたか' },
  { key: 'dinner', name: '夕食の時間と量', type: 'scale3', description: '就寝2〜3時間前までに、適量で済ませられたか' },
  { key: 'water', name: '水分補給', type: 'water', description: '1日を通してこまめに水分(1.5〜2L目安)を摂れたか' },
  { key: 'activity', name: '身体活動(歩数・運動)', type: 'steps', description: '通勤・散歩・運動などで体を動かせたか' },
  { key: 'bath', name: '入浴(湯船につかる)', type: 'bool', description: 'シャワーだけで済ませず、湯船で身体を温めたか' },
  { key: 'screen_off', name: '就寝前スマホ・画面オフ', type: 'bool', description: '寝る30分前までにスマホやPC画面を閉じられたか' },
  { key: 'mood', name: '主観的ストレス・気分', type: 'scale5', description: '1日を通してメンタルや気分が穏やかだったか' },
];

export const PRESET_ITEMS = [
  { key: 'supplement', name: 'サプリ・服薬の実行', type: 'bool', description: '決められた薬や必須サプリを忘れずに飲んだか' },
  { key: 'stretch', name: '姿勢・デスクワークストレッチ', type: 'scale3', description: '長時間座りっぱなしを防ぎ、定期的に体をほぐしたか' },
  { key: 'sunlight', name: '朝の日光浴(朝散歩)', type: 'bool', description: '朝起きて15分以内に太陽の光を浴びられたか' },
  { key: 'caffeine', name: 'カフェインコントロール', type: 'bool', description: '午後(14〜15時以降)のカフェイン摂取を控えられたか' },
  { key: 'snacking', name: '暴飲暴食・間食の抑制', type: 'scale3', description: '無駄なお菓子や夜食、過度な飲酒を控えられたか(3=控えられた)' },
];

// ユーザー独自項目で選べる型
export const CUSTOM_TYPES = ['bool', 'scale3', 'scale5'];
export const MAX_CUSTOM_ITEMS = 20;
