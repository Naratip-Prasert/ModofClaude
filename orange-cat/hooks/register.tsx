import { atom, read, update } from 'claude-code'
import type { Register } from 'claude-code'

import { AREA_ROWS, BUBBLES, JUMP, SPRITE_W, position, sprite } from './cat'

const PANE = 'orange-cat'
const tick = atom({ plugin: 'orange-cat', key: 'tick' } as const, 0)
const jumpAt = atom({ plugin: 'orange-cat', key: 'jumpAt' } as const, null)
const errors = atom({ plugin: 'orange-cat', key: 'errors' } as const, 0)
// in $.state, not a module variable: a hot reload keeps it
const isOpen = atom({ plugin: 'orange-cat', key: 'isOpen' } as const, false)

const ORANGE = '#ff8c1a'
const FRAME_MS = 180

export const register: Register = on => {
  on('session.start', async ($, e, next) => {
    await $.command.register({ name: 'cat', description: 'เปิดหรือปิดแผงแมวส้ม (แมวกระโดดเมื่อมี error)' })
    $.clock.every(FRAME_MS, async () => {
      if (!(await read($, isOpen))) return // no pane, no redraws
      const t = (await read($, tick)) + 1
      await update($, tick, () => t)
      const j = await read($, jumpAt)
      if (j !== null && t - j >= JUMP.length) await update($, jumpAt, () => null)
    })
    return next(e)
  })

  // any tool that reports an error (a failing Bash command, a refused edit...) scares the cat
  on('tool.call', async ($, e, next) => {
    const ran = await next(e)
    if (ran.isError === true) {
      const t = await read($, tick)
      await update($, jumpAt, () => t)
      await update($, errors, n => n + 1)
    }
    return ran
  })

  on('command.run', { command: 'cat' }, async $ => {
    if (await read($, isOpen)) {
      await $.ui.close({ id: PANE })
      await update($, isOpen, () => false)
      return { text: '🐈 แมวส้มไปนอนแล้ว (พิมพ์ /cat เพื่อปลุก)' }
    }
    await $.ui.open({ id: PANE, title: 'แมวส้ม 🐈' })
    await update($, isOpen, () => true)
    return { text: '🐈 แมวส้มออกมาวิ่งแล้ว' }
  })

  on('ui.close', async ($, e, next) => {
    if (e.id === PANE) await update($, isOpen, () => false)
    return next(e)
  })

  on('ui.render', { component: 'Pane', requestId: PANE }, async ($, e) => {
    const t = await read($, tick)
    const j = await read($, jumpAt)
    const nErr = await read($, errors)
    const { Box, Text } = $.ui.resolve(e)

    const width = Math.max(SPRITE_W + 2, (e.props.bodyColumns ?? 40) - 1)
    const isJumping = j !== null && t - j < JUMP.length
    // freeze in place mid-jump so the leap reads clearly
    const { x, goingRight } = position(isJumping ? (j ?? t) : t, width - SPRITE_W)
    const lift = isJumping ? (JUMP[t - (j ?? t)] ?? 0) : 0
    const cat = sprite(goingRight, isJumping, t)
    const pad = ' '.repeat(x)

    // rows top to bottom: blanks above, the cat, blanks for the lift below
    const top = AREA_ROWS - cat.length - lift
    const rows: string[] = [...Array(top).fill(''), ...cat.map(l => pad + l), ...Array(lift).fill('')]
    const bubble = isJumping ? `${BUBBLES[nErr % BUBBLES.length]} (${nErr})` : null

    return (
      <Box flexDirection="column" width={width}>
        <Box height={1} width={width}>
          {bubble !== null ? (
            <Text color="red" bold wrap="truncate-end">💥 {bubble}</Text>
          ) : (
            <Text dimColor wrap="truncate-end">วิ่งเล่นอยู่… error ไปแล้ว {nErr} ครั้ง</Text>
          )}
        </Box>
        {rows.map((r, i) => (
          <Box key={`r${i}`} height={1} width={width} overflow="hidden">
            <Text color={ORANGE} wrap="truncate-end">{r || ' '}</Text>
          </Box>
        ))}
        <Text dimColor wrap="truncate-end">{'─'.repeat(width)}</Text>
      </Box>
    )
  })
}
