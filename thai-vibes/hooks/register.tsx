import { atom, read, update } from 'claude-code'
import type { EngineInterface, Register } from 'claude-code'

import { MOOD_TEXT, dayKey, elephant, keepRecent, streakOf } from './elephant'
import type { Mood } from './elephant'
import { FESTIVALS, festival, moon } from './sky'
import { DAY_COLOR, MILESTONES, PROVERBS, WAITING, clock, duration, greeting, isLate, thaiDate } from './thai'

const PANE = 'thai-vibes'
const stats = atom({ plugin: 'thai-vibes', key: 'stats' } as const, null)
const now = atom({ plugin: 'thai-vibes', key: 'now' } as const, 0)
const proverb = atom({ plugin: 'thai-vibes', key: 'proverb' } as const, 0)
const isQuiet = atom({ plugin: 'thai-vibes', key: 'isQuiet' } as const, false)
const lastNudge = atom({ plugin: 'thai-vibes', key: 'lastNudge' } as const, 0)
const isOpen = atom({ plugin: 'thai-vibes', key: 'isOpen' } as const, false)
const frame = atom({ plugin: 'thai-vibes', key: 'frame' } as const, 0)
const sprayUntil = atom({ plugin: 'thai-vibes', key: 'sprayUntil' } as const, 0)
const streak = atom({ plugin: 'thai-vibes', key: 'streak' } as const, null)
const themeOverride = atom({ plugin: 'thai-vibes', key: 'themeOverride' } as const, null)

const RAINBOW = ['red', 'yellow', 'green', 'cyan', 'blue', 'magenta']
const HOUR = 60 * 60 * 1000
const IDLE_MS = 10 * 60 * 1000 // no prompt for this long and the elephant dozes off
const SPRAY_MS = 5000
const FRAME_MS = 700

async function festivalNow($: EngineInterface, t: number) {
  const key = await read($, themeOverride)
  return key === null ? festival(t) : (FESTIVALS[key] ?? null)
}

async function tick($: EngineInterface) {
  const t = await $.clock.now()
  await update($, now, () => t)
  const d = new Date(t)
  const g = greeting(d.getHours())
  const fest = await festivalNow($, t)
  const s = await read($, streak)
  $.ui.status(
    `${g.icon} ${g.text} · ${thaiDate(d)} · ${clock(d)} · ${moon(t).icon}` +
      (fest ? ` ${fest.icons}` : '') +
      (s && s.days >= 2 ? ` · 🔥${s.days}` : ''),
  )

  // a gentle nudge at most once an hour after 23:00
  if (isLate(d.getHours()) && !(await read($, isQuiet)) && t - (await read($, lastNudge)) > HOUR) {
    await update($, lastNudge, () => t)
    $.ui.toast('🦉 ดึกแล้วนะ พักสายตา ดื่มน้ำสักแก้ว แล้วค่อยลุยต่อ')
  }
}

// today joins the days in the store (kept across sessions); a new day that extends the run is cheered
async function markToday($: EngineInterface) {
  const today = dayKey(new Date(await $.clock.now()))
  const raw = await $.store.get('days')
  const days = Array.isArray(raw) ? raw.filter((x): x is string => typeof x === 'string') : []
  const isNewDay = !days.includes(today)
  const next = keepRecent([...days, today])
  const n = streakOf(next, today)
  const best = Math.max(n, Number((await $.store.get('best')) ?? 0))
  if (isNewDay) {
    await $.store.set('days', next)
    await $.store.set('best', best)
  }
  await update($, streak, () => ({ days: n, best }))
  if (isNewDay && n >= 2 && !(await read($, isQuiet))) $.ui.toast(`🔥 เขียนโค้ด ${n} วันติดแล้ว! สถิติสูงสุด ${best} วัน`)
}

