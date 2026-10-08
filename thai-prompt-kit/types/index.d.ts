export type CoachMode = 'on' | 'quiet' | 'off'
export type Dim = 'goal' | 'context' | 'rules' | 'format' | 'detail'
// each part of a prompt: missing, half there, or there
export type Mark = 0 | 0.5 | 1
// what the prompt asks for decides which parts it needs
export type PromptKind = 'build' | 'ask' | 'quick' | 'review'
export type Score = {
  // the needed parts, scaled to five
  stars: number
  marks: Record<Dim, Mark>
  // needed parts below 1, weakest first
  missing: Dim[]
  // the words each mark was given for, for /th-coach why
  why: Record<Dim, string[]>
  kind: PromptKind
  // parts this kind of prompt does not need: shown, never counted
  optional: Dim[]
}

// the context window breakdown (adapted from context-bar by Boom-Vitt, MIT)
export type Cat = { name: string; tokens: number; color: string; kind: string }
export type Fill = { cats: Cat[]; total: number; window: number; pct: number; compactAt: number | null }
// seconds of prompt cache left; 'live' while a turn runs; null before the first turn
export type Cache = number | 'live' | null

declare module 'claude-code' {
  interface PluginState {
    // draft: the live score of what is in the prompt box now, null when there is nothing to coach
    // lastText: the last prompt sent, for /th-coach why with no text
    // fill, ctxHidden, cache, endsAt: the context section of the band; endsAt is in state so a
    // hot reload keeps the countdown
    'thai-prompt-kit': {
      coachMode: CoachMode
      draft: Score | null
      lastText: string | null
      scored: number
      starSum: number
      fill: Fill | null
      ctxHidden: boolean
      cache: Cache
      endsAt: number | null
    }
  }
}
