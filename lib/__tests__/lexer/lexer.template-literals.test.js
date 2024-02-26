import { describe, expect, test } from 'vitest'
import dedent from 'dedent-js'
import { Lexer } from '../../generators/lexer'

describe('Lexer: Support for Template Literals', () => {
  test('Lexer.identifiers: gets identifiers from template literals', () => {
    const lexer = new Lexer(`
      if (whenSelectedTab === 'Flexible') {
        return selectedMonths.length
          ? \`\${whenHowLong} in \${selectedMonths.join(', ')}\`
          : \`Any \${whenHowLong.toLowerCase()}\`
      }
    `)
    expect(lexer.identifiers).toEqual([
      'whenSelectedTab',
      'selectedMonths',
      'whenHowLong',
    ])
  })

  test('Lexer.output: replaces identifiers in template literals', () => {
    const lexer = new Lexer(`
      if (whenSelectedTab === 'Flexible') {
        return selectedMonths.length
          ? \`\${whenHowLong} in \${selectedMonths.join(', ')}\`
          : \`Any \${whenHowLong.toLowerCase()}\`
      }
    `)
    lexer.replace({
      whenSelectedTab: 'proxyWindow-whenSelectedTab',
      selectedMonths: 'proxyWindow-selectedMonths',
      whenHowLong: 'proxyWindow-whenHowLong',
    })
    expect(lexer.output()).toBe(dedent`
      if (proxyWindow.whenSelectedTab === 'Flexible') {
          return proxyWindow.selectedMonths.length ? \`\${ proxyWindow.whenHowLong } in \${ proxyWindow.selectedMonths.join(', ') }\` : \`Any \${ proxyWindow.whenHowLong.toLowerCase() }\`;
      }
    `)
  })
})
