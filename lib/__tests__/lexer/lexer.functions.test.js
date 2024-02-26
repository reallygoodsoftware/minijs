import { describe, expect, test } from 'vitest'
import dedent from 'dedent-js'
import { Lexer } from '../../generators/lexer'

describe('Lexer: Functions', () => {
  test('Lexer.identifiers: ignore declared variables in function parameters', () => {
    const lexer = new Lexer('function f(a, ...b) { console.log(b) }')
    expect(lexer.identifiers).toEqual([])
  })

  test('Lexer.output: ignore declared variables in function parameters', () => {
    const lexer = new Lexer('function f(a, ...b) { console.log(b) }')
    lexer.replace({ b: 'proxyWindow-b' })
    expect(lexer.output()).toBe('function f(a, ...b) { console.log(b) }')
  })

  test('Lexer.identifiers: ignore arguments variables in functions', () => {
    const lexer = new Lexer('function f(a, ...b) { console.log(arguments) }')
    expect(lexer.identifiers).toEqual([])
  })

  test('Lexer.output: ignore arguments variables in functions', () => {
    const lexer = new Lexer('function f(a, ...b) { console.log(arguments) }')
    lexer.replace({ arguments: 'proxyWindow-arguments' })
    expect(lexer.output()).toBe(
      'function f(a, ...b) { console.log(arguments) }'
    )
  })

  test('Lexer.identifiers: ignore declared function names', () => {
    const lexer = new Lexer('function f() { console.log(arguments) }')
    expect(lexer.identifiers).toEqual([])
  })

  test('Lexer.output: ignore declared function names', () => {
    const lexer = new Lexer('function f() { console.log(arguments) }')
    lexer.replace({ f: 'proxyWindow-f' })
    expect(lexer.output()).toBe('function f() { console.log(arguments) }')
  })
})

describe('Lexer: Function Expressions', () => {
  test('Lexer.identifiers: function expressions', () => {
    const lexer = new Lexer('const f = function() { console.log(arguments) }')
    expect(lexer.identifiers).toEqual([])

    const lexer2 = new Lexer('f = () => console.log(arguments)')
    expect(lexer2.identifiers).toEqual(['f'])
  })

  test('Lexer.output: function expressions', () => {
    const lexer = new Lexer('const f = function() { console.log(arguments) }')
    lexer.replace({ f: 'proxyWindow-f' })
    expect(lexer.output()).toBe(
      'const f = function() { console.log(arguments) }'
    )

    const lexer2 = new Lexer('const f = () => console.log(arguments)')
    lexer2.replace({ f: 'proxyWindow-f' })
    expect(lexer2.output()).toBe('const f = () => console.log(arguments)')
  })
})

describe('Lexer: Arrow Functions', () => {
  test('Lexer.identifiers: declared arrow functions', () => {
    const lexer = new Lexer('const f = () => console.log(arguments)')
    expect(lexer.identifiers).toEqual([])
  })

  test('Lexer.output: declared arrow functions', () => {
    const lexer = new Lexer('const f = () => console.log(arguments)')
    lexer.replace({ f: 'proxyWindow-f' })
    expect(lexer.output()).toBe('const f = () => console.log(arguments)')
  })

  test('Lexer.identifiers: arrow functions', () => {
    const lexer = new Lexer('f = () => console.log(arguments)')
    expect(lexer.identifiers).toEqual(['f'])
  })

  test('Lexer.output: arrow functions', () => {
    const lexer = new Lexer('f = () => console.log(arguments)')
    lexer.replace({ f: 'proxyWindow-f' })
    expect(lexer.output()).toBe('proxyWindow.f = () => console.log(arguments);')
  })

  test('Lexer.output: arrow functions with parameters', () => {
    const lexer = new Lexer('const f = (a, b) => console.log(arguments)')
    lexer.replace({
      f: 'proxyWindow-f',
      arguments: 'proxyWindow-arguments',
      a: 'proxyWindow-a',
      b: 'proxyWindow-b',
    })
    expect(lexer.output()).toBe('const f = (a, b) => console.log(arguments)')

    const lexer2 = new Lexer('f = (a, b) => console.log(arguments)')
    lexer2.replace({
      f: 'proxyWindow-f',
      arguments: 'proxyWindow-arguments',
      a: 'proxyWindow-a',
      b: 'proxyWindow-b',
    })
    expect(lexer2.output()).toBe(
      'proxyWindow.f = (a, b) => console.log(arguments);'
    )
  })
})
