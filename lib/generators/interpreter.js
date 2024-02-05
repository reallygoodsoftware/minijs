import { Lexer } from './lexer.js'

const AsyncFunction = Object.getPrototypeOf(async function(){}).constructor

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

  async interpret(context) {
    const code = super.output()
    const scope = { proxyWindow: MiniJS.window, this: context }

    return await safeAsyncFunction(context, code, this.isExpression)(scope)
  }
}


export class ClassInterpreter extends Lexer {
  constructor(code, options) {
    super(code, { ...options, isClass: true })
    this._baseClasses = options.base ?? []
  }

  async interpret(context) {
    const classNames = super.output()
    const scope = { proxyWindow: MiniJS.window, this: context }

    let newClassNames = [...this._baseClasses]

    if (typeof classNames === 'string') {
      const result = await safeAsyncFunction(context, classNames, this.isExpression)(scope)
      newClassNames = newClassNames.concat((result ?? '').split(' '))
    } else if (Array.isArray(classNames)) {
      for (const conditional of classNames) {
        const condition = await safeAsyncFunction(context, conditional.test, true)(scope)
        const consequent = await safeAsyncFunction(context, conditional.consequent, conditional.isExpression)(scope)
        const alternate = await safeAsyncFunction(context, conditional.alternate, conditional.isExpression)(scope)

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
