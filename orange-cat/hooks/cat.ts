// Sprites and motion for the cat. Pure functions, no engine calls.

const FACE = { run: '( ^.^ )', jump: '( O.O )' }
// two leg poses alternate while running
// String.raw keeps the backslashes literal
const LEGS = [String.raw`  /   \  `, '   | |   ']
const LEGS_UP = String.raw`  /| |\  `
const EARS_R = String.raw`  /\_/\   `
const EARS_L = String.raw`   /\_/\  `

export const SPRITE_W = 10
export const AREA_ROWS = 5 // 3 rows of cat + up to 2 rows of jump
// rows above the ground, per tick of a jump: up, hang about 2s so it is seen, land
export const JUMP = [1, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 1, 0]

export function sprite(goingRight: boolean, isJumping: boolean, tick: number): string[] {
  const face = isJumping ? FACE.jump : FACE.run
  const legs = isJumping ? LEGS_UP : LEGS[tick % 2] ?? ''
  return goingRight
    ? [EARS_R, ` ${face}~ `, legs]
    : [EARS_L, ` ~${face} `, legs]
}

// back and forth across `span` cells, one cell per tick
export function position(tick: number, span: number): { x: number; goingRight: boolean } {
  const n = Math.max(1, span)
  const p = tick % (2 * n)
  return p < n ? { x: p, goingRight: true } : { x: 2 * n - p, goingRight: false }
}

export const BUBBLES = ['เมี๊ยว! error!', 'แง้ว!! พังอีกแล้ว', 'ฟ่อออ! 🙀', 'เหมียว? บั๊กมาจากไหน']
