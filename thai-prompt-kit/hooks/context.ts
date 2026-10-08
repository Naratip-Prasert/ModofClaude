// The context window breakdown and the prompt-cache countdown, drawn in the same band as the
// prompt stars so neither hides the other (the band above the prompt holds one plugin's tree).
// Adapted from context-bar 0.4.0 by Boom-Vitt (MIT License, Copyright (c) 2026 Boom-Vitt),
// https://github.com/Boom-Vitt/claude-mods-boombignose

import type { Fill } from '../types'

// ponytail: fixed 5-minute prompt-cache TTL; set 3_600_000 if the session uses the 1h cache
export const TTL_MS = 5 * 60 * 1000

export const fmt = (n: number) =>
  n >= 1e6 ? `${+(n / 1e6).toFixed(1)}M` : n >= 1e4 ? `${Math.round(n / 1e3)}k` : n >= 1e3 ? `${(n / 1e3).toFixed(1)}k` : `${n}`

const SHORT_CAT: Record<string, string> = {
  'system prompt': 'prompt',
  'system tools': 'tools',
  'mcp tools': 'mcp',
  'mcp server instructions': 'mcp instr',
  'custom agents': 'agents',
  'memory files': 'memory',
  messages: 'msgs',
  'autocompact buffer': 'buffer',
  'free space': 'free',
}
export const catName = (name: string) => SHORT_CAT[name.toLowerCase()] ?? name.toLowerCase()

export const mmss = (s: number) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`

// the usage breakdown as the band draws it, from what $.session.usage returned
export type Breakdown = {
  categories?: { name: string; tokens: number; color: string; kind: string; isDeferred?: boolean }[]
  totalTokens: number
  rawMaxTokens: number
  percentage: number
}
export function toFill(b: Breakdown | undefined): Fill | null {
  if (!b) return null
  const cats = (b.categories ?? [])
    .filter(c => !c.isDeferred)
    .map(({ name, tokens, color, kind }) => ({ name, tokens, color, kind }))
  const buffer = cats.find(c => c.kind === 'buffer')
  return {
    cats,
    total: b.totalTokens,
    window: b.rawMaxTokens,
    pct: b.percentage,
    compactAt: buffer ? b.rawMaxTokens - buffer.tokens : null,
  }
}
