import { expect, test } from 'claude-code/testing'

import type { Dim, Mark, PromptKind } from '../types'
import { isCoachable, score, words } from '../hooks/score'

// [prompt, the marks it must get]; a part left out is not checked
type Case = [string, Partial<Record<Dim, Mark>>]

const CASES: Case[] = [
  // --- one word, or close to it, is never a full part
  ['แก้', { goal: 0.5, context: 0, rules: 0, format: 0, detail: 0 }],
  ['แก้บั๊ก', { goal: 0.5, context: 0.5, rules: 0, format: 0, detail: 0 }],
  ['ช่วยหน่อย', { goal: 0, context: 0, rules: 0, format: 0 }],
  ['fix it', { goal: 0.5, context: 0 }],
  // --- look-alikes from the first version
  ['ทำไมมันช้า', { goal: 0.5, rules: 0, format: 0 }],
  ['ตัวอย่างอะไรก็ได้ที่ถูกต้อง', { rules: 0, format: 0.5 }],
  ['อยากได้แบบนี้ ต้องการให้ดีขึ้นอย่างมาก', { rules: 0, format: 0 }],
  ['ปัญหาคืออะไร', { goal: 0.5, rules: 0 }],
  ['มันทำงานอย่างไร', { goal: 0.5, rules: 0, format: 0 }],
  ['ทำให้มันสวยขึ้น', { rules: 0, format: 0 }],
  ['หน้าตาแอปดูดีขึ้นไหม', { rules: 0 }],
  ['login ไม่ได้', { context: 0.5, goal: 0 }],
  // --- misspellings still read as the word meant
  ['ต้อการให้หน้า login สวยขึ้น', { rules: 0 }],
  ['ต่องการให้หน้า login สวยขึ้น', { rules: 0 }],
  ['ถูกต่อง', { rules: 0 }],
  ['ตอบเป็นภาษาไท', { format: 1 }],
  ['สรุปเป็นตารัง', { format: 1 }],
  ['ห้ามแก้ไฟล์เดิม', { rules: 1 }],
  // --- context: named things, not just files
  ['ช่วยดูเรื่อง th-prompt หน่อย', { context: 1 }],
  ['แก้ /th-coach ให้แสดงดาว', { context: 1 }],
  ['ดู src/app.ts ให้หน่อย', { context: 1 }],
  ['แก้ฟังก์ชัน scorePrompt', { context: 1 }],
  ['ข้อความขึ้นว่า "Cannot read property" ตอนกดปุ่ม', { context: 1 }],
  ['ปุ่ม login ในหน้าแรก', { context: 1 }],
  ['TypeError: x is undefined', { context: 1 }],
  // --- rules need an action or a number
  ['ห้าม', { rules: 0.5 }],
  ['ไม่ต้องแก้ API เดิม', { rules: 1 }],
  ['ใช้ไลบรารีที่มีอยู่เท่านั้น', { rules: 1 }],
  ['ตอบไม่เกิน 5 ข้อ', { rules: 1, format: 1 }],
  ['อย่าลบเทสต์เดิม', { rules: 1 }],
  ["don't touch the api", { rules: 1 }],
  ['must not change the api', { rules: 1 }],
  // --- limits that close the phrase, and Thai typed against English with no space
  ['ใช้htmlอย่างเดียวนะ', { rules: 1, context: 0.5 }],
  ['ใช้ react เท่านั้น', { rules: 1 }],
  ['ทำเป็นตัวโชว์เฉยๆ', { rules: 1, format: 0 }],
  ['แค่แก้สีปุ่ม', { rules: 1 }],
  ['เปิดหน้าต่างใหม่', { rules: 0 }],
  // --- format needs a shape, best inside "ตอบเป็น…"
  ['สรุปเป็นข้อๆ', { format: 1 }],
  ['ตอบเป็นตาราง', { format: 1 }],
  ['ตาราง', { format: 0.5 }],
  ['ขอตัวอย่างโค้ดสั้นๆ', { format: 1 }],
  ['อธิบายอย่างละเอียด', { format: 0.5 }],
  // --- full prompts
  [
    // from a real try: the limits were missed, and no answer shape was asked for (still true)
    'สร้างหน้าloginหน่อย เป็นหน้าต่างหน้าแรกมีปุ่มสวยๆ ใช้htmlอย่างเดียวนะ ทำเป็นตัวโชว์เฉยๆ',
    { goal: 1, context: 1, rules: 1, format: 0, detail: 1 },
  ],
  [
    'ช่วยแก้ error ใน @src/app.ts ตอนกด login ห้ามแก้ API เดิม สรุปเป็นข้อๆ ว่าแก้อะไรบ้าง',
    { goal: 1, context: 1, rules: 1, format: 1 },
  ],
  [
    'แก้ปุ่ม login ในหน้าแรกที่กดแล้วไม่เกิดอะไรขึ้น เพราะลูกค้าเข้าระบบไม่ได้ ห้ามเปลี่ยนหน้าตาเดิม แล้วสรุปเป็นข้อๆ ว่าแก้ตรงไหน',
    { goal: 1, context: 1, rules: 1, format: 1, detail: 1 },
  ],
  [
    'ปรับดาวใน mod th-prompt ให้ดูรูปประโยคมากขึ้น เพราะตอนนี้พิมพ์คำเดียวก็ติ๊กถูกแล้ว ห้ามส่งข้อความออกนอกเครื่อง ตอบเป็นข้อๆ',
    { goal: 1, context: 1, rules: 1, format: 1, detail: 1 },
  ],
]

