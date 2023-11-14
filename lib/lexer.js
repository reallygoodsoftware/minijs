import jsTokens from "js-tokens";

const RESERVED_KEYWORDS = ['await', 'async', 'break', 'case', 'catch', 'class', 'const', 'continue', 'debugger', 'default', 'delete', 'do', 'else', 'enum', 'export', 'extends', 'false', 'finally', 'for', 'function', 'if', 'implements', 'import', 'in', 'instanceof', 'interface', 'let', 'new', 'null', 'undefined', 'package', 'private', 'protected', 'public', 'return', 'super', 'switch', 'static', 'this', 'throw', 'try', 'true', 'typeof', 'var', 'void', 'while', 'with', 'yield'];
const OPERATORS = ['=', '+=', '-=', '*=', '/=', '%=', '+', '-', '--', '+', '++', '/', '*', '%'];
const VAR_DECLARATION = ['var', 'const', 'let'];

const TOKEN = {
  // js-tokens types
  StringLiteral: 'StringLiteral',
  NoSubstitutionTemplate: 'NoSubstitutionTemplate',
  TemplateHead: 'TemplateHead',
  TemplateMiddle: 'TemplateMiddle',
  TemplateTail: 'TemplateTail',
  RegularExpressionLiteral: 'RegularExpressionLiteral',
  MultiLineComment: 'MultiLineComment',
  SingleLineComment: 'SingleLineComment',
  IdentifierName: 'IdentifierName',
  PrivateIdentifier: 'PrivateIdentifier',
  NumericLiteral: 'NumericLiteral',
  Punctuator: 'Punctuator',
  WhiteSpace: 'WhiteSpace',
  LineTerminatorSequence: 'LineTerminatorSequence',
  Invalid: 'Invalid',

  // minijs types
  ReservedWord: 'ReservedWord',
  Operator: 'Operator',
};

const RULE = {
  replace: 'replace',
}

export default class Lexer {
  static TOKEN = TOKEN;

  constructor(code) {
    this._code = code;
    this._tokens = [];
    this._rules = [];
    this._hasRan = false;
  }

  _getLastToken(startIndex = this._tokens.length, exclude = [TOKEN.WhiteSpace]) {
    for (let i = startIndex - 1; i >= 0; i--) {
      const token = this._tokens[i]
      if (!exclude.includes(token.type))
        return token
    }

    return null
  }

  _tokenize() {
    if (this._hasRan) return;
    this._hasRan = false;
    this._tokens = [];

    let isObject = false;
    let objectParent = [];

    for (const token of jsTokens(this._code)) {
      if (token.type === 'IdentifierName') {
        if (RESERVED_KEYWORDS.includes(token.value)) {
          token.type = TOKEN.ReservedWord;
        } else if (isObject) {
          const lastToken = this._getLastToken();
          const lastSecondToken = this._getLastToken(lastToken.index);

          token.parent = objectParent.join('.');
        } else {
          const previousFirstToken = this._tokens[this._tokens.length - 1];
          const previousSecondToken = this._tokens[this._tokens.length - 2];

          if (previousFirstToken?.type === TOKEN.Punctuator && (previousSecondToken?.type === TOKEN.IdentifierName
              || (previousSecondToken?.type === TOKEN.ReservedWord || previousSecondToken?.value === 'this'))) {
            let counter = 3;
            let parent = previousSecondToken.value;
            let currentTypes = TOKEN.Punctuator;
            let currentToken = this._tokens[this._tokens.length - counter];

            while (currentTypes.includes(currentToken?.type)) {
              if (currentToken?.type === TOKEN.ReservedWord && currentToken?.value !== 'this')
                break;

              parent += currentToken.value;

              counter++;
              currentToken = this._tokens[this._tokens.length - counter];
              currentTypes = currentTypes.includes(TOKEN.Punctuator)
                ? [TOKEN.IdentifierName, TOKEN.ReservedWord]
                : [TOKEN.Punctuator];
            }

            token.parent = parent;
          } else if (previousFirstToken?.type === TOKEN.WhiteSpace
              && previousSecondToken?.type === TOKEN.ReservedWord
              && VAR_DECLARATION.includes(previousSecondToken.value)) {
            token.declaration = true;
          }
        }
      } else if (token.type === 'Punctuator') {
        if (OPERATORS.includes(token.value)) {
          token.type = TOKEN.Operator;
          if (token.value.endsWith('='))
            token.assignment = true;
        } else if (token.value === '{') {
          let lastToken = this._getLastToken();

          if ((lastToken?.type === TOKEN.Punctuator && lastToken.value === ':') || lastToken.type === TOKEN.Operator) {
            isObject = true;
            lastToken = this._getLastToken(lastToken.index);
            objectParent.push(lastToken.value);
          }
        } else if (token.value === '}' && isObject) {
          objectParent.pop();
          if (objectParent.length === 0) isObject = false;

          const lastToken = this._getLastToken();
          const lastSecondToken = this._getLastToken(lastToken.index);
          
          // identify ES6 object property shorthand
          if (lastToken?.type === TOKEN.IdentifierName && !(lastSecondToken?.type === TOKEN.Punctuator && lastSecondToken.value === ':')) {
            if (this._tokens[this._tokens.length - 1]?.type === TOKEN.WhiteSpace)
              this._tokens.pop();

            this._tokens.push({ type: TOKEN.Punctuator, value: ':', index: this._tokens.length });
            this._tokens.push({ type: TOKEN.WhiteSpace, value: ' ', index: this._tokens.length });
            this._tokens.push({ type: lastToken.type, value: lastToken.value, index: this._tokens.length });
          }
        } else if (isObject && token.value === ',') {
          const lastToken = this._getLastToken();
          const lastSecondToken = this._getLastToken(lastToken.index);

          // identify ES6 object property shorthand
          if (lastToken?.type === TOKEN.IdentifierName && !(lastSecondToken?.type === TOKEN.Punctuator && lastSecondToken.value === ':')) {
            if (this._tokens[this._tokens.length - 1]?.type === TOKEN.WhiteSpace)
              this._tokens.pop();

            this._tokens.push({ type: TOKEN.Punctuator, value: ':', index: this._tokens.length });
            this._tokens.push({ type: TOKEN.WhiteSpace, value: ' ', index: this._tokens.length });
            this._tokens.push({ type: lastToken.type, value: lastToken.value, index: this._tokens.length });
          }
        }
      }

      this._tokens.push({ ...token, index: this._tokens.length });
    }

    this._hasRan = true;
  }

  replace(condition, replacement) {
    this._rules.push({ rule: RULE.replace, condition, replacement });
  }

  get tokens() {
    this._tokenize();
    return this._tokens;
  }

  output() {
    if (!this._hasRan) this._tokenize()
    return this._tokens
      .map((token) => {
        for (const rule of this._rules) {
          if (rule.rule === RULE.replace) {
            const replacement = rule.condition(token);

            if (typeof replacement === 'string')
              token.value = replacement;
          }
        }

        return token.value;
      })
      .join('');
  }
}
