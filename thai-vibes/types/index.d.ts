export type Stats = { startedAt: number; prompts: number; turns: number }

declare module 'claude-code' {
  interface PluginState {
    'thai-vibes': { stats: Stats | null; now: number; proverb: number; isQuiet: boolean; lastNudge: number }
  }
}
