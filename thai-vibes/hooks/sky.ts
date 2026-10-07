// The moon and the festivals, computed on this machine. Pure functions, no engine calls.

const SYNODIC = 29.530588853 // days from new moon to new moon
const NEW_MOON = Date.UTC(2000, 0, 6, 18, 14) // a known new moon
const DAY = 86_400_000

// days since the last new moon, 0 to 29.5
export function moonAge(t: number): number {
  const age = ((t - NEW_MOON) / DAY) % SYNODIC
  return age < 0 ? age + SYNODIC : age
}

const PHASES = ['🌑', '🌒', '🌓', '🌔', '🌕', '🌖', '🌗', '🌘']

export type Moon = { icon: string; lunar: string; isHolyDay: boolean }

// Thai lunar day from the moon's age: waxing (ขึ้น) 1–15, waning (แรม) 1–15. An approximation:
// the Thai calendar fixes its months by rule, so this can be a day off; วันพระ is ≈ for that reason.
export function moon(t: number): Moon {
  const age = moonAge(t)
  const icon = PHASES[Math.round((age / SYNODIC) * 8) % 8] ?? '🌑'
  // rounded, so the night of the full moon (age ≈ 14.8) reads ขึ้น 15 and the new moon แรม 15
  const day = Math.round(age)
  const isWaxing = day >= 1 && day <= 15
  const n = isWaxing ? day : day === 0 ? 15 : Math.min(15, day - 15)
  // a short month ends on แรม 14, so both 14 and 15 may be the waning วันพระ
  return { icon, lunar: `${isWaxing ? 'ขึ้น' : 'แรม'} ${n} ค่ำ`, isHolyDay: n === 8 || n === 15 || (!isWaxing && n === 14) }
}

export type Festival = { key: string; name: string; icons: string; colors: string[]; greet: string }

export const FESTIVALS: Record<string, Festival> = {
  newyear: { key: 'newyear', name: 'ปีใหม่', icons: '🎆🎉', colors: ['yellow', 'magenta', 'cyan', 'yellow', 'magenta', 'cyan'], greet: 'สวัสดีปีใหม่! ขอให้ build เขียวทั้งปี' },
  chinese: { key: 'chinese', name: 'ตรุษจีน', icons: '🧧🐉', colors: ['red', 'yellow', 'red', 'yellow', 'red', 'yellow'], greet: 'ซินเจียยู่อี่ ซินนี้ฮวดไช้ โค้ดไม่มีบั๊ก' },
  valentine: { key: 'valentine', name: 'วาเลนไทน์', icons: '💝🌹', colors: ['red', 'magenta', 'white', 'red', 'magenta', 'white'], greet: 'รักโค้ดตัวเองด้วยนะ ❤️' },
  songkran: { key: 'songkran', name: 'สงกรานต์', icons: '💦🔫', colors: ['cyan', 'blue', 'cyan', 'white', 'blue', 'cyan'], greet: 'สุขสันต์วันสงกรานต์! สาดน้ำใส่บั๊กให้หมด' },
  mother: { key: 'mother', name: 'วันแม่', icons: '💙🌼', colors: ['blue', 'cyan', 'blue', 'white', 'blue', 'cyan'], greet: 'วันแม่ โทรหาแม่หน่อยนะ 💙' },
  halloween: { key: 'halloween', name: 'ฮาโลวีน', icons: '🎃👻', colors: ['yellow', 'magenta', 'yellow', 'gray', 'yellow', 'magenta'], greet: 'บั๊กหลอนหรือขนม? 🎃' },
  loykrathong: { key: 'loykrathong', name: 'ลอยกระทง', icons: '🪷🕯️', colors: ['yellow', 'cyan', 'blue', 'yellow', 'cyan', 'blue'], greet: 'ลอยกระทง ลอยบั๊กไปกับสายน้ำ 🪷' },
  father: { key: 'father', name: 'วันพ่อ', icons: '💛🌻', colors: ['yellow', 'white', 'yellow', 'yellow', 'white', 'yellow'], greet: 'วันพ่อ ขอบคุณพ่อนะ 💛' },
  christmas: { key: 'christmas', name: 'คริสต์มาส', icons: '🎄🎁', colors: ['red', 'green', 'white', 'red', 'green', 'white'], greet: 'Merry Christmas! ขอให้ deploy ราบรื่น 🎄' },
}

// the festival a day falls in, or null. Lunar ones are approximations (≈), from the moon's age:
// ลอยกระทง is the full moon of the 12th Thai month, usually in November; Chinese New Year is the
// new moon between 21 Jan and 20 Feb.
export function festival(t: number): Festival | null {
  const d = new Date(t)
  const m = d.getMonth() + 1
  const day = d.getDate()
  const age = moonAge(t)
  const on = (mm: number, from: number, to = from) => m === mm && day >= from && day <= to
  if (on(12, 31) || on(1, 1, 2)) return FESTIVALS.newyear ?? null
  if (((m === 1 && day >= 21) || (m === 2 && day <= 20)) && (age < 1.5 || age > SYNODIC - 0.5)) return FESTIVALS.chinese ?? null
  if (on(2, 14)) return FESTIVALS.valentine ?? null
  if (on(4, 13, 15)) return FESTIVALS.songkran ?? null
  if (on(8, 12)) return FESTIVALS.mother ?? null
  if (on(10, 31)) return FESTIVALS.halloween ?? null
  if ((m === 11 || (m === 10 && day >= 25) || (m === 12 && day <= 5)) && age >= 13.8 && age <= 15.8) return FESTIVALS.loykrathong ?? null
  if (on(12, 5)) return FESTIVALS.father ?? null
  if (on(12, 24, 25)) return FESTIVALS.christmas ?? null
  return null
}
