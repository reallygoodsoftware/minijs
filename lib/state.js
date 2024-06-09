import { Mini } from '@/main'
import { MiniArray } from '@/helpers/array'

export class State {
  static DISABLE_RE_RENDER_KEY = '_.'
  static EL_STATE = 'el'
  static SCOPE_STATE = 'scope'

  static isLocalState(variable) {
    return variable[0] === '$'
  }

  static isElState(variable) {
    return (
      variable.startsWith(State.EL_STATE + '.') || variable === State.EL_STATE
    )
  }

  static isScopeState(variable) {
    return (
      variable.startsWith(State.SCOPE_STATE + '.') ||
      variable === State.SCOPE_STATE
    )
  }

  constructor() {
    this.base = new Mini()
    this.window = null

    this.entities = new Map() // key: entityID, value: entity
    this.variables = new Map() // key: variable, value: entityID
    this.entityVariables = new Map() // key: entityID.variable, value: entityID

    this.shouldUpdate = false
  }

  setProxyWindow() {
    this.window ||= this.create(window)
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
    if (variables.includes(entityID)) return
    this.variables.set(variable, [...variables, entityID])
  }

  addEntityVariable(scopeID, variable, entityID) {
    const key = `${scopeID}.${variable}`
    const variables = this.entityVariables.get(key) || []
    if (variables.includes(entityID)) return
    this.entityVariables.set(key, [...variables, entityID])
  }

  removeDuplicateVariables() {
    this.variables.forEach((entityIDs, variable) => {
      this.variables.set(variable, [...new Set(entityIDs)])
    })

    this.entityVariables.forEach((entityIDs, variable) => {
      this.entityVariables.set(variable, [...new Set(entityIDs)])
    })
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

  getState(variable) {
    if (variable.startsWith('$')) return this.getLocalState(variable)
    return window[variable]
  }

  getLocalState(variable) {
    if (!variable.startsWith('$')) return undefined

    try {
      const localValue = localStorage.getItem(variable)

      if (localValue == null) return localValue
      return JSON.parse(localValue)
    } catch {
      return undefined
    }
  }

  setLocalState(target, property, value) {
    localStorage.setItem(property, JSON.stringify(value))
    this.setState(target, property, value)
  }

  setState(target, property, value) {
    const varName = this.getVariableName(property)

    target[varName] = Array.isArray(value) ? new MiniArray(...value) : value

    if (!this.shouldRerender(property)) return
    if (!this.hasDependency(varName)) return

    this.evaluateDependencies(varName)
    this.attachVariableHelpers([varName])
  }

  setEntityState(target, property, value, entityID) {
    const varName = this.getVariableName(property)

    target[varName] = Array.isArray(value) ? new MiniArray(...value) : value

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
    const variableEntities = this.variables.get(variable) || []
    const properties = variable.split('.')

    const scopeID = properties[1] != null ? properties[0] : null
    const varName = scopeID != null ? properties[1] : properties[0]

    variableEntities.forEach((entityID) => {
      const entity = this.entities.get(entityID)
      if (!entity) return

      let variable = varName

      if (scopeID != null) {
        if (entity.id === scopeID) variable = `el.${varName}`
        else variable = `scope.${varName}`
      }

      entity.attributes.evaluateVariable(variable)
    })

    const entityVariablesEntities = this.entityVariables.get(variable) || []

    entityVariablesEntities.forEach((entityID) => {
      const entity = this.entities.get(entityID)
      if (!entity) return

      let variable = varName

      if (scopeID != null) {
        if (entity.id === scopeID) variable = `el.${varName}`
        else variable = `scope.${varName}`
      }

      entity.attributes.evaluateVariable(variable)
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
        this.disposeVariable(entityID)

        if (variable !== State.EL_STATE) {
          const varName = variable.replace(State.EL_STATE + '.', '')
          this.disposeEntityVariable(entityID, varName)
        }
      } else {
        delete window[variable]
        this.disposeVariable(variable)

        if (State.isLocalState(variable)) localStorage.removeItem(variable)
      }
    })
  }

  disposeVariable(variable) {
    this.variables.delete(variable)
  }

  disposeEntityVariable(entityID, variable) {
    const key = `${entityID}.${variable}`
    this.entityVariables.delete(key)
  }

  dispose() {
    this.shouldUpdate = false
    this.entities.clear()
    this.entityVariables.clear()
    this.variables.clear()
  }
}
