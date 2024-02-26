import { describe, expect, test } from 'vitest'
import dedent from 'dedent-js'
import { Lexer } from '../../generators/lexer'

describe('Lexer: Support for this as this.element', () => {
  test('Lexer.identifiers: identifies this', () => {
    const lexer = new Lexer('this.value')
    expect(lexer.identifiers).toEqual(['this'])

    const lexer2 = new Lexer('destination = this.value')
    expect(lexer2.identifiers).toEqual(['destination', 'this'])
  })

  test('Lexer.output: replaces this with this.element', () => {
    const lexer = new Lexer('destination = this.value')
    lexer.replace({ this: 'this.element' })
    expect(lexer.output()).toBe('destination = this.element.value;')

    const lexer2 = new Lexer('this.value')
    lexer2.replace({ this: 'this.element' })
    expect(lexer2.output()).toBe('this.element.value;')
  })
})
