// Local, heuristic prompt scoring. Nothing here leaves the machine.
//
// The draft is cut into words (Intl.Segmenter: Thai is written without spaces), the words are
// matched against a small lexicon (longest match first, so ถูกต้อง is claimed before ต้อง can be,
// and a misspelling within one letter of a long word still counts), and each of the five parts
// of a good prompt is read from the sentence shape: a verb with an object, a negation with an
// action, a format noun inside "ตอบเป็น…". Each part scores 0, ½ or 1.

import type { Dim, Mark, PromptKind, Score } from '../types'

export const DIMS: Dim[] = ['goal', 'context', 'rules', 'format', 'detail']

export const SHORT: Record<Dim, string> = {
  goal: 'เป้าหมาย',
  context: 'บริบท',
  rules: 'ข้อจำกัด',
  format: 'รูปแบบ',
  detail: 'รายละเอียด',
}

// what to add when a part is missing (0) or only half there (½)
export const TIPS: Record<Dim, [string, string]> = {
  goal: [
    'บอกให้ชัดว่าอยากให้ "ทำอะไร" เช่น สร้าง / แก้ / อธิบาย / รีวิว',
    'บอกด้วยว่าจะทำ "กับอะไร" เช่น "แก้ปุ่ม login ที่กดไม่ติด"',
  ],
  context: [
    'ใส่บริบท: ชื่อไฟล์ (@ไฟล์), ชื่อฟังก์ชันหรือ mod, ข้อความ error',
    'ระบุให้เจาะจงขึ้น: ชื่อไฟล์ ชื่อคำสั่ง หรือคัดข้อความ error มาวาง',
  ],
  rules: [
    'บอกข้อจำกัด เช่น "ห้ามแก้ API เดิม" หรือ "ไม่เกิน 50 บรรทัด"',
    'ขยายข้อจำกัดว่าห้ามหรือต้องทำ "อะไร" เช่น "ห้ามลบเทสต์เดิม"',
  ],
  format: [
    'บอกรูปแบบคำตอบ เช่น "สรุปเป็นข้อๆ" หรือ "ตอบเป็นภาษาไทยสั้นๆ"',
    'บอกว่าอยากได้คำตอบ "เป็นแบบไหน" เช่น "ตอบเป็นตาราง"',
  ],
  detail: [
    'เล่าเพิ่มอีกนิด: ทำไปทำไม ผลลัพธ์ที่ดีหน้าตาเป็นอย่างไร',
    'เติมเหตุผลหรือเงื่อนไข เช่น "เพราะ…" "ถ้า… ให้…" "เพื่อ…"',
  ],
}

// ---------------------------------------------------------------------------------------------
// lexicon

type Kind =
  | 'verb' // an action: the goal
  | 'question' // ทำไม / อย่างไร: a goal, but a vague one
  | 'neg' // ห้าม / อย่า / ไม่ต้อง: a rule when an action follows
  | 'must' // ต้อง / เท่านั้น / ไม่เกิน: a rule
  | 'fmt' // a shape of answer: ตาราง / ข้อๆ / ภาษาไทย
  | 'frame' // what puts a shape on the answer: ตอบ / เป็น / แบบ / ขอ
  | 'noun' // a thing in the project: ไฟล์ / ปุ่ม / mod
  | 'prep' // what points at a thing: เรื่อง / ใน / ของ
  | 'link' // what joins clauses: เพราะ / เพื่อ / ถ้า
  | 'filler' // politeness and glue: นะ / หน่อย / ครับ
  | 'decoy' // a word that only looks like a signal: ถูกต้อง / ต้องการ / ตัวอย่าง(ใน rules)

