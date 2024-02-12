import MiniArray from './helpers/array'

export class State {
  static isLocalState(variable) {
    return variable[0] === '$'
  }

  constructor() {
    this.window = null
    this.variables = []

    this.entities = new Map() // key: entityID, value: entity
    this.dependencies = new Map() // key: variable, value: entityID
    this.entityDependencies = new Map() // key: entityID.variable, value: entityID
  }

  setProxyWindow() {
    this.window = this.create(window)
  }

  addEntity(entity) {
    this.entities.set(entity.id, entity)
  }

  removeEntity(entity) {
    this.entities.delete(entity.id)

    this.dependencies.forEach((_, entityID) => {
      if (entityID === entity.id) this.dependencies.delete(entity.id)
    })

    this.entityDependencies.forEach((_, variable) => {
      const [entityID] = variable.split('.')
      if (entityID === entity.id) this.entityDependencies.delete(variable)
    })
  }

  hasDependency(variable) {
    return (
      this.dependencies.has(variable) || this.entityDependencies.has(variable)
    )
  }

  addDependency(variable, entityID) {
    const dependencies = this.dependencies.get(variable) || []
    this.dependencies.set(variable, [...new Set(dependencies), entityID])
  }

  removeDependency(variable, entityID) {
    const dependencies = (this.dependencies.get(variable) || []).filter(
      (dep) => dep === entityID
    )

    this.dependencies.set(variable, dependencies)
  }

  disposeDependency(variable) {
    this.dependencies.delete(variable)
  }

  addEntityDependency(parentEntityID, variable, entityID) {
    const key = `${parentEntityID}.${variable}`
    const dependencies = this.entityDependencies.get(key) || []
    this.entityDependencies.set(key, [...new Set(dependencies), entityID])
  }

  removeEntityDependency(parentEntityID, variable, entityID = null) {
    const key = `${parentEntityID}.${variable}`
    const dependencies = (this.entityDependencies.get(key) || []).filter(
      (dep) => dep === entityID
    )

    this.entityDependencies.set(key, dependencies)
  }

  disposeEntityDependency(parentEntityID, variable) {
    const key = `${parentEntityID}.${variable}`
    this.entityDependencies.delete(key)
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

    if (!this.hasDependency(property)) return
    this.evaluateDependencies(property)
    this.attachVariableHelpers([property])
  }

  setEntityState(target, property, value, entityID) {
    target[property] = value

    if (!this.hasDependency(entityID)) return

    const variable = `${entityID}.${property}`
    this.evaluateDependencies(variable)
    this.attachVariableHelpers([entityID])
  }

  evaluate() {
    Array.from(this.entities.values()).forEach((entity) => {
      entity.attributes.evaluate()
    })

    this.attachVariableHelpers(Array.from(this.dependencies.keys()))
  }

  evaluateDependencies(variable) {
    const dependencies = this.dependencies.get(variable) || []

    dependencies.forEach((entityID) => {
      const entity = this.entities.get(entityID)
      // TODO: Only update relevant attributes that uses those variables
      entity?.attributes.evaluate()
    })

    const entityDependencies = this.entityDependencies.get(variable) || []

    entityDependencies.forEach((entityID) => {
      const entity = this.entities.get(entityID)
      // TODO: Only update relevant attributes that uses those variables
      entity?.attributes.evaluate()
    })

    this.attachVariableHelpers([variable])
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
