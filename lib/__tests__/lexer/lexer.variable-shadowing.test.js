import { describe, expect, test } from 'vitest'
import dedent from 'dedent-js'
import { Lexer } from '../../generators/lexer'

describe('Lexer: Support for variable shadowing', () => {
  test('Lexer.output: identifies referenced variables that are also declared', () => {
    const lexer = new Lexer('a = 1; { let a = 2; }')
    expect(lexer.identifiers).toEqual(['a'])
  })

  test('Lexer.output: prevent replacement of variables in higher order functions', () => {
    const lexer = new Lexer(dedent`
      const region = regions.find((region) => region.name === destination)
      if (region) selectedDestination = region.name
      else selectedDestination = null`)
    lexer.replace({
      regions: 'proxyWindow.regions',
      destination: 'proxyWindow.destination',
      region: 'proxyWindow-region',
      selectedDestination: 'proxyWindow-selectedDestination',
    })
    expect(lexer.output()).toBe(
      dedent`
      const region = proxyWindow.regions.find(region => region.name === proxyWindow.destination);
      if (region)
          proxyWindow.selectedDestination = region.name;
      else
          proxyWindow.selectedDestination = null;`
    )
  })

  test('Lexer.output: prevents replacement of shadowed variables, block statements', () => {
    const lexer = new Lexer(
      'a = 1; { let a = 2; console.log(a) } console.log(a)'
    )
    lexer.replace({ a: 'proxyWindow-a' })
    expect(lexer.output()).toBe(
      dedent`
      proxyWindow.a = 1;
      {
          let a = 2;
          console.log(a);
      }
      console.log(proxyWindow.a);`
    )
  })

  test('Lexer.output: prevents replacement of shadowed variables, function and function parameters', () => {
    const lexer = new Lexer(
      dedent`
      a = 1;
      function f(...a) {
        b = a + 1;
        console.log(b)
      }
      
      f(3)
      a = 2`
    )
    lexer.replace({
      a: 'proxyWindow-a',
      b: 'proxyWindow-b',
      f: 'proxyWindow-f',
    })

    expect(lexer.output()).toBe(
      dedent`
      proxyWindow.a = 1;
      function f(...a) {
          proxyWindow.b = a + 1;
          console.log(proxyWindow.b);
      }
      f(3);
      proxyWindow.a = 2;`
    )
  })
})
