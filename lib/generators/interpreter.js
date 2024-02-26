import { Mini } from '../main.js'
import { Lexer } from './lexer.js'

const AsyncFunction = Object.getPrototypeOf(async function () {}).constructor

const DEFAULT_SCOPE = {
  eval: {},
  XMLHttpRequest: {},
  Function: {},
}

function safeAsyncFunction(context, scope, code, isExpression) {
  try {
    const expression = !isExpression ? `(async()=>{${code}})()` : code

    let func = new AsyncFunction(
      ['__scope'],
      `let __result; with (__scope) { __result = ${expression} }; return __result;`
    ).bind(context)

    Object.defineProperty(func, 'name', {
      value: `[MiniJS] ${code}`,
    })

    const result = func(scope)
    return result
  } catch (error) {
    console.log(`Failed to run code for Entity#${context.id}:\n\n${code}`)
    console.error(error)
    return Promise.resolve()
  }
}

export class Interpreter extends Lexer {
  constructor(code) {
    super(code)
  }

  async interpret(context, _scope = {}) {
    const code = super.output()
    const mini = new Mini()

    const scope = {
      ...DEFAULT_SCOPE,
      proxyWindow: mini.state.window,
      ..._scope,
    }

    return await safeAsyncFunction(
      context.element,
      scope,
      code,
      this.isExpression
    )
  }
}

export class ClassInterpreter extends Lexer {
  constructor(code, options) {
    super(code)
    this._baseClasses = options.base ?? []
  }

  async interpret(context, _scope = {}) {
    const classNames = super.conditional()
    const mini = new Mini()

    const scope = {
      ...DEFAULT_SCOPE,
      proxyWindow: mini.state.window,
      ..._scope,
    }

    let newClassNames = [...this._baseClasses]

    if (typeof classNames === 'string') {
      const result = await safeAsyncFunction(
        context.element,
        scope,
        classNames,
        this.isExpression
      )
      newClassNames = newClassNames.concat((result ?? '').split(' '))
    } else if (Array.isArray(classNames)) {
      for (const conditional of classNames) {
        const condition = await safeAsyncFunction(
          context.element,
          scope,
          conditional.test,
          true
        )
        const consequent = await safeAsyncFunction(
          context.element,
          scope,
          conditional.consequent,
          conditional.isExpression
        )
        const alternate = await safeAsyncFunction(
          context.element,
          scope,
          conditional.alternate,
          conditional.isExpression
        )

        const consequentClasses = consequent.split(' ')
        const alternateClasses = alternate.split(' ')

        if (condition) {
          newClassNames = newClassNames.concat(consequentClasses)
          newClassNames = newClassNames.filter(
            (value) => !alternateClasses.includes(value)
          )
        } else {
          newClassNames = newClassNames.concat(alternateClasses)
          newClassNames = newClassNames.filter(
            (value) => !consequentClasses.includes(value)
          )
        }
      }
    }

    return [...new Set(newClassNames)].join(' ')
  }
}
