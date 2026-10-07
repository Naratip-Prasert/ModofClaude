export type CoachMode = 'on' | 'quiet' | 'off'

declare module 'claude-code' {
  interface PluginState {
    'thai-prompt-kit': { coachMode: CoachMode; lastStars: number | null; scored: number; starSum: number }
  }
}
