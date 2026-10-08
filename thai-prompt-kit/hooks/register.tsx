import { atom, read, update } from 'claude-code'
import type { EngineInterface, Register } from 'claude-code'

import type { CoachMode, Mark, Score } from '../types'
import { TTL_MS, catName, fmt, mmss, toFill } from './context'
import { DIMS, KIND_TEXT, SHORT, isCoachable, score, starText, tailText, tip } from './score'

const coachMode = atom({ plugin: 'thai-prompt-kit', key: 'coachMode' } as const, 'on')
const draft = atom({ plugin: 'thai-prompt-kit', key: 'draft' } as const, null)
const lastText = atom({ plugin: 'thai-prompt-kit', key: 'lastText' } as const, null)
const scored = atom({ plugin: 'thai-prompt-kit', key: 'scored' } as const, 0)
const starSum = atom({ plugin: 'thai-prompt-kit', key: 'starSum' } as const, 0)
const fill = atom({ plugin: 'thai-prompt-kit', key: 'fill' } as const, null)
const ctxHidden = atom({ plugin: 'thai-prompt-kit', key: 'ctxHidden' } as const, false)
const cache = atom({ plugin: 'thai-prompt-kit', key: 'cache' } as const, null)
const endsAt = atom({ plugin: 'thai-prompt-kit', key: 'endsAt' } as const, null)

async function refresh($: EngineInterface) {
  try {
    const { context } = await $.session.usage({ breakdown: 'summary' })
    const f = toFill(context.breakdown)
    if (f !== null) await update($, fill, () => f)
  } catch {
    // no usage before the session binds; the next turn.complete retries
  }
}

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
    await $.command.register({
      name: 'th-context',
      description: 'ซ่อนหรือแสดงแถบ context (การใช้ context window และเวลา prompt cache) เหนือช่องพิมพ์',
    })
    await refresh($)
    $.clock.every(1000, async () => {
      const end = await read($, endsAt)
      if (end === null) return
      const left = Math.max(0, Math.ceil((end - (await $.clock.now())) / 1000))
      await update($, cache, () => left)
      if (left === 0) await update($, endsAt, () => null) // cold: stop redrawing every second
    })
    return next(e)
  })

  on('turn.complete', async ($, e, next) => {
    const end = (await $.clock.now()) + TTL_MS
    await update($, endsAt, () => end)
    await update($, cache, () => TTL_MS / 1000)
    await refresh($)
    return next(e)
  })

  on('command.run', { command: 'th-context' }, async $ => {
    const wasHidden = await read($, ctxHidden)
    await update($, ctxHidden, () => !wasHidden)
    if (wasHidden) await refresh($)
    return { text: wasHidden ? 'แสดงแถบ context แล้ว' : 'ซ่อนแถบ context แล้ว (/th-context เพื่อแสดง)' }
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
    if (!same(s, await read($, draft))) {
      await update($, draft, () => s)
      // the terminal's hint row is not drawn again for a state change alone while one types (it
      // kept the first key's score), so ask for it; the engine folds calls past 30 a second
      $.ui.invalidate('ui.render')
    }
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
    await update($, endsAt, () => null)
    await update($, cache, () => 'live' as const)
    return next(e)
  })

  // the terminal: the stars ride the end of the hint row under the prompt, a line of their own
  on('ui.render', { component: 'PromptHint' }, async ($, e, next) => {
    if (e.surface !== 'terminal') return next(e)
    const mode = await read($, coachMode)
    const s = await read($, draft)
    if (mode === 'off' || s === null || !e.props.isDraft) return next(e)
    return next({ ...e, props: { ...e.props, tail: tailText(s) } })
  })

  // the band above the prompt: the context window on top, and on the desktop the stars under it.
  // One plugin's tree is drawn here, so both parts are drawn by this one hook (the context part
  // adapted from context-bar by Boom-Vitt, MIT); with neither to show, the band is left to others.
  on('ui.render', { component: 'AbovePrompt' }, async ($, e, next) => {
    if (e.props.hasSurvey) return next(e)
    const f = await read($, fill)
    const isCtxShown = f !== null && !(await read($, ctxHidden))
    const mode = await read($, coachMode)
    const s = e.surface === 'terminal' || mode === 'off' ? null : await read($, draft)
    if (!isCtxShown && s === null) return next(e)

    const c = await read($, cache)
    const { Box, Text } = $.ui.resolve(e)
    // the box the band draws into (narrower than the viewport beside a docked pane)
    const width = Math.max(24, (e.props.bodyColumns ?? 80) - 2)
    const hint = s === null ? null : tip(s)

    return (
      <Box flexDirection="column" width={width}>
        {isCtxShown && f !== null && (() => {
          const sum = f.cats.reduce((a, k) => a + k.tokens, 0) || 1
          // ponytail: fixed 70/85 thresholds, make them options if they need tuning
          const pctTone = f.pct >= 85 ? 'red' : f.pct >= 70 ? 'yellow' : 'green'
          const cacheTone = c === 'live' || (c !== null && c > 60) ? 'green' : c === 0 ? 'red' : 'yellow'
          return (
            <Box flexDirection="column" width={width}>
              <Box width={width} flexWrap="wrap" justifyContent="space-between">
                <Box>
                  <Text bold>◆ context</Text>
                  {c !== null && <Text color={cacheTone}>  ⏱ cache {c === 'live' ? 'live' : c === 0 ? 'cold' : mmss(c)}</Text>}
                </Box>
                <Box>
                  <Text bold>{fmt(f.total)}</Text>
                  <Text dimColor> of {fmt(f.window)}</Text>
                  {f.compactAt !== null && <Text dimColor> · compacts at {fmt(f.compactAt)} </Text>}
                  <Text color={pctTone} inverse bold> {Math.round(f.pct)}% </Text>
                </Box>
              </Box>
              {/* colour blocks sized by flex, not by glyph count: a glyph's advance differs per surface */}
              <Box width={width} height={1} overflow="hidden">
                {f.cats
                  .filter(k => k.tokens > 0)
                  .map(k => (
                    <Box key={k.name} flexGrow={Math.max(1, Math.round((k.tokens / sum) * 1000))} minWidth={1} height={1} backgroundColor={k.color} />
                  ))}
              </Box>
              <Box width={width} flexWrap="wrap">
                {f.cats.map(k => (
                  <Box key={k.name} marginRight={2}>
                    <Text color={k.color}>■ </Text>
                    <Text dimColor>{catName(k.name)} </Text>
                    <Text bold>{fmt(k.tokens)}</Text>
                  </Box>
                ))}
              </Box>
            </Box>
          )
        })()}
        {s !== null && (
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
        )}
        {s !== null && mode === 'on' && hint !== null && <Text dimColor wrap="truncate-end">💡 {hint}</Text>}
      </Box>
    )
  })
}