const LEX: Record<Kind, string[]> = {
  verb: [
    'ทำ', 'สร้าง', 'แก้', 'แก้ไข', 'เขียน', 'อธิบาย', 'เพิ่ม', 'ลบ', 'ปรับ', 'ปรับปรุง', 'ตรวจ', 'ตรวจสอบ',
    'ออกแบบ', 'วิเคราะห์', 'สรุป', 'แปล', 'แปลง', 'ค้นหา', 'หา', 'ติดตั้ง', 'ทดสอบ', 'รัน', 'ย้าย', 'เปลี่ยน',
    'รีวิว', 'วางแผน', 'ลิส', 'ลิสต์', 'จัด', 'เรียง', 'คำนวณ', 'ดู', 'เช็ค', 'เช็ก', 'อัปเดต', 'อัพเดท', 'อัพเดต',
    'เชื่อม', 'ใส่', 'ตั้งค่า', 'เปรียบเทียบ', 'ทำให้ดีขึ้น', 'ปรับแต่ง', 'ลองทำ', 'ลอง', 'เปิด', 'ปิด', 'ซ่อน',
    'แสดง', 'push', 'commit', 'deploy', 'build', 'add', 'create', 'write', 'fix', 'explain', 'refactor',
    'review', 'remove', 'delete', 'update', 'test', 'design', 'find', 'install', 'migrate', 'implement',
    'make', 'change', 'rename', 'move', 'list', 'summarize', 'translate', 'convert', 'check', 'debug', 'run',
  ],
  question: ['ทำไม', 'อย่างไร', 'ยังไง', 'ไง', 'อะไร', 'ตรงไหน', 'เมื่อไหร่', 'why', 'how', 'what', 'where'],
  neg: ['ห้าม', 'อย่า', 'ไม่ต้อง', 'ไม่ให้', 'ไม่ควร', 'ห้ามไม่ให้', 'งด', 'เลี่ยง', 'หลีกเลี่ยง', 'never', 'avoid', 'without', "don't", 'dont', 'not'],
  must: [
    'ต้อง', 'ควร', 'เท่านั้น', 'ไม่เกิน', 'อย่างน้อย', 'ภายใน', 'สูงสุด', 'ต่ำสุด', 'จำกัด', 'เฉพาะ',
    'แค่', 'อย่างเดียว', 'เฉยๆ', 'เพียง',
    'must', 'only', 'should',
  ],
  fmt: [
    'ตาราง', 'ข้อ', 'bullet', 'json', 'markdown', 'yaml', 'csv', 'ภาษาไทย', 'ภาษาอังกฤษ', 'อังกฤษ', 'สั้นๆ',
    'สั้น', 'กระชับ', 'ละเอียด', 'อย่างละเอียด', 'ขั้นตอน', 'ทีละขั้น', 'ตัวอย่าง', 'แผนภาพ', 'diagram', 'กราฟ',
    'ย่อหน้า', 'หัวข้อ', 'เช็กลิสต์', 'เช็คลิสต์', 'checklist', 'table', 'steps', 'list',
  ],
  frame: ['ตอบ', 'เป็น', 'แบบ', 'ขอ', 'รูปแบบ', 'ในรูปแบบ', 'ออกมา', 'format', 'as'],
  noun: [
    'ไฟล์', 'โฟลเดอร์', 'ฟังก์ชัน', 'ฟังก์ชั่น', 'คลาส', 'ตัวแปร', 'หน้า', 'หน้าจอ', 'ปุ่ม', 'ฟอร์ม', 'เมนู',
    'ฐานข้อมูล', 'mod', 'ม็อด', 'มอด', 'ปลั๊กอิน', 'plugin', 'component', 'คอมโพเนนต์', 'โปรเจกต์', 'โปรเจค',
    'repo', 'branch', 'error', 'เออเรอร์', 'บั๊ก', 'bug', 'log', 'เซิร์ฟเวอร์', 'server', 'database', 'endpoint',
    'api', 'route', 'เทสต์', 'คำสั่ง', 'command', 'script', 'สคริปต์', 'config', 'แอป', 'เว็บ', 'โค้ด', 'code',
    'ระบบ', 'แถบ', 'แผง', 'ดาว', 'พรอมต์', 'prompt', 'โมดูล', 'module', 'หน้าเว็บ', 'ข้อความ', 'ปัญหา',
    'หน้าต่าง', 'หน้าแรก', 'html', 'css', 'react',
  ],
  prep: ['เรื่อง', 'ใน', 'ของ', 'ตรง', 'จาก', 'บน', 'สำหรับ', 'เกี่ยวกับ', 'in', 'on', 'for', 'from'],
  link: [
    'เพราะ', 'เพื่อ', 'ถ้า', 'แล้ว', 'โดย', 'เนื่องจาก', 'เมื่อ', 'ตอนที่', 'หลังจาก', 'ก่อน', 'แต่', 'ซึ่ง',
    'จนกว่า', 'ไม่งั้น', 'because', 'so', 'if', 'then', 'when', 'but', 'after', 'before', 'until',
  ],
  filler: [
    'ช่วย', 'หน่อย', 'นะ', 'ครับ', 'ค่ะ', 'คะ', 'จ้า', 'จ้ะ', 'ที', 'มัน', 'อะ', 'อ่ะ', 'ได้', 'ไหม', 'มั้ย',
    'ให้', 'ก็', 'ที่', 'และ', 'กับ', 'ด้วย', 'เลย', 'จะ', 'มี', 'ว่า', 'คือ', 'นี้', 'นั้น', 'นี่', 'ไร', 'งี้',
    'อัน', 'อยาก', 'อยากได้', 'ต้องการ', 'ได้ไหม', 'บ้าง', 'ๆ', 'ซิ', 'สิ', 'เถอะ', 'please', 'pls', 'the', 'a',
    'an', 'to', 'of', 'it', 'is', 'and', 'this', 'that', 'me', 'i', 'you', 'can', 'could', 'would',
  ],
  decoy: [
    'ถูกต้อง', 'ทำให้', 'ทำงาน', 'การทำงาน', 'หาย', 'อย่างมาก', 'อย่างนี้', 'อย่างนั้น', 'อย่างเช่น', 'อย่าง',
    'หน้าตา', 'ข้างหน้า', 'ต่อหน้า', 'ความต้องการ', 'สั้นยาว', 'ทำไมถึง', 'ข้อมูล', 'แบบนี้', 'แบบนั้น',
    'เป็นไง', 'เป็นอะไร', 'ได้เลย', 'ลองดู', 'เช่น', 'อื่นๆ',
    // naming a part is not having it: "(ข้อจำกัด)" alone states no limit
    'ข้อจำกัด', 'เป้าหมาย', 'บริบท', 'รายละเอียด',
  ],
}

