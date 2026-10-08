import { expect, test } from 'claude-code/testing'

// adapted from context-bar's band test (Boom-Vitt, MIT)
const cats = [
  { name: 'System prompt', tokens: 4700, color: 'inactive', isDeferred: false, kind: 'used' },
  { name: 'Messages', tokens: 84000, color: 'permission', isDeferred: false, kind: 'used' },
  { name: 'Free space', tokens: 811000, color: 'promptBorder', isDeferred: false, kind: 'free' },
  { name: 'Autocompact buffer', tokens: 33000, color: 'inactive', isDeferred: false, kind: 'buffer' },
]

test('the band draws the context on terminal and desktop', async ($, on) => {
  on('session.usage', () => ({ value: {
    startedAt: 0,
    context: {
      tokens: 156000,
      window: 1000000,
      percent: 16,
      breakdown: { categories: cats, totalTokens: 156000, maxTokens: 1000000, rawMaxTokens: 1000000, percentage: 16 },
    },
    rateLimits: [],
  } }))
  on('session.start', ($$, e) => ({ cwd: e.cwd }))
  on('command.register', () => ({ value: { command: 'x' } }))
  await $.session.start({ cwd: '/', surface: 'terminal', isInteractive: true })

  for (const surface of ['terminal', 'desktop'] as const) {
    const ui = await $.ui.mount({
      plugin: 'thai-prompt-kit',
      surface,
      component: 'AbovePrompt',
      props: { hasSurvey: false, isWorking: false, maxRows: 10, bodyColumns: 100, scroll: { offset: 0, bodyRows: 10 }, view: {} },
    })
    expect(await ui.find({ type: 'Text', text: /context/ })).toBeDefined()
    expect(await ui.find({ type: 'Text', text: /156k/ })).toBeDefined()
    await ui.unmount()
  }
})
