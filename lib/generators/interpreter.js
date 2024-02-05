import { Lexer } from './lexer.js'

const AsyncFunction = Object.getPrototypeOf(async function(){}).constructor

const DEFAULT_SCOPE = {
  window: {},
  eval: {},
  XMLHttpRequest: {},
  Function: {},
};

function safeAsyncFunction(context, code, isExpression) {
  try {
    const expression = !isExpression
      ? `(async()=>{${code}})()`
      : code
    
    let func = new AsyncFunction(
      ['scope'],
      `let __result; with (scope) { __result = ${expression} }; return __result;`
    ).bind(context)
    
    Object.defineProperty(func, "name", {
      value: `[MiniJS] ${code}`,
    })
    
    return func
  } catch (error) {
    console.log(`Failed to run code for Entity#${context.id}:\n\n${code}`)
    console.error(error)
    return Promise.resolve()
  }
}

export class Interpreter extends Lexer {
  constructor(code, options) {
    super(code, options)
  }

  async interpret(context, ids) {
    const code = super.output()
    const scope = { ...DEFAULT_SCOPE, proxyWindow: MiniJS.window }

    try {
      return await safeAsyncFunction(context.element, code, this.isExpression)(scope)
    } catch (error) {
      console.log(code)
      console.log(error)
      return
    }
  }
}

export class ClassInterpreter extends Lexer {
  constructor(code, options) {
    super(code, { ...options, isClass: true })
    this._baseClasses = options.base ?? []
  }

  async interpret(context) {
    const classNames = super.output()
    const scope = { ...DEFAULT_SCOPE, proxyWindow: MiniJS.window }

    let newClassNames = [...this._baseClasses]

    if (typeof classNames === 'string') {
      const result = await safeAsyncFunction(context.element, classNames, this.isExpression)(scope)
      newClassNames = newClassNames.concat((result ?? '').split(' '))
    } else if (Array.isArray(classNames)) {
      for (const conditional of classNames) {
        const condition = await safeAsyncFunction(context.element, conditional.test, true)(scope)
        const consequent = await safeAsyncFunction(context.element, conditional.consequent, conditional.isExpression)(scope)
        const alternate = await safeAsyncFunction(context.element, conditional.alternate, conditional.isExpression)(scope)

        const consequentClasses = consequent.split(' ')
        const alternateClasses = alternate.split(' ')
  
        if (condition) {
          newClassNames = newClassNames.concat(consequentClasses)
          newClassNames = newClassNames.filter((value) => !alternateClasses.includes(value))
        } else {
          newClassNames = newClassNames.concat(alternateClasses)
          newClassNames = newClassNames.filter((value) => !consequentClasses.includes(value))
        }
      }
    }

    return [...new Set(newClassNames)].join(' ')
  } 
}
