import { describe, expect, test } from 'vitest'
import dedent from 'dedent-js'
import { Lexer } from '../../generators/lexer'

describe('Lexer: Support for this as this.element', () => {
  const lexer = new Lexer('destination = this.value')
  lexer.replace({ this: 'this.element' })
  expect(lexer.output()).toBe('destination = this.element.value;')
})
