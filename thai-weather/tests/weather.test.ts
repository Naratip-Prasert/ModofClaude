import { expect, test } from 'claude-code/testing'

import { forecastUrl, parseNow, parsePlace, statusLine } from '../hooks/weather'

// trimmed from real Open-Meteo answers, in their shape
const GEO = JSON.stringify({ results: [{ name: 'เชียงใหม่', latitude: 18.79038, longitude: 98.98468, admin1: 'จังหวัดเชียงใหม่' }] })
const FORECAST = JSON.stringify({
  current: { temperature_2m: 32.4, apparent_temperature: 38.9, relative_humidity_2m: 62, weather_code: 0, is_day: 1 },
  hourly: {
    time: ['2026-10-08T13:00', '2026-10-08T14:00', '2026-10-08T15:00', '2026-10-08T16:00'],
    precipitation_probability: [5, 20, 60, 45],
  },
})
const AIR = JSON.stringify({ current: { pm2_5: 28.4 } })

test('a place is read and its coordinates rounded to about a kilometre', async () => {
  expect(parsePlace(GEO)).toEqual({ name: 'เชียงใหม่', lat: 18.79, lon: 98.98 })
  expect(parsePlace(JSON.stringify({}))).toBe(null)
  expect(forecastUrl({ name: 'x', lat: 18.79038, lon: 98.98468 })).toContain('latitude=18.79&longitude=98.98')
})

test('the status line has the sky, the likeliest rain hour and the dust', async () => {
  const n = parseNow(FORECAST, AIR)
  expect(n?.rain).toEqual({ chance: 60, hour: 15 })
  expect(statusLine({ name: 'เชียงใหม่', lat: 0, lon: 0 }, n!)).toBe('☀️ 32° เชียงใหม่ · ☔ ฝน 60% 15 น. · PM2.5 28')
})

test('no rain worth a mention, and no air reading, leave those parts out', async () => {
  const dry = JSON.stringify({ ...JSON.parse(FORECAST), hourly: { time: ['2026-10-08T13:00'], precipitation_probability: [10] } })
  expect(statusLine({ name: 'ภูเก็ต', lat: 0, lon: 0 }, parseNow(dry, null)!)).toBe('☀️ 32° ภูเก็ต')
})

test('/weather set finds the place, keeps it, and puts the forecast in the status line', async ($, on) => {
  const asked: string[] = []
  on('http.fetch', (_$$, e) => {
    asked.push(e.url)
    const text = e.url.includes('geocoding') ? GEO : e.url.includes('air-quality') ? AIR : FORECAST
    return { value: { status: 200, ok: true, headers: {}, text } }
  })
  // the store stands in for the one on disk
  const store = new Map<string, unknown>()
  on('store.get', (_$$, e) => ({ value: store.get(e.key) }))
  on('store.set', (_$$, e) => {
    store.set(e.key, e.value)
    return { value: undefined }
  })
  on('session.start', ($$, e) => ({ cwd: e.cwd }))
  on('command.register', () => ({ value: { command: 'weather' } }))
  await $.session.start({ cwd: '/', surface: 'terminal', isInteractive: true })

  const r = await $.command.run({ command: 'weather', args: 'set เชียงใหม่' })
  expect(r.text).toContain('ตั้งเมืองเป็น เชียงใหม่ แล้ว')
  expect(r.text).toContain('32°')
  // only the place name and rounded coordinates go out
  expect(asked.some(u => u.includes('latitude=18.79&longitude=98.98'))).toBe(true)
})
