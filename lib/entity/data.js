import { Lexer } from '@/generators/lexer'
import { State } from '@/state'

const IGNORED_IDS = ['this', '$']

export class Data {
  constructor(entity) {
    this.entity = entity
    this._variables = new Map() // key: variable, value: attributes
    this._attributes = new Map() // key: attribute, value: variables
  }

  get variables() {
    return Array.from(this._variables.keys())
  }

  get groupVariables() {
    return this.variables.filter((variable) => State.isGroupState(variable))
  }

  getAttributeVariables(attr) {
    return this._attributes.get(attr) ?? []
  }

  getVariableAttributes(variable) {
    return this._variables.get(variable) ?? []
  }

  init() {
    this._getAttributesVariables()
    this._getEventVariables()
    this._initVariables()
  }

  initAttributeVariables(attr) {
    const expr = this.entity.element.getAttribute(attr)
    if (!expr) return

    if (attr === 'each') {
      const [_, variable] = expr.split(' in ')

      const isNativeVariable =
        typeof window[variable] === 'function' &&
        window[variable].toString().indexOf('[native code]') === -1

      if (isNativeVariable) return
      if (IGNORED_IDS.includes(variable)) return
      if (variable in this.entity.state) return
      this.add(variable, attr)
    }

    const lexer = new Lexer(expr)

    lexer.identifiers.forEach((variable) => {
      if (IGNORED_IDS.includes(variable)) return

      const object = variable.split('.')[0]
      if (object in this.entity.state) return

      this.add(variable, attr)
    })
  }

  _getAttributesVariables() {
    this.entity.attributes.dynamicAttributes.forEach((attr) => {
      this.initAttributeVariables(attr)
    })
  }

  _getEventVariables() {
    this.entity.events.dynamicEvents.forEach((event) => {
      const expr = this.entity.element.getAttribute(event)
      if (!expr) return

      const lexer = new Lexer(expr)

      lexer.identifiers.forEach((variable) => {
        if (IGNORED_IDS.includes(variable)) return

        const object = variable.split('.')[0]
        if (object in this.entity.state) return

        this.add(variable, event)
      })
    })
  }

  _initVariables() {
    const entityID = this.entity.id

    this.variables.forEach((variable) => {
      if (State.isElState(variable)) {
        this.entity.setAsGroup()

        if (window[entityID] == null)
          window[entityID] = this.entity.base.state.create({}, entityID)

        this.entity.base.state.addVariable(entityID, entityID)

        if (variable !== State.EL_STATE) {
          const [_, varName] = variable.split('.')
          this.entity.base.state.addEntityVariable(entityID, varName, entityID)
        }
      } else if (State.isGroupState(variable)) {
        if (this.entity.group == null)
          this.entity.group = this.entity.getGroup()

        // Cases where group is not found:
        // - an each item with a :group directive being removed due to re-evaluation of :each attribute
        if (this.entity.group == null) return

        const groupID = this.entity.group?.id

        if (window[groupID] == null) {
          window[groupID] = this.entity.base.state.create({}, groupID)
        }

        this.entity.base.state.addVariable(groupID, entityID)

        if (variable !== State.GROUP_STATE) {
          const [_, varName] = variable.split('.')
          this.entity.base.state.addEntityVariable(groupID, varName, entityID)
        }
      } else if (typeof window[variable] === 'function') {
        this.deleteVariable(variable)
      } else {
        try {
          const [identifier] = variable.split('.')
          window[identifier] = this.entity.base.state.getState(identifier)
          this.entity.base.state.addVariable(identifier, entityID)
        } catch (error) {
          console.error('Failed to initialize variable:', variable, error)
        }
      }
    })
  }

  add(variable, attribute) {
    const currentAttributes = this._variables.get(variable) ?? []
    this._variables.set(variable, [
      ...new Set(currentAttributes.concat([attribute])),
    ])

    const currentVariables = this._attributes.get(attribute) ?? []
    this._attributes.set(attribute, [
      ...new Set(currentVariables.concat([variable])),
    ])
  }

  remove(variable, attributes) {
    const currentAttributes = this._variables.get(variable) ?? []
    const newAttributes = currentAttributes.filter(
      (attr) => !attributes.includes(attr)
    )

    if (newAttributes.length === 0) {
      this._variables.delete(variable)
    } else {
      this._variables.set(variable, newAttributes)
    }

    attributes.forEach((attr) => {
      const currentVariables = this._attributes.get(attr) ?? []
      const newVariables = currentVariables.filter(
        (varName) => varName !== variable
      )

      if (newVariables.length === 0) {
        this._attributes.delete(attr)
      } else {
        this._attributes.set(attr, newVariables)
      }
    })
  }

  deleteVariable(variable) {
    this._variables.delete(variable)
    this._attributes.forEach((variables, attr) => {
      if (!variables.includes(variable)) return
      this._attributes.set(
        attr,
        variables.filter((varName) => varName !== variable)
      )
    })
  }

  deleteAttribute(attr) {
    this._attributes.delete(attr)
    this._variables.forEach((attributes, variable) => {
      if (!attributes.includes(attr)) return
      this._variables.set(
        variable,
        attributes.filter((attrName) => attrName !== attr)
      )
    })
  }
}
