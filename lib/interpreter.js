import { Lexer } from './lexer.js'

function evalInContext(jsCode, context) {
  return function() { return eval(jsCode) }.call(context);
}

export class Interpreter extends Lexer {
  constructor(code, options) {
    super(code, options)
  }

  interpret(context) {
    return evalInContext(super.output(), context)
  }
}

export class ClassInterpreter extends Lexer {
  constructor(code, options) {
    super(code, { ...options, isClass: true })
    this._baseClasses = options.base ?? []
  }

  interpret(context) {
    const evaluator = (code) => evalInContext(code, context)
    const classNames = super.output()

    let newClassNames = [...this._baseClasses]

    if (typeof classNames === 'string')
      newClassNames = newClassNames.concat(evaluator(classNames)?.split(' '))
    else if (Array.isArray(classNames)) {
      classNames.forEach((conditional) => {
        const condition = evaluator(conditional.test)
        const consequent = evaluator(conditional.consequent).split(' ')
        const alternate = evaluator(conditional.alternate).split(' ')
  
        if (condition) {
          newClassNames = newClassNames.concat(consequent)
          newClassNames = newClassNames.filter((value) => !alternate.includes(value))
        } else {
          newClassNames = newClassNames.concat(alternate)
          newClassNames = newClassNames.filter((value) => !consequent.includes(value))
        }
      });
    }

    return [...new Set(newClassNames)].join(' ')
  } 
}
