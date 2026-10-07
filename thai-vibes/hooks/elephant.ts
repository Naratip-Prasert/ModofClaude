// The elephant's sprites and moods, and the streak of days. Pure functions, no engine calls.
// String.raw keeps every backslash literal.

export type Mood = 'happy' | 'spray' | 'sleepy'

const EARS_OUT = [
  String.raw` .--.     .--. `,
  String.raw`(    \___/    )`,
]
const EARS_IN = [
  String.raw`   .-.   .-.   `,
  String.raw`  ( (\___/) )  `,
]
const FACE: Record<Mood, string> = {
  happy: String.raw` '-( ●  ‿  ● )-' `,
  spray: String.raw` '-( ^  ▽  ^ )-' `,
  sleepy: String.raw` '-( -  ‿  - )-' `,
}
const BODY = [String.raw`    |  \_/  |~  `, String.raw`    ^^     ^^   `]

// two ear poses alternate each frame; asleep the ears rest
export function elephant(mood: Mood, frame: number): { lines: string[]; extra: string } {
  const ears = mood === 'sleepy' || frame % 2 === 0 ? EARS_IN : EARS_OUT
  const extra =
    mood === 'spray' ? ['💦', '💦 💦', ' 💦💦💦'][frame % 3] ?? '' : mood === 'sleepy' ? ['z', 'zZ', 'zZz'][frame % 3] ?? '' : ''
  return { lines: [...ears, FACE[mood], ...BODY], extra }
}

export const MOOD_TEXT: Record<Mood, string> = {
  happy: 'ช้างน้อยกระพือหูรออยู่',
  spray: 'งานเสร็จ! ช้างพ่นน้ำฉลอง',
  sleepy: 'ช้างน้อยง่วงแล้ว…',
}

// --- streak: days written as local YYYY-MM-DD

const pad = (n: number) => String(n).padStart(2, '0')
export const dayKey = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`

function prevDay(key: string): string {
  const [y = 0, m = 1, d = 1] = key.split('-').map(Number)
  return dayKey(new Date(y, m - 1, d - 1))
}

// consecutive days ending today, or ending yesterday when today has no entry yet
export function streakOf(days: string[], today: string): number {
  const set = new Set(days)
  let cur = set.has(today) ? today : prevDay(today)
  let n = 0
  while (set.has(cur)) {
    n++
    cur = prevDay(cur)
  }
  return n
}

// the last 60 days are enough to count any streak worth showing, and keep the store small
export const keepRecent = (days: string[]) => [...new Set(days)].sort().slice(-60)
