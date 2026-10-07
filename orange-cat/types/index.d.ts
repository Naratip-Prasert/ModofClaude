declare module 'claude-code' {
  interface PluginState {
    // tick: animation frame; jumpAt: the tick a jump started, or null; errors: count this session; isOpen: the pane is open
    'orange-cat': { tick: number; jumpAt: number | null; errors: number; isOpen: boolean }
  }
}
