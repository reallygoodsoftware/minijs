import { describe, expect, test } from 'vitest'
import dedent from 'dedent-js'
import { Lexer } from '../../generators/lexer'

describe('Lexer: Assignments', () => {
  test('Lexer.identifiers: gets identifiers from assignments', () => {
    const lexer = new Lexer('showSearch = false')
    expect(lexer.identifiers).toEqual(['showSearch'])
  })

  test('Lexer.output: replaces identifiers in assignments', () => {
    const lexer = new Lexer('showSearch = false')
    lexer.replace({ showSearch: 'proxyWindow-showSearch' })
    expect(lexer.output()).toBe('proxyWindow.showSearch = false;')
  })
})
