import { describe, expect, test } from 'vitest'
import dedent from 'dedent-js'
import { Lexer } from '../../generators/lexer'

describe('Lexer: Expressions', () => {
  test('Lexer.identifiers: gets identifiers from a simple expression', () => {
    const lexer = new Lexer('a + b')
    expect(lexer.identifiers).toEqual(['a', 'b'])
  })

  test('Lexer.output: replaces identifiers in a simple expression', () => {
    const lexer = new Lexer('a + b')
    lexer.replace({ a: 'proxyWindow-a', b: 'proxyWindow-b' })
    expect(lexer.output()).toBe('proxyWindow.a + proxyWindow.b;')
  })

  test('Lexer.identifiers: gets identifiers from a complex expression', () => {
    const lexer = new Lexer('a + b * c')
    expect(lexer.identifiers).toEqual(['a', 'b', 'c'])
  })

  test('Lexer.output: replaces identifiers in a complex expression', () => {
    const lexer = new Lexer('a + b * c')
    lexer.replace({
      a: 'proxyWindow-a',
      b: 'proxyWindow-b',
      c: 'proxyWindow-c',
    })
    expect(lexer.output()).toBe(
      'proxyWindow.a + proxyWindow.b * proxyWindow.c;'
    )
  })

  test('Lexer.identifiers: gets identifiers from function calls', () => {
    const lexer = new Lexer('getId(a)')
    expect(lexer.identifiers).toEqual(['getId', 'a'])
  })

  test('Lexer.output: replaces identifiers in function calls', () => {
    const lexer = new Lexer('getId(a)')
    lexer.replace({ getId: 'proxyWindow-getId', a: 'proxyWindow-a' })
    expect(lexer.output()).toBe('proxyWindow.getId(proxyWindow.a);')
  })

  test('Lexer.identifiers: gets identifiers from ternaries', () => {
    const lexer = new Lexer(`showSearch ? 'hidden' : ''`)
    expect(lexer.identifiers).toEqual(['showSearch'])
  })

  test('Lexer.output: replaces identifiers in ternaries', () => {
    const lexer = new Lexer(`showSearch ? 'hidden' : ''`)
    lexer.replace({ showSearch: 'proxyWindow-showSearch' })
    expect(lexer.output()).toBe("proxyWindow.showSearch ? 'hidden' : '';")
  })
})
