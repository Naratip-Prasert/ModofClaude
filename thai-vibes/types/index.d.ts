export type Stats = { startedAt: number; prompts: number; turns: number; lastActiveAt: number }
export type Streak = { days: number; best: number }

declare module 'claude-code' {
  interface PluginState {
    'thai-vibes': {
      stats: Stats | null
      // the clock as of the last tick, so the pane redraws each tick
      now: number
      proverb: number
      isQuiet: boolean
      lastNudge: number
      isOpen: boolean
      // animation frame of the elephant, advanced while the pane is open
      frame: number
      // the elephant sprays water until this time
      sprayUntil: number
      streak: Streak | null
      // a festival key to show instead of today's, for /vibes theme <name>
      themeOverride: string | null
    }
  }
}
