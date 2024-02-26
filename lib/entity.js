import { Lexer } from './generators/lexer'
import { Events } from './entity/events'
import { Attributes } from './entity/attributes'
import { State } from './state'
import { Mini } from './main'

const IGNORED_IDS = ['$', 'this']

export class Entity {
  constructor(el, dynamicScripts = []) {
    this.base = new Mini()
    this.element = el
    this.tagName = el.tagName
    this.dynamicScripts = dynamicScripts

    this.variables = []
    this.id = this.generateEntityUUID()

    this.state = {}
    this.events = new Events(this)
    this.attributes = new Attributes(this)
    this.base.state.addEntity(this)

    if (this.base.debug) this.element.dataset.entityId = this.id

    this.attributes.evaluateParent()
  }

  setAsParent() {
    this.uuid = this.id
    this.element.dataset['mini.uuid'] = this.uuid
  }

  isParent() {
    return !!this.uuid
  }

  isExists() {
    return document.documentElement.contains(this.element)
  }

  isInsideEachEl() {
    if (this.element.hasAttribute(':each')) return false
    if (this.element.hasAttribute(':each.item')) return true

    const eachEl = this.getClosestEl(':each')
    return eachEl != null
  }

  getEachEl() {
    return this.getClosestEl(':each')
  }

  getEachItemEl() {
    const eachItemEl = this.element.hasAttribute(':each.item')
      ? this.element
      : this.getClosestEl(':each.item')
    return eachItemEl
  }

  isInsideEachItem() {
    if (this.element.hasAttribute(':each')) return false

    const eachItemEl = this.getEachItemEl()
    return !(eachItemEl == null || eachItemEl?.[':each.item'])
  }

  isEachItem() {
    return this.element.hasAttribute(':each.item')
  }

  isEachItemEvaluated() {
    return (
      this.element.getAttribute(':each.item') === 'true' ||
      this.getClosestEl(':each.item')?.[':each.item'] === 'true'
    )
  }

  getClosestEl(attr) {
    attr = attr.replaceAll(':', '\\:').replaceAll('.', '\\.')

    return this.element.closest(
      `*[${attr}]:not([data\\-mini\\.uuid='${this.uuid}'])`
    )
  }

  getVariables() {
    this._getVariablesFromAttributes()
    this._getVariablesFromEvents()
    this._initVariables()
  }

  _getVariablesFromAttributes() {
    this.attributes.dynamicAttributes.forEach((name) => {
      const attr = this.element.attributes[name]
      if (!attr) return

      if (name === ':each') {
        const [_, variable] = attr.value.split(' in ')

        const isNativeVariable =
          typeof window[variable] === 'function' &&
          window[variable].toString().indexOf('[native code]') === -1

        if (isNativeVariable) return
        if (variable in this.state) return
        this.variables.push(variable)
      }

      if (!attr.value) return

      const lexer = new Lexer(attr.value)

      const identifiers = lexer.identifiers.filter((value) => {
        if (IGNORED_IDS.includes(value)) return false
        const variable = value.split('.')[0]
        return !(variable in this.state)
      })

      this.variables.push(...identifiers)
    })
  }

  _getVariablesFromEvents() {
    this.events.dynamicEvents.forEach((event) => {
      const expr = this.element.getAttribute(event)
      if (!expr) return

      const lexer = new Lexer(expr)

      const identifiers = lexer.identifiers.filter((value) => {
        if (IGNORED_IDS.includes(value)) return false
        const variable = value.split('.')[0]
        return !(variable in this.state)
      })

      this.variables.push(...identifiers)
    })
  }

  _initVariables() {
    this.variables = [...new Set(this.variables)]

    this.variables.forEach((variable) => {
      if (State.isElState(variable)) {
        this.setAsParent()

        if (window[this.id] == null) {
          window[this.id] = this.base.state.create({}, this.id)
        }

        this.base.state.addVariable(this.id, this.id)

        if (variable !== 'el') {
          const [_, varName] = variable.split('.')
          this.base.state.addEntityVariable(this.id, varName, this.id)
        }
      } else if (State.isParentState(variable)) {
        if (!this.parent) this.parent = this.getParent()

        // Cases where parent is not found:
        // - an each item with a :parent directive being removed due to re-evaluation of :each attribute
        if (this.parent == null) return

        if (window[this.parent.id] == null) {
          window[this.parent.id] = this.base.state.create({}, this.parent.id)
        }

        this.base.state.addVariable(this.parent.id, this.id)

        if (variable !== 'parent') {
          const [_, varName] = variable.split('.')
          this.base.state.addEntityVariable(this.parent.id, varName, this.id)
        }
      } else if (typeof window[variable] === 'function') {
        this.variables.splice(this.variables.indexOf(variable), 1)
      } else {
        try {
          const [identifier] = variable.split('.')
          window[identifier] = this.base.state.getState(identifier)
          this.base.state.addVariable(identifier, this.id)
        } catch (error) {
          console.error('Failed to initialize variable:', variable, error)
        }
      }
    })
  }

  getParent() {
    let currentElement = this.element
    let parentNode = this.getClosestEl('data-mini.uuid')

    if (parentNode == null) return { id: 'EntityDocument' }

    const entities = Array.from(this.base.state.entities.values())
    const entity = entities.find(
      (e) => e.uuid == parentNode.dataset['mini.uuid']
    )

    return entity
  }

  generateEntityUUID() {
    return 'Entity' + Date.now() + Math.floor(Math.random() * 10000)
  }

  async init() {
    const isScript = this.element.tagName === 'SCRIPT'

    if (!isScript) await this.base.observer.waitForScripts(this.dynamicScripts)

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
        const entity = new Entity(element, this.dynamicScripts)

        const eachEl = entity.getEachEl()
        const eachItemEl = entity.getEachItemEl()
        const isEachItemAndInitialized =
          eachEl != null && eachItemEl != null && eachEl.contains(eachItemEl)

        if (
          eachEl == null ||
          eachEl === entity.element ||
          isEachItemAndInitialized
        )
          entity.init()
        else entity.dispose()
      } catch (error) {
        console.error('Failed to initialize child entity:', error)
      }
    }

    const eachItemEls = [...this.element.querySelectorAll('*[\\:each\\.item]')]
    if (this.isEachItem()) eachItemEls.push(this.element)

    eachItemEls.forEach((el) => {
      el.setAttribute(':each.item', true)

      Object.entries(el.dataset).forEach(([key, value]) => {
        if (!key.startsWith('mini.each:')) return
        delete el.dataset[key]
      })
    })
  }

  dispose() {
    const elements = [this.element, ...this.element.querySelectorAll('*')]
    const entities = Array.from(this.base.state.entities.values())
    const variables = []

    // Remove event bindings
    for (const element of elements) {
      if (element.nodeType !== 1) continue

      const entity = this.base.state.getEntityByElement(element, entities)

      if (!entity) continue

      variables.push(...entity.variables)
      entity.events.dispose()
      this.base.state.removeEntity(entity)
    }

    // Clean up unused variables
    const usedVariables = entities
      .filter((entity) => !elements.includes(entity.element))
      .reduce((acc, entity) => acc.concat(entity.variables), [])

    const unusedVariables = variables.filter(
      (variable) => !usedVariables.includes(variable)
    )

    this.base.state.disposeVariables(this.id, unusedVariables)
  }
}
