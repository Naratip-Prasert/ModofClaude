import { expect, test } from 'claude-code/testing'

import { JUMP, position, sprite } from '../hooks/cat'

test('the cat runs back and forth and faces the way it goes', async () => {
  expect(position(0, 10)).toEqual({ x: 0, goingRight: true })
  expect(position(9, 10)).toEqual({ x: 9, goingRight: true })
  expect(position(12, 10)).toEqual({ x: 8, goingRight: false })
  expect(sprite(true, false, 0)[1]).toContain('~ ')
  expect(sprite(false, false, 0)[1]).toContain(' ~')
})

test('a jump shows the startled face and lands back on the ground', async () => {
  expect(sprite(true, true, 0)[1]).toContain('O.O')
  expect(JUMP[JUMP.length - 1]).toBe(0)
})
