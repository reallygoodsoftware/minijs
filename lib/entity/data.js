import { Lexer } from '@/generators/lexer'
import { State } from '@/state'
import { isNativeVariable } from '@/helpers/variables'

const IGNORED_IDS = ['this', '$']

export class Data {
  constructor(entity) {
    this.entity = entity
    this._variables = new Map() // key: variable, value: attributes
    this._attributes = new Map() // key: attribute, value: variables
    this.scopeVariables = []
  }

  get variables() {
    return Array.from(this._variables.keys())
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
    this._removeDuplicateVariables()
    this._initVariables()
  }

  initAttributeVariables(attr) {
    const expr = this.entity.element.getAttribute(attr)
    if (!expr) return

    const variables = this.getAttributeVariables(attr)

    if (variables.length) {
      variables.forEach((variable) => {
        this.remove(variable, attr)
      })
      this._attributes.set(attr, [])
    }

    if (attr === 'each') {
      const [_, variable] = expr.split(' in ')

      if (isNativeVariable(variable)) return
      if (IGNORED_IDS.includes(variable)) return
      if (variable in this.entity.state) return
      this.add(variable, attr)
    }

    const lexer = new Lexer(expr)
    const isScopeAttr = attr === ':scope'

    lexer.identifiers.forEach((variable) => {
      if (IGNORED_IDS.includes(variable)) return

      const object = variable.split('.')[0]
      if (object in this.entity.state) return

      if (isScopeAttr) this.scopeVariables.push(variable)
      else this.add(variable, attr)
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

  _removeDuplicateVariables() {
    this._variables.forEach((attributes, variable) => {
      this._variables.set(variable, [...new Set(attributes)])
    })

    this._attributes.forEach((variables, attribute) => {
      this._attributes.set(attribute, [...new Set(variables)])
    })
  }

  _initVariables() {
    const entityID = this.entity.id
    const state = this.entity.base.state

    this.variables.forEach((variable) => {
      if (State.isElState(variable)) {
        this.entity.setAsScope()

        if (window[entityID] == null)
          window[entityID] = state.create({}, entityID)

        state.addVariable(entityID, entityID)

        if (variable !== State.EL_STATE) {
          const [_, varName] = variable.split('.')
          state.addEntityVariable(entityID, varName, entityID)
        }
      } else if (State.isScopeState(variable)) {
        if (this.entity.scope == null)
          this.entity.scope = this.entity.getScope()

        // Cases where scope is not found:
        // - an each item with a :scope directive being removed due to re-evaluation of :each attribute
        if (this.entity.scope == null) return

        const scopeID = this.entity.scope?.id

        if (window[scopeID] == null) {
          window[scopeID] = state.create({}, scopeID)
        }

        state.addVariable(scopeID, entityID)

        if (variable !== State.SCOPE_STATE) {
          const [_, varName] = variable.split('.')
          state.addEntityVariable(scopeID, varName, entityID)
        }
      } else if (typeof window[variable] === 'function') {
        this.deleteVariable(variable)
      } else {
        try {
          const [identifier] = variable.split('.')
          window[identifier] = state.getState(identifier)
          state.addVariable(identifier, entityID)
        } catch (error) {
          console.error('Failed to initialize variable:', variable, error)
        }
      }
    })

    state.removeDuplicateVariables()
  }

  add(variable, attribute) {
    const currentAttributes = this._variables.get(variable) ?? []
    this._variables.set(variable, [...currentAttributes, attribute])

    const currentVariables = this._attributes.get(attribute) ?? []
    this._attributes.set(attribute, [...currentVariables, variable])
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
