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

        if (window[this.uuid] == null) {
          window[this.uuid] = MiniJS.state.create({}, this.id)
        }

        MiniJS.state.addDependency(this.uuid, this.id)

        if (variable !== 'el') {
          const [_, varName] = variable.split('.')
          MiniJS.state.addEntityDependency(this.uuid, varName, this.id)
        }
      } else if (typeof window[variable] === 'function') {
        this.variables.splice(this.variables.indexOf(variable), 1)
      } else {
        const [identifier] = variable.split('.')

        window[identifier] = variable.startsWith('$')
          ? MiniJS.tryFromLocal(identifier)
          : window[identifier]

        MiniJS.state.addDependency(identifier, this.id)
      }
    })
  }

  async _interpret(expr, options = {}) {
    const Engine = options.isClass ? ClassInterpreter : Interpreter
    const engine = new Engine(expr, options)
    const ids = {
      $: 'document.querySelector',
      el: `proxyWindow['${this.uuid}']`,
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
      const entity = MiniJS.elements.find(
        (e) => e.uuid == parentNode.dataset.uuid
      )
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

    MiniJS.elements.push(this)
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
    const variables = []

    // Remove event bindings
    for (const element of elements) {
      if (element.nodeType !== 1) continue

      const entity = MiniJS.elements.find(
        (entity) => entity.element === element
      )
      if (!entity) continue

      variables.push(...entity.variables)
      MiniJS.state.removeEntity(entity)
      entity.events.dispose()
    }

    // Remove disposed elements
    MiniJS.elements = MiniJS.elements.filter(
      (entity) => !elements.includes(entity.element)
    )

    // Clean up unused variables
    const usedVariables = MiniJS.elements.reduce(
      (acc, entity) => acc.concat(entity.variables),
      []
    )

    const unusedVariables = variables.filter(
      (variable) => !usedVariables.includes(variable)
    )

    unusedVariables.forEach((variable) => {
      if (variable.startsWith('el.') || variable === 'el') {
        delete window[this.uuid]
        const varName = variable.replace('el.', '')
        MiniJS.state.disposeDependency(this.uuid)
        MiniJS.state.disposeEntityDependency(this.uuid, varName)
      } else {
        delete window[variable]
        MiniJS.state.disposeDependency(variable)
      }
    })
  }
}
