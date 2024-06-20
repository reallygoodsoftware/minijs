import { State } from '@/state'
import { Mini } from '@/main'

import { Lexer } from '@/generators/lexer'

import { Events } from '@/entity/events'
import { Attributes } from '@/entity/attributes'
import { Data } from '@/entity/data'

export class Entity {
  constructor(el, dynamicScripts = []) {
    this.base = new Mini()
    this.element = el
    this.tagName = el.tagName
    this.dynamicScripts = dynamicScripts

    this.id = this.generateEntityUUID()

    this.state = {}
    this.data = new Data(this)
    this.events = new Events(this)
    this.attributes = new Attributes(this)
    this.base.state.addEntity(this)

    if (this.base.debug) this.element.dataset.entityId = this.id

    this.setAsScope()
  }

  setAsScope() {
    if (!this.element.hasAttribute(':scope')) return
    if (this.isScope()) return

    this.uuid = this.id
    this.element.dataset['mini.uuid'] = this.uuid
  }

  isScope() {
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
    this.data.init()
  }

  getScope() {
    const scopeNode = this.getClosestEl('data-mini.uuid')

    if (scopeNode == null) return { id: 'EntityDocument' }

    const entities = Array.from(this.base.state.entities.values())
    const entity = entities.find(
      (e) => e.uuid == scopeNode.dataset['mini.uuid']
    )

    return entity
  }

  generateEntityUUID() {
    return 'Entity' + Date.now() + this.cryptoRandomString()
  }

  cryptoRandomString() {
    return ([1e7] + -1e3 + -4e3 + -8e3 + -1e11).replace(/[018]/g, c =>
      (c ^ crypto.getRandomValues(new Uint8Array(1))[0] & 15 >> c / 4).toString(16)
    );
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
      if (element.tagName === "BUTTON") console.log("disposing element", element, this)
      if (element.nodeType !== 1) continue

      const entity = this.base.state.getEntityByElement(element, entities)

      if (!entity) continue

      variables.push(...entity.data.variables)
      entity.events.dispose()
      this.base.state.removeEntity(entity)
    }

    // Clean up unused variables
    const usedVariables = entities
      .filter((entity) => !elements.includes(entity.element))
      .reduce((acc, entity) => acc.concat(entity.data.variables), [])

    const unusedVariables = variables.filter(
      (variable) => !usedVariables.includes(variable)
    )

    this.base.state.disposeVariables(this.id, unusedVariables)
  }
}
