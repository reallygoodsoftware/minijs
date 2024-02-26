import { describe, expect, test } from 'vitest'
import dedent from 'dedent-js'
import { Lexer } from '../../generators/lexer'

describe('Lexer: Support for $ as document.querySelector', () => {
  test('Lexer.output: replace $ with document.querySelector', () => {
    const lexer = new Lexer('$')
    lexer.replace({ $: 'document-querySelector' })
    expect(lexer.output()).toBe('document.querySelector;')
  })

  test('Lexer.output: $ function call', () => {
    const lexer = new Lexer('$("a")')
    lexer.replace({ $: 'document-querySelector' })
    expect(lexer.output()).toBe("document.querySelector('a');")
  })

  test('Lexer.output: $ function call with chain methods', () => {
    const lexer = new Lexer(`
      $('#months').scrollBy({ top: 0, left: -SCROLL_OFFSET, behavior: 'smooth' });
      scrollPosition = $('#months').scrollLeft <= SCROLL_OFFSET
        ? 'left'
        : 'middle';
    `)
    lexer.replace({
      $: 'document-querySelector',
      SCROLL_OFFSET: 'proxyWindow-SCROLL_OFFSET',
    })
    expect(lexer.output()).toBe(dedent`
      document.querySelector('#months').scrollBy({
          top: 0,
          left: -proxyWindow.SCROLL_OFFSET,
          behavior: 'smooth'
      });
      scrollPosition = document.querySelector('#months').scrollLeft <= proxyWindow.SCROLL_OFFSET ? 'left' : 'middle';`)
  })
})
