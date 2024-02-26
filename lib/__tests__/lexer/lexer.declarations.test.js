import { describe, expect, test } from 'vitest'
import dedent from 'dedent-js'
import { Lexer } from '../../generators/lexer'

describe('Lexer: Variable Declaration', () => {
  test('Lexer.identifiers: ignore declared variables', () => {
    const lexer = new Lexer('let a = 2; console.log(a, b)')
    expect(lexer.identifiers).toEqual(['b'])
  })

  test('Lexer.output: prevent variable replacement for declared variables', () => {
    const lexer = new Lexer('let a = 2; console.log(a, b)')
    lexer.replace({ a: 'proxyWindow-a', b: 'proxyWindow-b' })
    expect(lexer.output()).toBe(dedent`
      let a = 2;
      console.log(a, proxyWindow.b);
    `)
  })
})
