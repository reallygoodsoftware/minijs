import { describe, expect, test } from 'vitest'
import dedent from 'dedent-js'
import { Lexer } from '../../generators/lexer'

describe('Lexer: Arrays', () => {
  test('Lexer.identifiers: gets identifiers from arrays', () => {
    const lexer = new Lexer('a = [1, 2, b]')
    expect(lexer.identifiers).toEqual(['a', 'b'])

    const lexer2 = new Lexer('const b = a[0]')
    expect(lexer2.identifiers).toEqual(['a'])
  })

  test('Lexer.output: replaces identifiers in arrays', () => {
    const lexer = new Lexer('const a = [1, 2, b]')
    lexer.replace({ a: 'proxyWindow-a', b: 'proxyWindow-b' })
    expect(lexer.output()).toBe(dedent`
      const a = [
          1,
          2,
          proxyWindow.b
      ];
    `)
  })
})

describe('Lexer: Support for Array Deconstruction', () => {
  test('Lexer.identifiers: gets identifiers from array deconstruction', () => {
    const lexer = new Lexer('const [a, b] = [1, 2]')
    expect(lexer.identifiers).toEqual([])

    const lexer2 = new Lexer('[a, b] = [c, d]')
    expect(lexer2.identifiers).toEqual(['a', 'b', 'c', 'd'])

    const lexer3 = new Lexer(
      'const [startDate, endDate] = getStartAndEndMonth(totalMonths)'
    )
    expect(lexer3.identifiers).toEqual(['getStartAndEndMonth', 'totalMonths'])
  })

  test('Lexer.output: replaces identifiers in array deconstruction', () => {
    const lexer = new Lexer('const [a, b] = [1, 2]')
    lexer.replace({ a: 'proxyWindow-a', b: 'proxyWindow-b' })
    expect(lexer.output()).toBe('const [a, b] = [1, 2]')

    const lexer2 = new Lexer('[a, b] = [c, d]')
    lexer2.replace({
      a: 'proxyWindow-a',
      b: 'proxyWindow-b',
      c: 'proxyWindow-c',
      d: 'proxyWindow-d',
    })
    expect(lexer2.output()).toBe(dedent`
      [proxyWindow.a, proxyWindow.b] = [
          proxyWindow.c,
          proxyWindow.d
      ];`)

    const lexer3 = new Lexer(
      'const [startDate, endDate] = getStartAndEndMonth(totalMonths)'
    )
    lexer3.replace({
      getStartAndEndMonth: 'proxyWindow-getStartAndEndMonth',
      totalMonths: 'proxyWindow-totalMonths',
      startDate: 'proxyWindow-startDate',
      endDate: 'proxyWindow-endDate',
    })
    expect(lexer3.output()).toBe(
      'const [startDate, endDate] = proxyWindow.getStartAndEndMonth(proxyWindow.totalMonths);'
    )
  })
})

describe('Lexer: Array Methods', () => {
  test('Lexer.identifiers: gets identifiers from array with methods', () => {
    const lexer = new Lexer('a.map((a) => a + 1)')
    expect(lexer.identifiers).toEqual(['a'])

    const lexer2 = new Lexer('b = a.previousItem(b)')
    expect(lexer2.identifiers).toEqual(['b', 'a'])
  })

  test('Lexer.output: array methods', () => {
    const lexer = new Lexer('a.map((a) => a + 1)')
    lexer.replace({ a: 'proxyWindow-a' })
    expect(lexer.output()).toBe('proxyWindow.a.map(a => a + 1);')

    const lexer2 = new Lexer('b = a.previousItem(b)')
    lexer2.replace({ a: 'proxyWindow-a', b: 'proxyWindow-b' })
    expect(lexer2.output()).toBe(
      'proxyWindow.b = proxyWindow.a.previousItem(proxyWindow.b);'
    )
  })
})

describe('Lexer: Support for Higher Order Functions', () => {
  test('Lexer.identifiers: ignore parameters of higher order functions', () => {
    const lexer = new Lexer(dedent`
      const region = regions.find((region) => region.name === destination)
      if (region) selectedDestination = region.name
      else selectedDestination = null`)
    expect(lexer.identifiers).toEqual([
      'regions',
      'destination',
      'selectedDestination',
    ])
  })

  test("Lexer.output: prevent replacement of higher order function's parameters", () => {
    const lexer = new Lexer(
      'regions.find((region) => region.name === destination)'
    )
    lexer.replace({
      regions: 'proxyWindow.regions',
      destination: 'proxyWindow.destination',
      region: 'proxyWindow-region',
    })
    expect(lexer.output()).toBe(
      'proxyWindow.regions.find(region => region.name === proxyWindow.destination);'
    )
  })
})
