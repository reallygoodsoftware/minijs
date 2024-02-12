import MiniArray from './helpers/array'

export class State {
  static isLocalState(variable) {
    return variable[0] === '$'
  }

  constructor() {
    this.window = null
    this.variables = []
  }

  setProxyWindow() {
    this.window = this.create(window)
  }

  create(object) {
    const ctx = this

    return new Proxy(object, {
      set: function (target, property, value) {
        if (State.isLocalState(property))
          ctx.setLocalState(target, property, value)
        else ctx.setState(target, property, value)

        return true
      },
      get: function (target, property) {
        return target[property]
      },
    })
  }

  setLocalState(target, property, value) {
    localStorage.setItem(property, JSON.stringify(value))
    this.setState(target, property, value)
  }

  setState(target, property, value) {
    target[property] = value

    if (!this.variables.includes(property)) return
    this.triggerDOMUpdate(property)
    this.attachVariableHelpers()
  }

  triggerDOMUpdate(state) {
    for (const entity of MiniJS.elements) {
      const shouldUpdate =
        entity.variables.includes(state) ||
        state == null ||
        entity.uuid == state ||
        entity.parent?.uuid == state

      // TODO: Only update relevant attributes that uses those variables
      if (shouldUpdate) entity.attributes.evaluate()
    }
  }

  attachVariableHelpers(variables = this.variables) {
    variables.forEach((variable) => {
      if (
        Array.isArray(this.window[variable]) &&
        !(this.window[variable] instanceof MiniArray)
      ) {
        this.window[variable] = new MiniArray(...this.window[variable])
      }
    })
  }
}