export const register: Register = on => {
  on('session.start', async ($, e, next) => {
    await $.command.register({ name: 'vibes', description: 'แผง Thai Vibes · /vibes theme <ชื่อ|off|list> ลองธีมเทศกาล' })
    await $.command.register({ name: 'vibes-quiet', description: 'Thai Vibes: ปิด/เปิดการแจ้งเตือนฉลอง streak และเตือนตอนดึก' })
    const t = await $.clock.now()
    await update($, stats, cur => cur ?? { startedAt: t, prompts: 0, turns: 0, lastActiveAt: t })
    // proverb of the day: same all day, changes at midnight
    await update($, proverb, () => Math.floor(t / (24 * HOUR)) % PROVERBS.length)
    await markToday($)
    await tick($)
    $.clock.every(30_000, () => tick($))
    // the elephant moves only while someone can see it
    $.clock.every(FRAME_MS, async () => {
      if (!(await read($, isOpen))) return
      const t = await $.clock.now()
      await update($, frame, f => f + 1)
      await update($, now, () => t)
    })
    return next(e)
  })

  on('prompt.submit', async ($, e, next) => {
    const t = await $.clock.now()
    await update($, stats, s => (s ? { ...s, prompts: s.prompts + 1, lastActiveAt: t } : s))
    await markToday($)
    return next(e)
  })

  on('turn.complete', async ($, e, next) => {
    const t = await $.clock.now()
    await update($, stats, s => (s ? { ...s, turns: s.turns + 1, lastActiveAt: t } : s))
    await update($, sprayUntil, () => t + SPRAY_MS)
    const s = await read($, stats)
    if (s && MILESTONES.includes(s.turns) && !(await read($, isQuiet))) {
      $.ui.toast(`🎉 ครบ ${s.turns} รอบแล้ว! เก่งมาก 🐘✨`)
    }
    return next(e)
  })

  // Thai waiting lines instead of "Thinking…". On the desktop the word says what the step is
  // doing, so it is replaced only while it says nothing ("Working"); a state message is never touched.
  on('ui.render', { component: 'Spinner' }, async ($, e, next) => {
    if (e.props.message !== null) return next(e)
    if (e.surface === 'desktop' && e.props.word !== 'Working') return next(e)
    const turns = (await read($, stats))?.turns ?? 0
    const word = WAITING[turns % WAITING.length] ?? e.props.word
    return next({ ...e, props: { ...e.props, word } })
  })

  on('command.run', { command: 'vibes-quiet' }, async $ => {
    const was = await read($, isQuiet)
    await update($, isQuiet, () => !was)
    return { text: was ? 'Thai Vibes: เปิดการแจ้งเตือนแล้ว 🔔' : 'Thai Vibes: โหมดเงียบ 🔕 ไม่ฉลอง ไม่เตือนตอนดึก' }
  })

  on('command.run', { command: 'vibes' }, async ($, e) => {
    const [head = '', arg = ''] = e.args.trim().toLowerCase().split(/\s+/)
    if (head === 'theme') {
      const list = Object.values(FESTIVALS).map(f => `${f.key} ${f.icons} ${f.name}`).join('\n')
      if (arg === 'off' || arg === '') {
        await update($, themeOverride, () => null)
        await tick($)
        return { text: `กลับไปใช้ธีมตามวันจริงแล้ว\nลองธีมอื่น: /vibes theme <ชื่อ>\n${list}` }
      }
      const f = FESTIVALS[arg]
      if (!f) return { text: `ไม่รู้จักธีม "${arg}" ลองชื่อเหล่านี้:\n${list}` }
      await update($, themeOverride, () => f.key)
      await tick($)
      return { text: `ลองธีม ${f.icons} ${f.name} แล้ว (/vibes theme off เพื่อกลับ)` }
    }

    if (await read($, isOpen)) {
      await $.ui.close({ id: PANE })
      await update($, isOpen, () => false)
      return { text: 'ปิดแผง Thai Vibes แล้ว' }
    }
    await tick($)
    await $.ui.open({ id: PANE, title: 'Thai Vibes' })
    await update($, isOpen, () => true)
    return { text: 'เปิดแผง Thai Vibes แล้ว 🐘' }
  })

  on('ui.close', async ($, e, next) => {
    if (e.id === PANE) await update($, isOpen, () => false)
    return next(e)
  })

  on('ui.render', { component: 'Pane', requestId: PANE }, async ($, e) => {
    const { Box, Button, Text } = $.ui.resolve(e)
    const t = await read($, now)
    const f = await read($, frame)
    const s = await read($, stats)
    const st = await read($, streak)
    const spray = await read($, sprayUntil)
    const [saying, meaning] = PROVERBS[(await read($, proverb)) % PROVERBS.length] ?? ['', '']
    const d = new Date(t)
    const g = greeting(d.getHours())
    const dayColor = DAY_COLOR[d.getDay()] ?? 'white'
    const m = moon(t)
    const fest = await festivalNow($, t)
    const bar = fest?.colors ?? RAINBOW

    const mood: Mood =
      t < spray ? 'spray' : isLate(d.getHours()) || (s !== null && t - (s.lastActiveAt ?? s.startedAt) > IDLE_MS) ? 'sleepy' : 'happy'
    const ele = elephant(mood, f)

    return (
      <Box flexDirection="column">
        <Box height={1} overflow="hidden">
          {bar.map((c, i) => (
            <Box key={`b${i}`} flexGrow={1} height={1} backgroundColor={bar[(i + f) % bar.length] ?? c} />
          ))}
        </Box>

        {fest !== null && (
          <Box marginTop={1}>
            <Text color={fest.colors[0]} bold wrap="wrap">{fest.icons} {fest.greet}</Text>
          </Box>
        )}

        <Box marginTop={1} justifyContent="space-between">
          <Text bold>{g.icon} {g.text}</Text>
          <Text color={dayColor} bold>{clock(d)}</Text>
        </Box>
        <Text dimColor>{thaiDate(d)} · <Text color={dayColor}>■</Text> สีประจำวัน</Text>
        <Text>
          {m.icon} <Text dimColor>{m.lunar}</Text>
          {m.isHolyDay && <Text color="yellow"> · 🙏 ≈ วันพระ</Text>}
        </Text>

        <Box marginTop={1} flexDirection="column">
          {ele.lines.map((line, i) => (
            <Text key={`e${i}`} color={RAINBOW[(i + f) % RAINBOW.length]}>
              {line}
              {i === 0 && ele.extra !== '' && <Text color={mood === 'spray' ? 'cyan' : 'gray'}> {ele.extra}</Text>}
            </Text>
          ))}
          <Text dimColor>{MOOD_TEXT[mood]}</Text>
        </Box>

        {st !== null && (
          <Box marginTop={1}>
            <Text>
              🔥 เขียนโค้ด <Text bold color="yellow">{st.days}</Text> วันติด
              <Text dimColor> · สถิติสูงสุด {st.best} วัน</Text>
            </Text>
          </Box>
        )}

        <Box marginTop={1} flexDirection="column">
          <Text color="yellow" bold>📜 สุภาษิตวันนี้</Text>
          <Text bold>“{saying}”</Text>
          <Text dimColor wrap="wrap">💻 {meaning}</Text>
          <Box marginTop={1}>
            <Button
              key="next-proverb"
              label="🎲 สุ่มสุภาษิตใหม่"
              dimColor
              onPress={async () => {
                await update($, proverb, p => (p + 1 + Math.floor(Math.random() * (PROVERBS.length - 1))) % PROVERBS.length)
              }}
            />
          </Box>
        </Box>

        {s !== null && (
          <Box marginTop={1} flexDirection="column">
            <Text color="cyan" bold>📊 เซสชันนี้</Text>
            <Text>⏱  ทำงานมา <Text bold>{duration(Math.max(0, t - s.startedAt))}</Text></Text>
            <Text>💬 ส่งพรอมต์ <Text bold>{s.prompts}</Text> ครั้ง · ✅ เสร็จ <Text bold>{s.turns}</Text> รอบ</Text>
            <Text dimColor>ฉลองถัดไปที่ {MILESTONES.find(x => x > s.turns) ?? '∞'} รอบ 🎉</Text>
          </Box>
        )}

        <Box marginTop={1}>
          <Text dimColor>/vibes ปิด · /vibes theme ลองธีมเทศกาล · /vibes-quiet ปิดเสียงเตือน</Text>
        </Box>
      </Box>
    )
  })
}
