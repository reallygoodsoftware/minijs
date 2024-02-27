import { Lexer } from '@/generators/lexer'
import { State } from '@/state'

const IGNORED_IDS = ['this', '$']

export class Variables {
  constructor(entity) {
    this.entity = entity
    this.data = new Map() // key: variable, value: attributes

    this.variables = []
    this.groupVariables = []
  }

  init() {
    this._getAttributeVariables()
    this._getEventVariables()
    this._initVariables()
  }

  _getAttributeVariables() {
    this.entity.attributes.dynamicAttributes.forEach((attr) => {
      const expr = this.entity.element.getAttribute(attr)
      if (!expr) return

      if (attr === ':each') {
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
    this.variables = [...new Set(this.variables)]
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
        this.variables.splice(this.variables.indexOf(variable), 1)
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
    const currentAttributes = this.data.get(variable) ?? []
    this.data.set(variable, [...new Set(currentAttributes.concat([attribute]))])

    if (attribute === ':group') this.groupVariables.push(variable)
    this.variables.push(variable)
  }
}
