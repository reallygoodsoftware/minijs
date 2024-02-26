import { describe, expect, test } from 'vitest'
import dedent from 'dedent-js'
import { Lexer } from '../../generators/lexer'

describe('Lexer: Block Statements', () => {
  test('Lexer.identifiers: ignore declared variables in block statements', () => {
    const lexer = new Lexer('{ let a = 2 }')
    expect(lexer.identifiers).toEqual([])
  })

  test('Lexer.output: ignore declared variables in block statements', () => {
    const lexer = new Lexer('{ let a = 2 }')
    lexer.replace({ a: 'proxyWindow-a' })
    expect(lexer.output()).toBe('{ let a = 2 }')
  })

  test('Lexer.identifiers: gets identifiers from block statements', () => {
    const lexer = new Lexer('{ a + b }')
    expect(lexer.identifiers).toEqual(['a', 'b'])
  })

  test('Lexer.output: replaces identifiers in block statements', () => {
    const lexer = new Lexer('{ a + b }')
    lexer.replace({ a: 'proxyWindow-a', b: 'proxyWindow-b' })
    expect(lexer.output()).toBe(dedent`
      {
          proxyWindow.a + proxyWindow.b;
      }
    `)
  })
})
