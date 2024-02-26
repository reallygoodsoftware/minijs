import { describe, expect, test } from 'vitest'
import dedent from 'dedent-js'
import { Lexer } from '../../generators/lexer'

describe('Lexer: Errors', () => {
  test('Lexer: throws a syntax error', () => {
    expect(() => new Lexer('a +')).toThrow(dedent`
      Failed to parse code

      a +

      SyntaxError: Unexpected token (1:3)`)
  })
})
