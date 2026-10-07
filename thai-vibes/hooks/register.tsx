import { atom, read, update } from 'claude-code'
import type { EngineInterface, Register } from 'claude-code'

import { DAY_COLOR, ELEPHANT, MILESTONES, PROVERBS, clock, duration, greeting, isLate, thaiDate } from './thai'

const PANE = 'thai-vibes'
const stats = atom({ plugin: 'thai-vibes', key: 'stats' } as const, null)
// in $.state so the pane redraws on each tick
const now = atom({ plugin: 'thai-vibes', key: 'now' } as const, 0)
const proverb = atom({ plugin: 'thai-vibes', key: 'proverb' } as const, 0)
const isQuiet = atom({ plugin: 'thai-vibes', key: 'isQuiet' } as const, false)
const lastNudge = atom({ plugin: 'thai-vibes', key: 'lastNudge' } as const, 0)

const RAINBOW = ['red', 'yellow', 'green', 'cyan', 'blue', 'magenta']
const HOUR = 60 * 60 * 1000

async function tick($: EngineInterface) {
  const t = await $.clock.now()
  await update($, now, () => t)
  const d = new Date(t)
  const g = greeting(d.getHours())
  $.ui.status(`${g.icon} ${g.text} · ${thaiDate(d)} · ${clock(d)}`)

  // a gentle nudge at most once an hour after 23:00
  if (isLate(d.getHours()) && !(await read($, isQuiet)) && t - (await read($, lastNudge)) > HOUR) {
    await update($, lastNudge, () => t)
    $.ui.toast('🦉 ดึกแล้วนะ พักสายตา ดื่มน้ำสักแก้ว แล้วค่อยลุยต่อ')
  }
}

export const register: Register = on => {
  let isOpen = false

  on('session.start', async ($, e, next) => {
    await $.command.register({ name: 'vibes', description: 'เปิด/ปิดแผง Thai Vibes: ช้างน้อย สุภาษิตประจำวัน และสถิติเซสชัน' })
    await $.command.register({ name: 'vibes-quiet', description: 'Thai Vibes: ปิด/เปิดการแจ้งเตือนฉลองและเตือนตอนดึก' })
    const t = await $.clock.now()
    await update($, stats, cur => cur ?? { startedAt: t, prompts: 0, turns: 0 })
    // proverb of the day: same all day, changes at midnight
    await update($, proverb, () => Math.floor(t / (24 * HOUR)) % PROVERBS.length)
    await tick($)
    $.clock.every(30_000, () => tick($))
    return next(e)
  })

  on('prompt.submit', async ($, e, next) => {
    await update($, stats, s => (s ? { ...s, prompts: s.prompts + 1 } : s))
    return next(e)
  })

  on('turn.complete', async ($, e, next) => {
    await update($, stats, s => (s ? { ...s, turns: s.turns + 1 } : s))
    const s = await read($, stats)
    if (s && MILESTONES.includes(s.turns) && !(await read($, isQuiet))) {
      $.ui.toast(`🎉 ครบ ${s.turns} รอบแล้ว! เก่งมาก 🐘✨`)
    }
    return next(e)
  })

  on('command.run', { command: 'vibes-quiet' }, async $ => {
    const was = await read($, isQuiet)
    await update($, isQuiet, () => !was)
    return { text: was ? 'Thai Vibes: เปิดการแจ้งเตือนแล้ว 🔔' : 'Thai Vibes: โหมดเงียบ 🔕 ไม่ฉลอง ไม่เตือนตอนดึก' }
  })

  on('command.run', { command: 'vibes' }, async $ => {
    if (isOpen) {
      await $.ui.close({ id: PANE })
      isOpen = false
      return { text: 'ปิดแผง Thai Vibes แล้ว' }
    }
    await tick($)
    await $.ui.open({ id: PANE, title: 'Thai Vibes' })
    isOpen = true
    return { text: 'เปิดแผง Thai Vibes แล้ว 🐘' }
  })

  on('ui.close', ($, e, next) => {
    if (e.id === PANE) isOpen = false
    return next(e)
  })

  on('ui.render', { component: 'Pane', requestId: PANE }, async ($, e) => {
    const { Box, Button, Text } = $.ui.resolve(e)
    const t = await read($, now)
    const s = await read($, stats)
    const [saying, meaning] = PROVERBS[(await read($, proverb)) % PROVERBS.length]
    const d = new Date(t)
    const g = greeting(d.getHours())
    const dayColor = DAY_COLOR[d.getDay()]

    return (
      <Box flexDirection="column">
        <Box height={1} overflow="hidden">
          {RAINBOW.map(c => (
            <Box key={c} flexGrow={1} height={1} backgroundColor={c} />
          ))}
        </Box>

        <Box marginTop={1} justifyContent="space-between">
          <Text bold>{g.icon} {g.text}</Text>
          <Text color={dayColor} bold>{clock(d)}</Text>
        </Box>
        <Text dimColor>{thaiDate(d)} · <Text color={dayColor}>■</Text> สีประจำวัน</Text>

        <Box marginTop={1} flexDirection="column">
          {ELEPHANT.map((line, i) => (
            <Text key={i} color={RAINBOW[(i + d.getMinutes()) % RAINBOW.length]}>{line}</Text>
          ))}
        </Box>

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
            <Text dimColor>ฉลองถัดไปที่ {MILESTONES.find(m => m > s.turns) ?? '∞'} รอบ 🎉</Text>
          </Box>
        )}

        <Box marginTop={1}>
          <Text dimColor>/vibes ปิดแผง · /vibes-quiet ปิดเสียงเตือน</Text>
        </Box>
      </Box>
    )
  })
}