// tone marks and the like: a misspelling often gets these wrong first
const TONES = /[็-์]/g
const bare = (s: string) => s.toLowerCase().replace(TONES, '')
const isThai = (s: string) => /[฀-๿]/.test(s)

type Entry = { word: string; bare: string; kind: Kind }
const ENTRIES: Entry[] = (Object.keys(LEX) as Kind[]).flatMap(kind =>
  LEX[kind].map(word => ({ word, bare: bare(word), kind })),
)
const EXACT = new Map<string, Entry>()
for (const e of ENTRIES) if (!EXACT.has(e.bare)) EXACT.set(e.bare, e)
// only long Thai words may be matched loosely: a short one is one letter from too many others
const FUZZY = ENTRIES.filter(e => isThai(e.word) && [...e.bare].length >= 4)

function within1(a: string, b: string): boolean {
  if (a === b) return true
  const x = [...a]
  const y = [...b]
  if (Math.abs(x.length - y.length) > 1) return false
  let i = 0
  let j = 0
  let edits = 0
  while (i < x.length && j < y.length) {
    if (x[i] === y[j]) {
      i++
      j++
      continue
    }
    if (++edits > 1) return false
    if (x.length > y.length) i++
    else if (y.length > x.length) j++
    else {
      i++
      j++
    }
  }
  return edits + (x.length - i) + (y.length - j) <= 1
}

// ---------------------------------------------------------------------------------------------
// words

