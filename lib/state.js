import MiniArray from './helpers/array'

export class State {
  static DISABLE_RE_RENDER_KEY = '_.'
  static EL_STATE = 'el'
  static PARENT_STATE = 'parent'

  static isLocalState(variable) {
    return variable[0] === '$'
  }

  static isElState(variable) {
    return (
      variable.startsWith(State.EL_STATE + '.') || variable === State.EL_STATE
    )
  }

  static isParentState(variable) {
    return (
      variable.startsWith(State.PARENT_STATE + '.') ||
      variable === State.PARENT_STATE
    )
  }

  constructor() {
    this.window = null

    this.entities = new Map() // key: entityID, value: entity
    this.variables = new Map() // key: variable, value: entityID
    this.entityVariables = new Map() // key: entityID.variable, value: entityID

    this.shouldUpdate = false
  }

  setProxyWindow() {
    this.window = this.create(window)
  }

  getEntityByElement(el, entities = Array.from(this.entities.values())) {
    return entities.find((entity) => entity.element === el)
  }

  addEntity(entity) {
    this.entities.set(entity.id, entity)
  }

  removeEntity(entity) {
    this.entities.delete(entity.id)

    const variables = [...this.variables.entries()]
    variables.forEach(([key, value]) => {
      if (key === entity.id) this.variables.delete(key)
      else if (value.includes(entity.id))
        this.variables.set(
          key,
          value.filter((id) => id !== entity.id)
        )
    })

    const entityVariables = [...this.entityVariables.entries()]
    entityVariables.forEach(([key, value]) => {
      const [entityID] = key.split('.')
      if (entityID === entity.id) this.entityVariables.delete(key)
      else if (value.includes(entity.id))
        this.entityVariables.set(
          key,
          value.filter((id) => id !== entity.id)
        )
    })

    delete window[entity.id]
  }

  hasDependency(variable) {
    return this.variables.has(variable) || this.entityVariables.has(variable)
  }

  addVariable(variable, entityID) {
    const variables = this.variables.get(variable) || []
    this.variables.set(variable, [...new Set(variables), entityID])
  }

  addEntityVariable(parentEntityID, variable, entityID) {
    const key = `${parentEntityID}.${variable}`
    const variables = this.entityVariables.get(key) || []
    this.entityVariables.set(key, [...new Set(variables), entityID])
  }

  create(object, entityID = null) {
    const ctx = this

    return new Proxy(object, {
      set: function (target, property, value) {
        if (entityID) ctx.setEntityState(target, property, value, entityID)
        else if (State.isLocalState(property))
          ctx.setLocalState(target, property, value)
        else ctx.setState(target, property, value)

        return true
      },
      get: function (target, property) {
        if (entityID != null) return target[property]

        const isEntityState = property.startsWith('Entity')
        const isDisabledReRender = property.endsWith(
          State.DISABLE_RE_RENDER_KEY
        )

        if (isEntityState && isDisabledReRender) {
          const entityID = property.replace(State.DISABLE_RE_RENDER_KEY, '')

          return new Proxy(target[entityID], {
            set: function (target, property, value) {
              ctx.setEntityState(
                target,
                property + State.DISABLE_RE_RENDER_KEY,
                value,
                entityID
              )

              return true
            },
            get: function (target, property) {
              return target[property]
            },
          })
        }

        return target[property]
      },
    })
  }

  shouldRerender(variable) {
    if (!this.shouldUpdate) return false
    if (variable.endsWith(State.DISABLE_RE_RENDER_KEY)) return false
    return true
  }

  getVariableName(variable) {
    return variable.endsWith(State.DISABLE_RE_RENDER_KEY)
      ? variable.slice(0, -1)
      : variable
  }

  setLocalState(target, property, value) {
    localStorage.setItem(property, JSON.stringify(value))
    this.setState(target, property, value)
  }

  setState(target, property, value) {
    const varName = this.getVariableName(property)

    target[varName] = value

    if (!this.shouldRerender(property)) return
    if (!this.hasDependency(varName)) return

    this.evaluateDependencies(varName)
    this.attachVariableHelpers([varName])
  }

  setEntityState(target, property, value, entityID) {
    const varName = this.getVariableName(property)

    target[varName] = value

    if (!this.shouldRerender(property)) return
    if (!this.hasDependency(entityID)) return

    const variable = `${entityID}.${varName}`
    this.evaluateDependencies(variable)
    this.attachVariableHelpers([entityID])
    this.attachVariableHelpers([varName], entityID)
  }

  evaluate() {
    Array.from(this.entities.values()).forEach((entity) => {
      entity.attributes.evaluate()
    })

    this.attachVariableHelpers(Array.from(this.variables.keys()))
    this.shouldUpdate = true
  }

  evaluateDependencies(variable) {
    const variables = this.variables.get(variable) || []

    variables.forEach((entityID) => {
      const entity = this.entities.get(entityID)
      // TODO: Only update relevant attributes that uses those variables
      entity?.attributes.evaluate()
    })

    const entityVariables = this.entityVariables.get(variable) || []

    entityVariables.forEach((entityID) => {
      const entity = this.entities.get(entityID)
      // TODO: Only update relevant attributes that uses those variables
      entity?.attributes.evaluate()
    })

    this.attachVariableHelpers([variable])
  }

  attachVariableHelpers(variables, entityID = null) {
    variables.forEach((variable) => {
      const value =
        entityID != null
          ? this.window[entityID][variable]
          : this.window[variable]

      if (Array.isArray(value) && !(value instanceof MiniArray)) {
        if (entityID != null)
          this.window[entityID][variable] = new MiniArray(...value)
        else this.window[variable] = new MiniArray(...value)
      }
    })
  }

  disposeVariables(entityID, variables) {
    variables.forEach((variable) => {
      if (State.isElState(variable)) {
        delete window[entityID]
        MiniJS.state.disposeVariable(entityID)

        if (variable !== State.EL_STATE) {
          const varName = variable.replace(State.EL_STATE + '.', '')
          MiniJS.state.disposeEntityVariable(entityID, varName)
        }
      } else {
        delete window[variable]
        MiniJS.state.disposeVariable(variable)

        if (State.isLocalState(variable)) localStorage.removeItem(variable)
      }
    })
  }

  disposeVariable(variable) {
    this.variables.delete(variable)
  }

  disposeEntityVariable(parentEntityID, variable) {
    const key = `${parentEntityID}.${variable}`
    this.entityVariables.delete(key)
  }
}
