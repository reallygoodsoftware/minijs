const TOKEN = {
  identifier: 'identifier',
  method: 'method',
  operator: 'operator',
  separator: 'separator',
  number: 'number',
  boolean: 'boolean',
  string: 'string',
  whitespace: 'whitespace',
  reservedWord: 'reserved word',
  comment: 'comment',
  multiComment: 'multi comment',
}

const RULE = {
  replace: 'replace',
}

const RESERVED_KEYWORDS = ['await', 'break', 'case', 'catch', 'class', 'const', 'continue', 'debugger', 'default', 'delete', 'do', 'else', 'enum', 'export', 'extends', 'false', 'finally', 'for', 'function', 'if', 'implements', 'import', 'in', 'instanceof', 'interface', 'let', 'new', 'null', 'undefined', 'package', 'private', 'protected', 'public', 'return', 'super', 'switch', 'static', 'this', 'throw', 'try', 'true', 'typeof', 'var', 'void', 'while', 'with', 'yield']

class Tokenizer {
  constructor(code) {
    this._code = code
    this._tokens = []
    this._rules = []
    this._hasRan = false
  }

  _pushToken(type, value, index) {
    if (value.length === 0) return;
    if (type === TOKEN.identifier) {
      if (['true', 'false'].includes(value))
        type = TOKEN.boolean
      else {
        const lastToken = this._tokens.at(-1)
        if (lastToken != null && lastToken.value === '.' && lastToken.type === TOKEN.operator)
          type = TOKEN.method
        else if (RESERVED_KEYWORDS.includes(value))
          type = TOKEN.reservedWord
      }
    }

    this._tokens.push({ type, value, index })
  }

  _tokenize() {
    this._tokens = []

    let currentToken = ''
    let type = null
    let index = 0

    let isStringTemplate = false
    let exitedStringCount = 0
    
    for (let i = 0; i < this._code.length; i++) {
      const char = this._code[i]
      const isLast = i === this._code.length - 1

      // Check if char is the start / end of string
      if (['\'', '"', '`'].includes(char)) {
        if (type == null || type !== TOKEN.string) {
          this._pushToken(TOKEN.separator, char, i)
          if (char === '`')
            isStringTemplate = true
        }

        if (type == null) {
          type = TOKEN.string
          index = i
        } else if (type === TOKEN.string) {
          this._pushToken(type, currentToken, index)
          this._pushToken(TOKEN.separator, char, i)

          type = null
          currentToken = ''
          isStringTemplate = false
        }

      // Check if type is string
      } else if (type === TOKEN.string) {
        if (currentToken.endsWith('$') && char === '{' && isStringTemplate) {
          this._pushToken(type, currentToken.slice(0, -1), index)
          this._pushToken(TOKEN.separator, '${', i)
          exitedStringCount += 1

          type = null
          currentToken = ''
        } else {
          currentToken += char
        }

      // Check if char is a start of a comment
      } else if (type === TOKEN.operator && char === '/') {
        this._pushToken(TOKEN.operator, '//', i - 1)
        
        type = TOKEN.comment
        index = i + 1
        currentToken = ''
      
      // Check if char is a start of a multi comment
      } else if (type === TOKEN.operator && char === '*') {
        this._pushToken(TOKEN.operator, '/*', i - 1)
        
        type = TOKEN.multiComment
        index = i + 1
        currentToken = ''
      
      // Check if type is a comment
      } else if ([TOKEN.comment, TOKEN.multiComment].includes(type)) {
        if ((type === TOKEN.comment && char === '\n')
          || (type === TOKEN.multiComment && currentToken.endsWith('*') && char === '/')) {

          if (type === TOKEN.comment) {
            this._pushToken(type, currentToken, index)
            this._pushToken(TOKEN.whitespace, char, i)
          } else if (type === TOKEN.multiComment) {
            this._pushToken(type, currentToken.slice(0, currentToken.length - 1), index)
            this._pushToken(TOKEN.operator, '*/', i - 1)
          }

          type = null
          currentToken = ''
        } else {
          currentToken += char
        }
      
      // Check if char is a letter
      } else if (char.match(/[$a-z]/i)) {
        if (type == null) {
          type = TOKEN.identifier
          index = i
        }

        currentToken += char

      // Check if char is a whitespace
      } else if (char.match(/\s/)) {
        if (type === TOKEN.string) {
          currentToken += char
        } else {
          this._pushToken(type, currentToken, index)
          this._pushToken(TOKEN.whitespace, char, i)
          currentToken = ''
          type = null
        } 

      // Check if char is a dot or bracket notion
      } else if (['.', '[', ']'].includes(char)) {
        this._pushToken(type, currentToken, index)
        this._pushToken(TOKEN.operator, char, i)
        type = null
        currentToken = ''

      // Check if char is an operator
      } else if (char.match(/[<>+\-*/%=:?]/)) {
        if (type == null || type === TOKEN.operator) {
          type = TOKEN.operator
          currentToken += char
        } else {
          this._pushToken(type, currentToken, index)

          type = TOKEN.operator
          currentToken = char
          index = i
        }
      
      // Check if char is a separator
      } else if (['(', ')', ',', ';', '{', '}'].includes(char)) {
        this._pushToken(type, currentToken, index)
        this._pushToken(TOKEN.separator, char, i)

        if (char === '}' && exitedStringCount > 0) {
          exitedStringCount -= 1
          type = TOKEN.string
        } else {
          type = null
        }

        currentToken = ''
      
      // Check if char is a number
      } else if (char.match(/[0-9]/)) {
        if (type === TOKEN.identifier) {
          currentToken += char
        } else if (type == null || type === TOKEN.number) {
          type = TOKEN.number
          currentToken += char
        } else {
          this._pushToken(type, currentToken, index)

          type = TOKEN.number
          currentToken = char
          index = i
        }
      }

      if (isLast) this._pushToken(type, currentToken, index)
    }

    this._hasRan = true
  }

  replace(type, value, replacement) {
    this._rules.push({ rule: RULE.replace, type, value, replacement })
  }

  tokens() {
    this._tokenize()
    return this._tokens
  }

  pick(type) {
    if (!this._hasRan) this._tokenize()
    return this._tokens.filter(token => token.type === type)
  }

  output() {
    if (!this._hasRan) this._tokenize()
    return this._tokens
      .map((token) => {
        for (const rule of this._rules) {
          if (rule.rule === RULE.replace
            && token.type === rule.type
            && token.value === rule.value) {
            token.value = rule.replacement
          }
        }

        return token.value
      })
      .join('');
  }
}
