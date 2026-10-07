import { atom, read, update } from 'claude-code'
import type { EngineInterface, Register } from 'claude-code'

import type { CoachMode } from '../types'
import { TIPS, isCoachable, score, stars } from './score'

const coachMode = atom({ plugin: 'thai-prompt-kit', key: 'coachMode' } as const, 'on')
const lastStars = atom({ plugin: 'thai-prompt-kit', key: 'lastStars' } as const, null)
const scored = atom({ plugin: 'thai-prompt-kit', key: 'scored' } as const, 0)
const starSum = atom({ plugin: 'thai-prompt-kit', key: 'starSum' } as const, 0)

const MODES: CoachMode[] = ['on', 'quiet', 'off']
const HELP: Record<CoachMode, string> = {
  on: 'on: ให้ดาวทุกพรอมต์ และแนะนำเมื่อได้ 2 ดาวหรือน้อยกว่า',
  quiet: 'quiet: ให้ดาวในแถบสถานะอย่างเดียว ไม่เด้งคำแนะนำ',
  off: 'off: ปิดโค้ช',
}

async function showStatus($: EngineInterface) {
  const mode = await read($, coachMode)
  const s = await read($, lastStars)
  if (mode === 'off') return $.ui.status('')
  $.ui.status(s === null ? '✍️ โค้ชพรอมต์พร้อม' : `✍️ พรอมต์ ${stars(s)}`)
}

export const register: Register = on => {
  on('session.start', async ($, e, next) => {
    await $.command.register({
      name: 'th-coach',
      description: 'โค้ชพรอมต์ภาษาไทย: on | quiet | off (ไม่ใส่ค่า = ดูสถิติ)',
    })
    await showStatus($)
    return next(e)
  })

  on('command.run', { command: 'th-coach' }, async ($, e) => {
    const arg = e.args.trim().toLowerCase()
    const want = MODES.find(m => m === arg)
    if (want) {
      await update($, coachMode, () => want)
      await showStatus($)
      return { text: `โค้ชพรอมต์ → ${HELP[want]}` }
    }
    const n = await read($, scored)
    const avg = n === 0 ? 0 : (await read($, starSum)) / n
    return {
      text: [
        `โหมดปัจจุบัน ${HELP[(await read($, coachMode)) as CoachMode]}`,
        n === 0 ? 'ยังไม่มีพรอมต์ที่ให้คะแนนในเซสชันนี้' : `ให้คะแนนไปแล้ว ${n} พรอมต์ เฉลี่ย ${avg.toFixed(1)} ดาว ${stars(Math.round(avg))}`,
        'เกณฑ์ 5 ดาว: เป้าหมาย · บริบท · ข้อจำกัด · รูปแบบคำตอบ · รายละเอียด',
        `เปลี่ยนโหมดด้วย /th-coach ${MODES.join(' | ')}`,
      ].join('\n'),
    }
  })

  // read-only: the prompt goes through untouched, the coach only looks at it
  on('prompt.submit', async ($, e, next) => {
    const mode = await read($, coachMode)
    if (mode === 'off' || !isCoachable(e.text)) return next(e)
    const s = score(e.text)
    await update($, lastStars, () => s.stars)
    await update($, scored, n => n + 1)
    await update($, starSum, n => n + s.stars)
    await showStatus($)
    if (mode === 'on' && s.stars <= 2) {
      $.ui.toast(`✍️ ${stars(s.stars)} เคล็ดลับ: ${TIPS[s.missing[0]]}`)
    }
    return next(e)
  })
}