test('every case in the set gets the marks it should', async () => {
  const wrong: string[] = []
  for (const [text, want] of CASES) {
    const s = score(text)
    for (const [d, m] of Object.entries(want) as [Dim, Mark][]) {
      if (s.marks[d] !== m) wrong.push(`"${text}" ${d}: got ${s.marks[d]}, want ${m} (${s.why[d].join(' · ') || '-'}) [${words(text).map(w => `${w.text}:${w.kind}`).join(' ')}]`)
    }
  }
  expect(wrong).toEqual([])
})

test('naming a part is not having it', async () => {
  expect(score('ทำหน้า login (ข้อจำกัด)').marks.rules).toBe(0)
  expect(score('ข้อจำกัด: ห้ามแก้ API เดิม').marks.rules).toBe(1)
})

test('the kind of prompt decides which parts it needs', async () => {
  const KINDS: [string, PromptKind, Dim[]][] = [
    ['ทำไม useEffect ถึงรันสองรอบ', 'ask', ['rules', 'format', 'detail']],
    ['อธิบาย race condition หน่อย', 'ask', ['rules', 'format', 'detail']],
    ['แบบนี้คิดว่าไง', 'ask', ['rules', 'format', 'detail']],
    ['รันเทสต์ให้หน่อย', 'quick', ['rules', 'format', 'detail']],
    ['push ขึ้น github เลย', 'quick', ['rules', 'format', 'detail']],
    ['รีวิวโค้ดใน src/app.ts สรุปเป็นข้อๆ', 'review', ['rules', 'detail']],
    // a polite order phrased as a question is still an order
    ['ช่วยแก้ปุ่ม login ได้ไหม', 'build', []],
    ['สร้างหน้าloginหน่อย เป็นหน้าต่างหน้าแรกมีปุ่มสวยๆ ใช้htmlอย่างเดียวนะ', 'build', []],
  ]
  for (const [text, kind, optional] of KINDS) {
    const s = score(text)
    expect(`${text} → ${s.kind} ${s.optional.join(',')}`).toBe(`${text} → ${kind} ${optional.join(',')}`)
  }
})

test('a clear question gets full stars without rules or format', async () => {
  const s = score('ทำไมฟังก์ชัน scorePrompt ใน hooks/score.ts ถึงให้ดาวผิด')
  expect(s.kind).toBe('ask')
  expect(s.stars).toBe(5)
  expect(s.missing).toEqual([])
})

test('a misspelling within one letter matches the word meant', async () => {
  const kindOf = (t: string, w: string) => words(t).find(x => x.via === w || x.text === w)?.kind
  expect(kindOf('ต้อการ', 'ต้องการ')).toBe('filler')
  expect(kindOf('ต่องการ', 'ต้องการ')).toBe('filler')
  expect(kindOf('ถูกต่อง', 'ถูกต้อง')).toBe('decoy')
})

test('slash commands and short replies are not coached', async () => {
  expect(isCoachable('/th-plan')).toBe(false)
  expect(isCoachable('ทำเลย')).toBe(false)
  expect(isCoachable('')).toBe(false)
})
