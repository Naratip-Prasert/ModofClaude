import type { EngineInterface, Register } from 'claude-code'

import { DEFAULT_PLACE, airUrl, forecastUrl, geocodeUrl, parseNow, parsePlace, report, statusLine } from './weather'
import type { Now, Place } from './weather'

const EVERY_MS = 30 * 60 * 1000

// the place is kept in this plugin's store on this machine: it never leaves except as the
// rounded coordinates in the forecast request
async function placeOf($: EngineInterface): Promise<Place> {
  const p = (await $.store.get('place')) as Place | undefined
  return p && typeof p.lat === 'number' && typeof p.lon === 'number' ? p : DEFAULT_PLACE
}

async function fetchNow($: EngineInterface, p: Place): Promise<Now | null> {
  const f = await $.http.fetch(forecastUrl(p))
  if (!f.ok) return null
  // the air reading is a nice-to-have: the forecast stands without it
  const a = await $.http.fetch(airUrl(p)).catch(() => null)
  return parseNow(f.text, a?.ok ? a.text : null)
}

async function refresh($: EngineInterface): Promise<string> {
  if ((await $.store.get('isOff')) === true) {
    $.ui.status(undefined)
    return 'ปิดอยู่'
  }
  const p = await placeOf($)
  try {
    const n = await fetchNow($, p)
    if (!n) return 'ดึงพยากรณ์ไม่สำเร็จ'
    $.ui.status(statusLine(p, n))
    return report(p, n)
  } catch {
    // offline: keep the last line rather than flashing an error every half hour
    return 'ต่ออินเทอร์เน็ตไม่ได้ ลองใหม่ภายหลัง'
  }
}

export const register: Register = on => {
  on('session.start', async ($, e, next) => {
    await $.command.register({
      name: 'weather',
      description: 'พยากรณ์อากาศในแถบสถานะ: set <จังหวัด> | off | on (ไม่ใส่ค่า = ดูรายละเอียดตอนนี้)',
    })
    await refresh($)
    $.clock.every(EVERY_MS, () => refresh($))
    return next(e)
  })

  on('command.run', { command: 'weather' }, async ($, e) => {
    const args = e.args.trim()
    const [head = '', ...rest] = args.split(/\s+/)
    const cmd = head.toLowerCase()

    if (cmd === 'off' || cmd === 'on') {
      await $.store.set('isOff', cmd === 'off')
      await refresh($)
      return { text: cmd === 'off' ? 'ปิดพยากรณ์อากาศแล้ว (/weather on เพื่อเปิด)' : 'เปิดพยากรณ์อากาศแล้ว' }
    }

    if (cmd === 'set') {
      const name = rest.join(' ')
      if (!name) return { text: 'ใส่ชื่อจังหวัดหรือเมืองด้วย เช่น /weather set เชียงใหม่' }
      try {
        // Thailand first, then anywhere, so "Phuket" and "Tokyo" both work
        let r = await $.http.fetch(geocodeUrl(name, true))
        let p = r.ok ? parsePlace(r.text) : null
        if (!p) {
          r = await $.http.fetch(geocodeUrl(name, false))
          p = r.ok ? parsePlace(r.text) : null
        }
        if (!p) return { text: `หา "${name}" ไม่เจอ ลองชื่อจังหวัด เช่น เชียงใหม่ หรือ Chiang Mai` }
        await $.store.set('place', p)
        await $.store.set('isOff', false)
        return { text: `ตั้งเมืองเป็น ${p.name} แล้ว\n${await refresh($)}` }
      } catch {
        return { text: 'ต่ออินเทอร์เน็ตไม่ได้ ลองใหม่ภายหลัง' }
      }
    }

    return { text: await refresh($) }
  })
}