export type Word = { text: string; at: number; end: number; kind: Kind | 'other'; via?: string }

const SEG = typeof Intl !== 'undefined' && 'Segmenter' in Intl ? new Intl.Segmenter('th', { granularity: 'word' }) : null

// Thai and Latin are cut apart first: typed without a space ("ใช้htmlอย่างเดียว") the word
// cutter reads them as one word and the Thai on either side is lost
function split(text: string): { text: string; at: number }[] {
  const out: { text: string; at: number }[] = []
  for (const run of text.matchAll(/[฀-๿]+|[^฀-๿]+/g)) {
    const base = run.index ?? 0
    if (SEG) {
      for (const s of SEG.segment(run[0])) {
        if (s.isWordLike || s.segment === 'ๆ') out.push({ text: s.segment, at: base + s.index })
      }
    } else {
      for (const m of run[0].matchAll(/[\p{L}\p{M}\p{N}_ๆ']+/gu)) out.push({ text: m[0], at: base + (m.index ?? 0) })
    }
  }
  return out
}

// longest span first, exact before loose, so a compound claims its pieces before they match alone
export function words(text: string): Word[] {
  const raw = split(text)
  const out: Word[] = raw.map(r => ({ text: r.text, at: r.at, end: r.at + r.text.length, kind: 'other' }))
  type Hit = { from: number; to: number; entry: Entry; isExact: boolean; len: number }
  const hits: Hit[] = []
  for (let i = 0; i < raw.length; i++) {
    let joined = ''
    for (let k = i; k < Math.min(raw.length, i + 3); k++) {
      const cur = raw[k]
      const prev = raw[k - 1]
      if (k > i && (cur === undefined || prev === undefined || prev.at + prev.text.length !== cur.at)) break // only touching pieces
      joined += cur?.text ?? ''
      const b = bare(joined)
      const exact = EXACT.get(b)
      if (exact) hits.push({ from: i, to: k, entry: exact, isExact: true, len: [...b].length })
      else if (isThai(b) && [...b].length >= 4) {
        const loose = FUZZY.find(e => e.bare[0] === b[0] && within1(e.bare, b))
        if (loose) hits.push({ from: i, to: k, entry: loose, isExact: false, len: [...b].length })
      }
    }
  }
  hits.sort((a, b) => b.len - a.len || Number(b.isExact) - Number(a.isExact))
  const taken = new Array<boolean>(raw.length).fill(false)
  const merged: Word[] = []
  for (const h of hits) {
    if (taken.slice(h.from, h.to + 1).some(Boolean)) continue
    for (let k = h.from; k <= h.to; k++) taken[k] = true
    const first = out[h.from]
    const last = out[h.to]
    if (!first || !last) continue
    const surface = text.slice(first.at, last.end)
    merged.push({
      text: surface,
      at: first.at,
      end: last.end,
      kind: h.entry.kind,
      // a tone mark off is a misspelling too: say which word it was read as
      via: surface.toLowerCase() === h.entry.word ? undefined : h.entry.word,
    })
  }
  out.forEach((w, k) => {
    if (!taken[k]) merged.push(w)
  })
  return merged.sort((a, b) => a.at - b.at)
}

// ---------------------------------------------------------------------------------------------
// the five parts

// things only code has: a path, a file, a kebab/snake/camel name, a /command, a URL, a quote
const CODEY: [RegExp, string][] = [
  [/@[\w./\\-]+/, '@ไฟล์'],
  [/```[\s\S]*?```|`[^`\n]+`/, 'โค้ด'],
  [/https?:\/\/\S+/, 'URL'],
  [/(?:^|[\s(])\/[a-z][\w-]*/i, '/คำสั่ง'],
  [/[\w-]+(?:[\\/][\w.-]+)+/, 'path'],
  [/\b[\w-]+\.(?:ts|tsx|js|jsx|py|go|rs|java|kt|rb|php|cs|cpp|c|h|json|ya?ml|md|html|css|sql|sh|ps1|toml|env)\b/i, 'ชื่อไฟล์'],
  [/\b[a-z0-9]+(?:[-_][a-z0-9]+)+\b/i, 'ชื่อแบบโค้ด'],
  [/\b[a-z]+[A-Z][A-Za-z0-9]*\b/, 'ชื่อแบบโค้ด'],
  [/["“'][^"”'\n]{2,}["”']/, 'ข้อความในเครื่องหมายคำพูด'],
  [/บรรทัด(?:ที่)?\s*\d+|line\s*\d+/i, 'เลขบรรทัด'],
  [/\b\w*(?:Error|Exception)\b|traceback|stack trace/i, 'ข้อความ error'],
]
// a number on a limit is a rule by itself: ไม่เกิน 3 ข้อ, ภายใน 100 บรรทัด, 3 ประโยค
const LIMIT = /(?:ไม่เกิน|อย่างน้อย|ภายใน|สูงสุด|ต่ำสุด|at most|at least|under|max)\s*\d+|\d+\s*(?:ข้อ|บรรทัด|คำ|ประโยค|ตัวอักษร|นาที|หน้า|words?|lines?)/i
const LISTY = /ข้อ\s*ๆ|เป็นข้อ|bullet|ทีละข้อ|\d+\s*ข้อ/i
// a frame right before a shape, read on the raw text: the word cutter sometimes splits across
// it (ขอตัวอย่าง comes out ขอตัว|อย่าง)
const FRAMED = /(?:ตอบ|ขอ|เป็น|แบบ|สรุป|แสดง)\s*(?:ตัวอย่าง|ตาราง|ภาษา\S{2,}|สั้น\s*ๆ|ขั้นตอน|แผนภาพ|json|markdown|yaml|csv)/i

const content = (w: Word | undefined) => w !== undefined && w.kind !== 'filler' && w.kind !== 'link'
const say = (w: Word) => (w.via ? `${w.text}→${w.via}` : w.text)

function next(ws: Word[], i: number, reach: number, ok: (w: Word) => boolean): Word | undefined {
  for (let k = i + 1; k <= Math.min(ws.length - 1, i + reach); k++) {
    const w = ws[k]
    if (w && ok(w)) return w
  }
  return undefined
}

function before(ws: Word[], i: number, reach: number, ok: (w: Word) => boolean): Word | undefined {
  for (let k = i - 1; k >= Math.max(0, i - reach); k--) {
    const w = ws[k]
    if (w && ok(w)) return w
  }
  return undefined
}

type Part = { mark: Mark; why: string[] }

// an object this vague still leaves the goal half said: "แก้บั๊ก" — which bug?
const VAGUE = new Set(['บั๊ก', 'bug', 'error', 'เออเรอร์', 'ปัญหา', 'โค้ด', 'code', 'งาน', 'มัน', 'อัน', 'นี้', 'ระบบ', 'it', 'this'])

function goal(ws: Word[]): Part {
  const why: string[] = []
  let mark: Mark = 0
  ws.forEach((w, i) => {
    if (w.kind !== 'verb' && w.kind !== 'question') return
    const obj = next(ws, i, 4, x => content(x) && x.kind !== 'verb' && x.kind !== 'frame')
    // a vague object counts only when something more specific follows it
    const isClear = obj !== undefined && (!VAGUE.has(obj.text.toLowerCase()) || next(ws, ws.indexOf(obj), 3, x => content(x) && !VAGUE.has(x.text.toLowerCase())) !== undefined)
    const m: Mark = w.kind === 'verb' && isClear ? 1 : 0.5
    if (m >= mark) {
      mark = m
      why.unshift(obj ? `${say(w)} + ${obj.text}` : say(w))
    }
  })
  return { mark, why: why.slice(0, 2) }
}

function context(ws: Word[], text: string): Part {
  const strong = CODEY.filter(([re]) => re.test(text)).map(([re, label]) => `${label} ${text.match(re)?.[0].trim() ?? ''}`)
  if (strong.length > 0) return { mark: 1, why: strong.slice(0, 2) }
  const weak: string[] = []
  ws.forEach((w, i) => {
    if (w.kind === 'noun') weak.push(say(w))
    else if (w.kind === 'prep') {
      const obj = next(ws, i, 2, x => content(x) && x.kind !== 'verb' && x.kind !== 'prep')
      if (obj) weak.push(`${w.text} ${obj.text}`)
    } else if (w.kind === 'other' && /^[a-z][a-z0-9]{2,}$/i.test(w.text)) weak.push(w.text) // a named thing: login, React
  })
  return { mark: weak.length >= 2 ? 1 : weak.length === 1 ? 0.5 : 0, why: weak.slice(0, 3) }
}

const POSTFIX = new Set(['อย่างเดียว', 'เท่านั้น', 'เฉยๆ', 'only'])

function rules(ws: Word[], text: string): Part {
  const limit = text.match(LIMIT)
  if (limit) return { mark: 1, why: [limit[0]] }
  const why: string[] = []
  let mark: Mark = 0
  ws.forEach((w, i) => {
    if (w.kind !== 'neg' && w.kind !== 'must') return
    const isAct = (x: Word) => content(x) && x.kind !== 'neg' && x.kind !== 'must' && x.kind !== 'frame'
    // อย่างเดียว / เท่านั้น / เฉยๆ close the phrase they limit: "ใช้ html อย่างเดียว"
    const act = POSTFIX.has(w.via ?? w.text) ? before(ws, i, 3, isAct) : next(ws, i, 3, isAct)
    const m: Mark = act ? 1 : 0.5
    if (m >= mark) {
      mark = m
      why.unshift(act ? `${say(w)} + ${act.text}` : say(w))
    }
  })
  return { mark, why: why.slice(0, 2) }
}

function format(ws: Word[], text: string): Part {
  const list = text.match(LISTY) ?? text.match(FRAMED)
  if (list) return { mark: 1, why: [list[0]] }
  const why: string[] = []
  let mark: Mark = 0
  ws.forEach((w, i) => {
    if (w.kind !== 'fmt') return
    // ข้อ alone is "item", not a format, unless the list check above caught ข้อๆ
    if (w.text === 'ข้อ') return
    const frame = before(ws, i, 3, x => x.kind === 'frame' || (x.kind === 'verb' && /สรุป|แสดง|เขียน|ทำ|list/i.test(x.text)))
    const m: Mark = frame ? 1 : 0.5
    if (m >= mark) {
      mark = m
      why.unshift(frame ? `${frame.text} … ${say(w)}` : say(w))
    }
  })
  return { mark, why: why.slice(0, 2) }
}

function detail(ws: Word[], text: string): Part {
  const n = ws.filter(w => content(w)).length
  const links = ws.filter(w => w.kind === 'link').map(w => w.text)
  const hasCode = /```/.test(text)
  const mark: Mark = hasCode || n >= 12 || (n >= 8 && links.length >= 1) ? 1 : n >= 6 ? 0.5 : 0
  const why = [`${n} คำที่มีความหมาย`, ...(links.length > 0 ? [`คำเชื่อม: ${links.slice(0, 3).join(' ')}`] : [])]
  return { mark, why }
}

// ---------------------------------------------------------------------------------------------

// short conversational replies are not prompts to coach
const CHAT = /^(ok|okay|yes|no|y|n|go|continue|next|thanks?|ty|ใช่|ไม่|ได้|โอเค|ต่อ|ทำเลย|ลุย|ขอบคุณ|ครับ|ค่ะ|จ้า|เอา|ไม่เอา|ตกลง|อีกที|\d+)[\s.!ๆ]*$/i

export function isCoachable(text: string): boolean {
  const t = text.trim()
  return t.length > 0 && !t.startsWith('/') && !t.startsWith('!') && !CHAT.test(t)
}

// --- what kind of prompt it is decides which parts it needs: a question has no rules to state,
// "run the tests" needs no answer format. The parts it does not need are shown, but not counted.

export const KIND_TEXT: Record<PromptKind, string> = {
  build: 'สั่งงาน',
  ask: 'คำถาม',
  quick: 'คำสั่งสั้น',
  review: 'ตรวจ/รีวิว',
}
const NEEDS: Record<PromptKind, Dim[]> = {
  build: ['goal', 'context', 'rules', 'format', 'detail'],
  ask: ['goal', 'context'],
  quick: ['goal', 'context'],
  review: ['goal', 'context', 'format'],
}
const MAKES = /^(สร้าง|แก้|แก้ไข|เขียน|เพิ่ม|ลบ|ปรับ|ปรับปรุง|ออกแบบ|แปลง|ย้าย|เปลี่ยน|ทำ|ใส่|ตั้งค่า|ปรับแต่ง|add|create|write|fix|refactor|remove|delete|update|design|implement|make|change|rename|move|migrate|convert)$/i
const ASKS = /^(อธิบาย|explain)$/i
const QUICK = /^(รัน|run|push|commit|deploy|build|ติดตั้ง|install|เปิด|ปิด|test|ทดสอบ|ลอง)$/i
const REVIEWS = /^(รีวิว|review|ตรวจ|ตรวจสอบ|check|เช็ค|เช็ก|วิเคราะห์)$/i
// a question in form: ends in a question particle or mark (but "ได้ไหม" after a verb is a polite order)
const QUESTION_END = /(\?|ไหม|มั้ย|หรือเปล่า|รึเปล่า|ป่ะ|ปะ|หรือไม่)\s*$/

function kindOf(ws: Word[], text: string): PromptKind {
  const verbs = ws.filter(w => w.kind === 'verb').map(w => w.via ?? w.text)
  if (verbs.some(v => MAKES.test(v))) return 'build'
  if (verbs.some(v => REVIEWS.test(v))) return 'review'
  if (ws.some(w => w.kind === 'question') || verbs.some(v => ASKS.test(v)) || QUESTION_END.test(text.trim())) return 'ask'
  if (verbs.some(v => QUICK.test(v)) && ws.filter(w => content(w)).length <= 6) return 'quick'
  return 'build'
}

export function score(text: string): Score {
  const ws = words(text)
  const parts: Record<Dim, Part> = {
    goal: goal(ws),
    context: context(ws, text),
    rules: rules(ws, text),
    format: format(ws, text),
    detail: detail(ws, text),
  }
  const marks = {} as Record<Dim, Mark>
  const why = {} as Record<Dim, string[]>
  for (const d of DIMS) {
    marks[d] = parts[d].mark
    why[d] = parts[d].why
  }
  const kind = kindOf(ws, text)
  // a question about something named in full is a whole goal: "ทำไม scorePrompt ให้ดาวผิด"
  if (kind === 'ask' && marks.goal === 0.5 && marks.context === 1) marks.goal = 1
  const needs = NEEDS[kind]
  const optional = DIMS.filter(d => !needs.includes(d))
  // weakest needed part first, ties in the DIMS order: the tip names the most useful thing to add
  const missing = needs.filter(d => marks[d] < 1).sort((a, b) => marks[a] - marks[b])
  // the needed parts scaled to five stars, in half stars
  const got = needs.reduce((s, d) => s + marks[d], 0)
  const stars = Math.round((got / needs.length) * 5 * 2) / 2
  return { stars, marks, missing, why, kind, optional }
}

export const stars = (n: number) => '★'.repeat(Math.floor(n)) + '☆'.repeat(5 - Math.floor(n))
export const starText = (n: number) => `${stars(n)} ${Number.isInteger(n) ? n : n.toFixed(1)}`
export const tip = (s: Score): string | null => {
  const d = s.missing[0]
  return d === undefined ? null : TIPS[d][s.marks[d] === 0 ? 0 : 1]
}
