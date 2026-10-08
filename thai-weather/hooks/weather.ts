// Open-Meteo URLs, WMO weather codes in Thai, and the status line. Pure functions, no engine calls.
// Open-Meteo is free and needs no key: https://open-meteo.com (data CC BY 4.0).

export type Place = { name: string; lat: number; lon: number }

export type Now = {
  temp: number
  feels: number
  humidity: number
  code: number
  isDay: boolean
  // the most likely rain in the next 6 hours, and the hour it falls in
  rain: { chance: number; hour: number } | null
  pm25: number | null
}

// coordinates rounded to 2 decimals (about 1 km): enough for a forecast, no closer than that
const round2 = (n: number) => Math.round(n * 100) / 100

export const geocodeUrl = (name: string, isThaiOnly: boolean) =>
  `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(name)}&count=1&language=th&format=json` +
  (isThaiOnly ? '&countryCode=TH' : '')

export const forecastUrl = (p: Place) =>
  `https://api.open-meteo.com/v1/forecast?latitude=${round2(p.lat)}&longitude=${round2(p.lon)}` +
  '&current=temperature_2m,apparent_temperature,relative_humidity_2m,weather_code,is_day' +
  '&hourly=precipitation_probability&forecast_hours=6&timezone=auto'

export const airUrl = (p: Place) =>
  `https://air-quality-api.open-meteo.com/v1/air-quality?latitude=${round2(p.lat)}&longitude=${round2(p.lon)}&current=pm2_5`

type GeoJson = { results?: { name: string; latitude: number; longitude: number; admin1?: string }[] }

export function parsePlace(text: string): Place | null {
  const r = (JSON.parse(text) as GeoJson).results?.[0]
  return r ? { name: r.name, lat: round2(r.latitude), lon: round2(r.longitude) } : null
}

type ForecastJson = {
  current?: { temperature_2m: number; apparent_temperature: number; relative_humidity_2m: number; weather_code: number; is_day: number }
  hourly?: { time: string[]; precipitation_probability: (number | null)[] }
}

export function parseNow(forecast: string, air: string | null): Now | null {
  const f = JSON.parse(forecast) as ForecastJson
  const c = f.current
  if (!c) return null
  let rain: Now['rain'] = null
  const times = f.hourly?.time ?? []
  ;(f.hourly?.precipitation_probability ?? []).forEach((chance, i) => {
    if (chance !== null && chance >= 40 && (rain === null || chance > rain.chance)) {
      rain = { chance, hour: Number(times[i]?.slice(11, 13) ?? 0) }
    }
  })
  let pm25: number | null = null
  if (air !== null) {
    const v = (JSON.parse(air) as { current?: { pm2_5?: number | null } }).current?.pm2_5
    pm25 = typeof v === 'number' ? Math.round(v) : null
  }
  return {
    temp: Math.round(c.temperature_2m),
    feels: Math.round(c.apparent_temperature),
    humidity: Math.round(c.relative_humidity_2m),
    code: c.weather_code,
    isDay: c.is_day === 1,
    rain,
    pm25,
  }
}

// WMO weather interpretation codes, as Open-Meteo reports them
export function sky(code: number, isDay: boolean): { icon: string; text: string } {
  if (code === 0) return isDay ? { icon: '☀️', text: 'แดดจัด ฟ้าใส' } : { icon: '🌙', text: 'ฟ้าใส' }
  if (code === 1 || code === 2) return isDay ? { icon: '🌤️', text: 'มีเมฆบางส่วน' } : { icon: '🌙', text: 'มีเมฆบางส่วน' }
  if (code === 3) return { icon: '☁️', text: 'เมฆมาก' }
  if (code === 45 || code === 48) return { icon: '🌫️', text: 'หมอก' }
  if (code >= 51 && code <= 57) return { icon: '🌦️', text: 'ฝนปรอยๆ' }
  if (code === 61 || code === 80) return { icon: '🌦️', text: 'ฝนตกเล็กน้อย' }
  if (code === 63 || code === 81) return { icon: '🌧️', text: 'ฝนตก' }
  if (code === 65 || code === 82) return { icon: '🌧️', text: 'ฝนตกหนัก' }
  if (code >= 66 && code <= 77) return { icon: '🌨️', text: 'ลูกเห็บ/หิมะ' }
  if (code >= 95) return { icon: '⛈️', text: 'พายุฝนฟ้าคะนอง' }
  return { icon: '⛅', text: 'มีเมฆ' }
}

// ponytail: one fixed PM2.5 cutoff (µg/m³) for the mask hint; not an official air-quality band
export const dusty = (pm: number) => pm > 75

export function statusLine(place: Place, n: Now): string {
  const s = sky(n.code, n.isDay)
  const parts = [`${s.icon} ${n.temp}° ${place.name}`]
  if (n.rain) parts.push(`☔ ฝน ${n.rain.chance}% ${n.rain.hour} น.`)
  if (n.pm25 !== null) parts.push(`${dusty(n.pm25) ? '😷 ' : ''}PM2.5 ${n.pm25}`)
  return parts.join(' · ')
}

export function report(place: Place, n: Now): string {
  const s = sky(n.code, n.isDay)
  return [
    `${s.icon} ${place.name}: ${n.temp}° ${s.text}`,
    `รู้สึกเหมือน ${n.feels}° · ความชื้น ${n.humidity}%`,
    n.rain ? `☔ ฝนมีโอกาสตก ${n.rain.chance}% ราว ${n.rain.hour}:00 น. พกร่มด้วยนะ` : '☂️ 6 ชั่วโมงข้างหน้าไม่น่ามีฝน',
    n.pm25 === null ? '' : `PM2.5 ${n.pm25} µg/m³${dusty(n.pm25) ? ' 😷 ฝุ่นสูง ใส่หน้ากากถ้าออกไปข้างนอก' : ''}`,
    'ข้อมูลจาก Open-Meteo · อัปเดตทุก 30 นาที',
  ]
    .filter(Boolean)
    .join('\n')
}
