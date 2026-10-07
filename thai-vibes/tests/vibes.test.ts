import { expect, test } from 'claude-code/testing'

import { elephant, streakOf } from '../hooks/elephant'
import { festival, moon } from '../hooks/sky'

const at = (y: number, m: number, d: number, h = 12) => new Date(y, m - 1, d, h).getTime()

test('the moon: a known full moon and a known new moon', async () => {
  // full moon 2024-04-23 23:49 UTC, new moon 2024-04-08 18:21 UTC
  expect(moon(Date.UTC(2024, 3, 23, 23)).icon).toBe('🌕')
  expect(moon(Date.UTC(2024, 3, 8, 18)).icon).toBe('🌑')
  expect(moon(Date.UTC(2024, 3, 23, 23)).lunar).toBe('ขึ้น 15 ค่ำ')
})

test('fixed festivals fall on their days', async () => {
  expect(festival(at(2026, 4, 14))?.key).toBe('songkran')
  expect(festival(at(2026, 8, 12))?.key).toBe('mother')
  expect(festival(at(2026, 12, 5))?.key).toBe('father')
  expect(festival(at(2026, 1, 1))?.key).toBe('newyear')
  expect(festival(at(2026, 10, 8))).toBe(null)
})

test('lunar festivals land near their real dates', async () => {
  // Loy Krathong 2024 was 15 Nov; Chinese New Year 2025 was 29 Jan
  expect(festival(at(2024, 11, 15, 20))?.key).toBe('loykrathong')
  expect(festival(at(2025, 1, 29, 12))?.key).toBe('chinese')
})

test('the streak counts back from today, or from yesterday before today is written', async () => {
  expect(streakOf(['2026-10-06', '2026-10-07', '2026-10-08'], '2026-10-08')).toBe(3)
  expect(streakOf(['2026-10-06', '2026-10-07'], '2026-10-08')).toBe(2)
  expect(streakOf(['2026-10-01', '2026-10-08'], '2026-10-08')).toBe(1)
  expect(streakOf(['2026-09-30', '2026-10-01'], '2026-10-01')).toBe(2)
})

test('the elephant flaps, sprays and sleeps', async () => {
  expect(elephant('happy', 0).lines[0]).not.toBe(elephant('happy', 1).lines[0])
  expect(elephant('spray', 0).extra).toContain('💦')
  expect(elephant('sleepy', 2).extra).toBe('zZz')
  // the backslashes survive (an escaped string once ate them)
  expect(elephant('happy', 0).lines.join('')).toContain(String.raw`\_/`)
})
