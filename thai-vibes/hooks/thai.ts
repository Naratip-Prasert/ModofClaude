// Thai calendar, greetings and proverbs. Pure functions, no engine calls.

const DAYS = ['อา.', 'จ.', 'อ.', 'พ.', 'พฤ.', 'ศ.', 'ส.']
const MONTHS = ['ม.ค.', 'ก.พ.', 'มี.ค.', 'เม.ย.', 'พ.ค.', 'มิ.ย.', 'ก.ค.', 'ส.ค.', 'ก.ย.', 'ต.ค.', 'พ.ย.', 'ธ.ค.']
// colour of the day, as in Thai tradition (Sunday first)
export const DAY_COLOR = ['red', 'yellow', 'magenta', 'green', 'yellow', 'cyan', 'blue']

const pad = (n: number) => String(n).padStart(2, '0')

export const thaiDate = (d: Date) => `${DAYS[d.getDay()]} ${d.getDate()} ${MONTHS[d.getMonth()]} ${d.getFullYear() + 543}`
export const clock = (d: Date) => `${pad(d.getHours())}:${pad(d.getMinutes())}`

export function greeting(h: number): { icon: string; text: string } {
  if (h >= 5 && h < 11) return { icon: '🌅', text: 'อรุณสวัสดิ์' }
  if (h >= 11 && h < 13) return { icon: '🍜', text: 'ได้เวลาข้าวเที่ยง' }
  if (h >= 13 && h < 17) return { icon: '☀️', text: 'สวัสดีตอนบ่าย' }
  if (h >= 17 && h < 20) return { icon: '🌇', text: 'สวัสดีตอนเย็น' }
  if (h >= 20 && h < 23) return { icon: '🌙', text: 'ราตรีสวัสดิ์' }
  return { icon: '🦉', text: 'ดึกแล้วนะ' }
}

export const isLate = (h: number) => h >= 23 || h < 4

export function duration(ms: number): string {
  const m = Math.floor(ms / 60000)
  return m < 60 ? `${m} นาที` : `${Math.floor(m / 60)} ชม. ${m % 60} นาที`
}

// traditional Thai proverbs (public domain), each with a coder's reading
export const PROVERBS: [string, string][] = [
  ['ช้าๆ ได้พร้าเล่มงาม', 'ค่อยๆ ทำ เขียนเทสต์ให้ครบ งานออกมาดีกว่ารีบ'],
  ['น้ำหยดลงหินทุกวัน หินมันยังกร่อน', 'commit เล็กๆ ทุกวัน ดีกว่าโปรเจกต์ใหญ่ที่ไม่เริ่ม'],
  ['ไม่เห็นน้ำ อย่าตัดกระบอก', 'ยังไม่รู้ requirement อย่าเพิ่งออกแบบเผื่อ'],
  ['กันไว้ดีกว่าแก้', 'validate input ไว้ก่อน ดีกว่ามานั่ง debug ทีหลัง'],
  ['รู้เขารู้เรา รบร้อยครั้งชนะร้อยครั้ง', 'อ่านโค้ดเดิมให้เข้าใจก่อนแก้'],
  ['ตำข้าวสารกรอกหม้อ', 'แก้บั๊กแบบเฉพาะหน้าวันต่อวัน ระวังหนี้ทางเทคนิค'],
  ['สิบปากว่าไม่เท่าตาเห็น', 'อย่าเดาว่ามันทำงาน รันให้เห็นกับตา'],
  ['เข้าเมืองตาหลิ่ว ต้องหลิ่วตาตาม', 'เขียนให้เข้ากับสไตล์โค้ดของโปรเจกต์'],
  ['ขี่ช้างจับตั๊กแตน', 'อย่าใช้ framework ยักษ์กับงานสคริปต์สิบบรรทัด'],
  ['ปิดทองหลังพระ', 'เขียน docs และเทสต์ อาจไม่มีใครเห็น แต่ทุกคนได้ประโยชน์'],
  ['ผิดเป็นครู', 'บั๊กทุกตัวคือบทเรียน จดไว้ใน postmortem'],
  ['หนามยอกเอาหนามบ่ง', 'ใช้เครื่องมือ debug ไล่หา ไม่ใช่เดาสุ่ม'],
  ['ความพยายามอยู่ที่ไหน ความสำเร็จอยู่ที่นั่น', 'build แดงอีกครั้งก็แค่อีกก้าวสู่สีเขียว'],
  ['อย่าไว้ใจทาง อย่าวางใจคน', 'อย่าเชื่อ input จากผู้ใช้ และอย่า commit ความลับ'],
]

export const ELEPHANT = [
  '    __     __',
  '   /  \~~~/  \    ',
  '  ( ●  ‿  ● )    ',
  '   \  \_/  /     ',
  '    |  |  |~     ',
  '    ^^   ^^      ',
]

export const MILESTONES = [5, 10, 25, 50, 100, 200]
