import { atom, read, update } from 'claude-code'
import type { Register } from 'claude-code'

import type { CoachMode, Mark, Score } from '../types'
import { DIMS, KIND_TEXT, SHORT, isCoachable, score, starText, tailText, tip } from './score'

const coachMode = atom({ plugin: 'thai-prompt-kit', key: 'coachMode' } as const, 'on')
const draft = atom({ plugin: 'thai-prompt-kit', key: 'draft' } as const, null)
const lastText = atom({ plugin: 'thai-prompt-kit', key: 'lastText' } as const, null)
const scored = atom({ plugin: 'thai-prompt-kit', key: 'scored' } as const, 0)
const starSum = atom({ plugin: 'thai-prompt-kit', key: 'starSum' } as const, 0)

const MODES: CoachMode[] = ['on', 'quiet', 'off']
const HELP: Record<CoachMode, string> = {
  on: 'on: แถบดาวสดขณะพิมพ์ พร้อมเคล็ดลับ',
  quiet: 'quiet: แถบดาวสดขณะพิมพ์ ไม่มีเคล็ดลับ',
  off: 'off: ปิดโค้ช',
}
const SIGN: Record<Mark, string> = { 0: '✗', 0.5: '◐', 1: '✓' }
const COLOR: Record<Mark, string> = { 0: 'red', 0.5: 'yellow', 1: 'green' }
const tone = (stars: number) => (stars >= 4 ? 'green' : stars >= 3 ? 'yellow' : 'red')

const same = (a: Score | null, b: Score | null) =>
  a === b || (a !== null && b !== null && a.kind === b.kind && DIMS.every(d => a.marks[d] === b.marks[d]))

// the /th-coach why report: each part, its mark, and the words it was given for
function explain(text: string): string {
  const s = score(text)
  return [
    `“${text.length > 80 ? `${text.slice(0, 80)}…` : text}”`,
    `${starText(s.stars)} · ประเภท: ${KIND_TEXT[s.kind]}`,
    ...DIMS.map(d => {
      const found = s.why[d].length > 0 ? s.why[d].join(' · ') : 'ไม่พบ'
      return s.optional.includes(d)
        ? `– ${SHORT[d]}: ไม่จำเป็นสำหรับ${KIND_TEXT[s.kind]} (${found})`
        : `${SIGN[s.marks[d]]} ${SHORT[d]}: ${found}`
    }),
    ...(tip(s) ? [`💡 ${tip(s)}`] : []),
    '(คำที่มี → คือคำที่พิมพ์ผิดแล้วระบบเดาว่าตั้งใจพิมพ์คำนั้น)',
  ].join('\n')
}

export const register: Register = on => {
  on('session.start', async ($, e, next) => {
    await $.command.register({
      name: 'th-coach',
      description: 'โค้ชพรอมต์ภาษาไทย: on | quiet | off | why [ข้อความ] (ไม่ใส่ค่า = ดูสถิติ)',
    })
    return next(e)
  })

  on('command.run', { command: 'th-coach' }, async ($, e) => {
    const args = e.args.trim()
    const [head = '', ...rest] = args.split(/\s+/)
    const want = MODES.find(m => m === head.toLowerCase())
    if (want) {
      await update($, coachMode, () => want)
      return { text: `โค้ชพรอมต์ → ${HELP[want]}` }
    }
    if (head.toLowerCase() === 'why') {
      const text = rest.join(' ') || (await read($, lastText))
      return { text: text ? explain(text) : 'ยังไม่มีพรอมต์ให้ดู ลอง /th-coach why <ข้อความ>' }
    }
    const n = await read($, scored)
    const avg = n === 0 ? 0 : (await read($, starSum)) / n
    return {
      text: [
        `โหมดปัจจุบัน ${HELP[(await read($, coachMode)) as CoachMode]}`,
        n === 0 ? 'ยังไม่มีพรอมต์ที่ให้คะแนนในเซสชันนี้' : `ส่งไปแล้ว ${n} พรอมต์ เฉลี่ย ${starText(Math.round(avg * 2) / 2)}`,
        `เกณฑ์ 5 ข้อ (✓ เต็ม ◐ ครึ่ง ✗ ขาด): ${DIMS.map(d => SHORT[d]).join(' · ')}`,
        'ดูเหตุผลของคะแนน: /th-coach why (พรอมต์ล่าสุด) หรือ /th-coach why <ข้อความ>',
        `เปลี่ยนโหมด: /th-coach ${MODES.join(' | ')}`,
      ].join('\n'),
    }
  })

  // live: score the box as it stands after every edit; the edit itself goes through untouched
  on('prompt.edit', async ($, e, next) => {
    const box = await next(e)
    const s = isCoachable(box.text) ? score(box.text) : null
    // only write on a change, so typing inside one score redraws nothing
    if (!same(s, await read($, draft))) await update($, draft, () => s)
    return box
  })

  // read-only: count what was sent for /th-coach, then clear the live band
  on('prompt.submit', async ($, e, next) => {
    if (isCoachable(e.text)) {
      const s = score(e.text)
      await update($, scored, n => n + 1)
      await update($, starSum, n => n + s.stars)
      await update($, lastText, () => e.text)
    }
    await update($, draft, () => null)
    return next(e)
  })

  // below whatever the other plugins draw here (the context bar), so draw theirs first
  // the terminal: the stars ride the end of the hint row under the prompt. The band above the
  // prompt holds one plugin's tree, and a plugin ahead in the chain (the context bar) can take it.
  on('ui.render', { component: 'PromptHint' }, async ($, e, next) => {
    if (e.surface !== 'terminal') return next(e)
    const mode = await read($, coachMode)
    const s = await read($, draft)
    if (mode === 'off' || s === null || !e.props.isDraft) return next(e)
    return next({ ...e, props: { ...e.props, tail: tailText(s) } })
  })

  // the desktop: a band under the context bar, with marks for every part and a tip
  on('ui.render', { component: 'AbovePrompt' }, async ($, e, next) => {
    if (e.surface === 'terminal') return next(e)
    const mode = await read($, coachMode)
    const s = await read($, draft)
    if (e.props.hasSurvey || mode === 'off' || s === null) return next(e)

    const below = await next(e)
    const { Box, Text } = $.ui.resolve(e)
    const width = Math.max(24, (e.props.bodyColumns ?? 80) - 2)
    const hint = tip(s)

    return (
      <Box flexDirection="column" width={width}>
        {below}
        <Box width={width} flexWrap="wrap">
          <Text bold>✍️ {KIND_TEXT[s.kind]} </Text>
          <Text color={tone(s.stars)} bold>{starText(s.stars)} </Text>
          {DIMS.map(d =>
            // a part this kind does not need: grey, never red, and not in the stars
            s.optional.includes(d) ? (
              <Text key={d} color="gray" dimColor>
                {' '}{s.marks[d] > 0 ? '✓' : '–'}{SHORT[d]}
              </Text>
            ) : (
              <Text key={d} color={COLOR[s.marks[d]]} dimColor={s.marks[d] === 1}>
                {' '}{SIGN[s.marks[d]]}{SHORT[d]}
              </Text>
            ),
          )}
        </Box>
        {mode === 'on' && hint !== null && <Text dimColor wrap="truncate-end">💡 {hint}</Text>}
      </Box>
    )
  })
}
