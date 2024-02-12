import { Interpreter, ClassInterpreter } from './generators/interpreter'
import { Lexer } from './generators/lexer'
import { Events } from './entity/events'
import { Attributes } from './entity/attributes'

export default class Entity {
  constructor(el) {
    this.element = el
    this.tagName = el.tagName
    this.variables = []
    this.id = this.generateEntityUUID()

    this.events = new Events(this)
    this.attributes = new Attributes(this)
    MiniJS.state.addEntity(this)

    if (MiniJS.debug) this.element.dataset.entityId = this.id
  }

  setAsParent() {
    this.uuid = this.id
    this.element.dataset.uuid = this.uuid
  }

  isParent() {
    return !!this.uuid
  }

  isExists() {
    return document.documentElement.contains(this.element)
  }

  getVariables() {
    this._getVariablesFromAttributes()
    this._getVariablesFromEvents()
    this._initVariables()
  }

  _getVariablesFromAttributes() {
    const RESERVED_KEYWORDS = ['$', 'window', 'document', 'console']

    this.attributes.dynamicAttributes.forEach((name) => {
      const attr = this.element.attributes[name]
      if (!attr) return

      const lexer = new Lexer(attr.value, {
        ignoredKeys: RESERVED_KEYWORDS,
      })
      const { referenced, member, assigned } = lexer.identifiers

      const filtered = [...referenced, ...member, ...assigned].filter(
        (value) => {
          const isNativeVariable =
            typeof window[value] === 'function' &&
            window[value].toString().indexOf('[native code]') === -1

          return !isNativeVariable
        }
      )

      this.variables.push(...filtered)

      return attr.name
    })
  }

  _getVariablesFromEvents() {
    const RESERVED_KEYWORDS = ['event', '$', 'window', 'document', 'console']

    this.events.dynamicEvents.forEach((event) => {
      const expr = this.element.getAttribute(event)

      const lexer = new Lexer(expr, {
        ignoredKeys: RESERVED_KEYWORDS,
      })
      const { referenced, member, assigned } = lexer.identifiers

      const filtered = [...referenced, ...member, ...assigned].filter(
        (value) => {
          const isNativeVariable =
            typeof window[value] === 'function' &&
            window[value].toString().indexOf('[native code]') === -1

          return !isNativeVariable
        }
      )

      this.variables.push(...filtered)
    })
  }

  _initVariables() {
    this.variables = [...new Set(this.variables)]

    this.variables.forEach((variable) => {
      if (variable.startsWith('el.') || variable === 'el') {
        this.setAsParent()

        if (!this.parent) this.parent = this.getParent()

        if (window[this.id] == null) {
          window[this.id] = MiniJS.state.create({}, this.id)
        }

        MiniJS.state.addVariable(this.id, this.id)

        if (variable !== 'el') {
          const [_, varName] = variable.split('.')
          MiniJS.state.addEntityVariable(this.id, varName, this.id)
        }
      } else if (typeof window[variable] === 'function') {
        this.variables.splice(this.variables.indexOf(variable), 1)
      } else {
        const [identifier] = variable.split('.')

        window[identifier] = variable.startsWith('$')
          ? MiniJS.tryFromLocal(identifier)
          : window[identifier]

        MiniJS.state.addVariable(identifier, this.id)
      }
    })
  }

  async _interpret(expr, options = {}) {
    const Engine = options.isClass ? ClassInterpreter : Interpreter
    const engine = new Engine(expr, options)
    const ids = {
      $: 'document.querySelector',
      el: `proxyWindow['${this.id}']`,
    }

    this.variables.forEach((variable) => {
      if (variable.startsWith('el.') || variable === 'el') return

      ids[variable] = `proxyWindow-${variable}`
    })

    engine.replace(ids, ['declared'])

    return await engine.interpret(this)
  }

  getParent() {
    if (this.isParent()) {
      return this
    } else {
      let currentElement = this.element
      let parentNode = currentElement.parentNode
      while (!parentNode.dataset.uuid) {
        currentElement = parentNode
        parentNode = currentElement.parentNode
      }
      const entities = Array.from(MiniJS.state.entities.values())
      const entity = entities.find((e) => e.uuid == parentNode.dataset.uuid)
      return entity
    }
  }

  generateEntityUUID() {
    return 'Entity' + Date.now() + Math.floor(Math.random() * 10000)
  }

  async init() {
    this.getVariables()
    this.events.apply()
    await this.attributes.evaluate()
  }

  initChildren() {
    const elements = this.element.querySelectorAll('*')

    for (let i = 0; i < elements.length; i++) {
      const element = elements[i]
      if (element.nodeType !== 1) continue

      try {
        const entity = new Entity(element)
        entity.init()
      } catch (error) {
        console.error('Failed to initialize child entity:', error)
      }
    }
  }

  dispose() {
    const elements = [this.element, ...this.element.querySelectorAll('*')]
    const entities = Array.from(MiniJS.state.entities.values())
    const variables = []

    // Remove event bindings
    for (const element of elements) {
      if (element.nodeType !== 1) continue

      const entity = MiniJS.state.getEntityByElement(element, entities)

      if (!entity) continue

      variables.push(...entity.variables)
      entity.events.dispose()
      MiniJS.state.removeEntity(entity)
    }

    // Clean up unused variables
    const usedVariables = entities
      .filter((entity) => !elements.includes(entity.element))
      .reduce((acc, entity) => acc.concat(entity.variables), [])

    const unusedVariables = variables.filter(
      (variable) => !usedVariables.includes(variable)
    )

    MiniJS.state.disposeVariables(this.id, unusedVariables)
  }
}
