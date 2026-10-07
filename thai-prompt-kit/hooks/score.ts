// Local, heuristic prompt scoring. Nothing here leaves the machine.

export type Dim = 'goal' | 'context' | 'rules' | 'format' | 'detail'
export type Score = { stars: number; missing: Dim[] }

const CHECKS: Record<Dim, (t: string) => boolean> = {
  // what to do
  goal: t =>
    /(ช่วย|ทำ|สร้าง|แก้|เขียน|อธิบาย|เพิ่ม|ลบ|ปรับ|ตรวจ|ออกแบบ|วิเคราะห์|สรุป|แปลง|ค้นหา|หา|ติดตั้ง|ทดสอบ)/.test(t) ||
    /\b(add|build|create|write|fix|explain|refactor|review|remove|delete|update|test|design|find|install|migrate|implement)\b/i.test(t),
  // where / what it is about: files, mentions, code, errors
  context: t =>
    /@\S+|[\w./\-]+\.[a-z0-9]{1,5}\b|```|`[^`]+`/i.test(t) ||
    /(ไฟล์|โฟลเดอร์|ฟังก์ชัน|หน้า|error|exception|stack|ข้อผิดพลาด|ผิดพลาด|log)/i.test(t),
  // constraints
  rules: t => /(ต้อง|ห้าม|อย่า|ไม่ต้อง|เท่านั้น|ไม่เกิน|อย่างน้อย|\bmust\b|\bdon'?t\b|\bonly\b|\bwithout\b|\bavoid\b)/i.test(t),
  // what the answer should look like
  format: t =>
    /(รูปแบบ|ตาราง|ข้อๆ|เป็นข้อ|สรุป|ตัวอย่าง|สั้นๆ|ละเอียด|ภาษาไทย|ภาษาอังกฤษ|ขั้นตอน|\bjson\b|\bmarkdown\b|\btable\b|\bbullet|\bsteps?\b)/i.test(t),
  detail: t => [...t].length >= 60,
}

export const TIPS: Record<Dim, string> = {
  goal: 'บอกให้ชัดว่าอยากให้ "ทำอะไร" เช่น สร้าง / แก้ / อธิบาย / รีวิว',
  context: 'ใส่บริบท: ชื่อไฟล์ (@ไฟล์), ข้อความ error หรือโค้ดที่เกี่ยวข้อง',
  rules: 'บอกข้อจำกัด เช่น "ห้ามแก้ API เดิม" หรือ "ใช้ไลบรารีที่มีอยู่เท่านั้น"',
  format: 'บอกรูปแบบคำตอบ เช่น "สรุปเป็นข้อๆ" หรือ "ตอบเป็นภาษาไทยสั้นๆ"',
  detail: 'เล่าเพิ่มอีกนิด: ทำไปทำไม ผลลัพธ์ที่ดีหน้าตาเป็นอย่างไร',
}

// short conversational replies are not prompts to coach
const CHAT = /^(ok|okay|yes|no|y|n|go|continue|next|thanks?|ty|ใช่|ไม่|ได้|โอเค|ต่อ|ทำเลย|ลุย|ขอบคุณ|ครับ|ค่ะ|จ้า|เอา|ไม่เอา|ตกลง|\d+)[\s.!ๆ]*$/i

export function isCoachable(text: string): boolean {
  const t = text.trim()
  return t.length > 0 && !t.startsWith('/') && !t.startsWith('!') && !CHAT.test(t)
}

export function score(text: string): Score {
  const missing = (Object.keys(CHECKS) as Dim[]).filter(d => !CHECKS[d](text))
  return { stars: 5 - missing.length, missing }
}

export const stars = (n: number) => '★'.repeat(n) + '☆'.repeat(5 - n)
