import { Lexer } from '@/generators/lexer'
import { State } from '@/state'

const IGNORED_IDS = ['this', '$']

export class Variables {
  constructor(entity) {
    this.entity = entity
    this.data = new Map() // key: variable, value: attributes
  }

  init() {
    this._getAttributeVariables()
    this._getEventVariables()
    this._initVariables()
  }

  _getAttributeVariables() {
    this.entity.attributes.dynamicAttributes.forEach((name) => {
      const attr = this.entity.element.attributes[name]
      if (!attr) return

      if (name === ':each') {
        const [_, variable] = attr.value.split(' in ')

        const isNativeVariable =
          typeof window[variable] === 'function' &&
          window[variable].toString().indexOf('[native code]') === -1

        if (isNativeVariable) return
        if (IGNORED_IDS.includes(variable)) return
        if (variable in this.entity.state) return
        this.entity.variables.push(variable)
      }

      if (!attr.value) return

      const lexer = new Lexer(attr.value)

      const identifiers = lexer.identifiers.filter((value) => {
        if (IGNORED_IDS.includes(value)) return false
        const variable = value.split('.')[0]
        return !(variable in this.entity.state)
      })

      if (name === ':group') this.entity.groupVariables.push(...identifiers)
      else this.entity.variables.push(...identifiers)
    })
  }

  _getEventVariables() {
    this.entity.events.dynamicEvents.forEach((event) => {
      const expr = this.entity.element.getAttribute(event)
      if (!expr) return

      const lexer = new Lexer(expr)

      const identifiers = lexer.identifiers.filter((value) => {
        if (IGNORED_IDS.includes(value)) return false
        const variable = value.split('.')[0]
        return !(variable in this.entity.state)
      })

      this.entity.variables.push(...identifiers)
    })
  }

  _initVariables() {
    this.entity.variables = [...new Set(this.entity.variables)]

    this.entity.variables.forEach((variable) => {
      const entityID = this.entity.id

      if (State.isElState(variable)) {
        this.entity.setAsGroup()

        if (window[entityID] == null) {
          window[entityID] = this.entity.base.state.create({}, entityID)
        }

        this.entity.base.state.addVariable(entityID, entityID)

        if (variable !== State.EL_STATE) {
          const [_, varName] = variable.split('.')
          this.entity.base.state.addEntityVariable(entityID, varName, entityID)
        }
      } else if (State.isGroupState(variable)) {
        const group = this.entity.group

        if (!group) this.entity.group = this.entity.getGroup()

        // Cases where group is not found:
        // - an each item with a :group directive being removed due to re-evaluation of :each attribute
        if (group == null) return

        if (window[group.id] == null) {
          window[group.id] = this.entity.base.state.create({}, group.id)
        }

        this.entity.base.state.addVariable(group.id, entityID)

        if (variable !== State.GROUP_STATE) {
          const [_, varName] = variable.split('.')
          this.entity.base.state.addEntityVariable(group.id, varName, entityID)
        }
      } else if (typeof window[variable] === 'function') {
        this.entity.variables.splice(this.entity.variables.indexOf(variable), 1)
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
}
