import { Interpreter, ClassInterpreter } from './generators/interpreter'
import { Lexer } from './generators/lexer'
import { escapeHTML } from './helpers/sanitize'
import { Events } from './entity/events'

export default class Entity {
  constructor(el) {
    this.element = el
    this.tagName = el.tagName
    this.initialState = {
      className: el.className,
    }
    this.variables = []
    this.dynamicAttributes = []
    this.id = this.generateEntityUUID()

    this.events = new Events(this)

    this._getDynamicAttributes()

    if (MiniJS.debug) this.element.dataset.entityId = this.id
  }

  setAsParent() {
    this.uuid = this.id
    this.element.dataset.uuid = this.uuid
  }

  isParent() {
    return !!this.uuid
  }

  isDynamicAttribute(attr) {
    if (!attr.startsWith(':')) return false
    if (MiniJS.allCustomBindings.includes(attr)) return false
    if (this.events.trackedEvents.includes(attr)) return false
    return true
  }

  _getDynamicAttributes() {
    for (let i = 0; i < this.element.attributes.length; i++) {
      const attr = this.element.attributes[i]
      if (!this.isDynamicAttribute(attr.name)) continue
      if (this.dynamicAttributes.includes(attr.name)) continue
      this.dynamicAttributes.push(attr.name)
    }
  }

  getVariables() {
    this._getVariablesFromAttributes()
    this._getVariablesFromEvents()
    this._initVariables()
  }

  _getVariablesFromAttributes() {
    const RESERVED_KEYWORDS = ['$', 'window', 'document', 'console']
    const CUSTOM_ATTRIBUTES = [':each', ':class', ':text', ':value', ':checked']

    const attributes = [...this.dynamicAttributes, ...CUSTOM_ATTRIBUTES]

    attributes.forEach((name) => {
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

    this.events.trackedEvents.forEach((event) => {
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
    MiniJS.variables = [...new Set(MiniJS.variables.concat(this.variables))]

    this.variables.forEach((variable) => {
      if (variable.startsWith('el.')) {
        this.setAsParent()

        if (!this.parent) this.parent = this.getParent()

        const varName = variable.replace('el.', '')

        if (!window[this.uuid]) window[this.uuid] = {}

        // ! FIXME: Any changes to el.varName isn't being watched
        window[this.uuid][varName] = MiniJS.tryFromLocal(
          variable.replace('el.', this.uuid + '.')
        )

        if (!this.variables.includes(this.uuid)) this.variables.push(this.uuid)
      } else if (typeof window[variable] === 'function') {
        this.variables.splice(this.variables.indexOf(variable), 1)
        MiniJS.variables.splice(MiniJS.variables.indexOf(variable), 1)
      } else {
        window[variable] = variable.startsWith('$')
          ? MiniJS.tryFromLocal(variable)
          : window[variable]
      }
    })
  }

  get baseClasses() {
    return this.initialState.className.split(' ')
  }

  async _interpret(expr, options = {}) {
    const Engine = options.isClass ? ClassInterpreter : Interpreter
    const engine = new Engine(expr, options)
    const ids = { $: 'document.querySelector' }

    if (this.parent?.uuid) ids.el = `proxyWindow['${this.parent.uuid}']`

    this.variables.forEach((variable) => {
      if (variable.startsWith('el.') || variable === 'el') return

      ids[variable] = `proxyWindow-${variable}`
    })

    engine.replace(ids, ['declared'])

    return await engine.interpret(this)
  }

  /* Note: I don't this getParent() is needed,
    since el. variables should use the current element's uuid instead. */
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
    // Suggestion: we can use crypto.randomUUID(). Tho crypto only works in secure contexts
    return 'Entity' + Date.now() + Math.floor(Math.random() * 10000)
  }

  async init() {
    this.getVariables()
    this.events.apply()
    await this.evaluateAll()

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

  async evaluateClass() {
    const expr = this.element.getAttribute(':class')
    if (!expr) return

    this.element.className = await this._interpret(expr, {
      base: this.baseClasses,
      isClass: true,
    })
  }

  async evaluateEach() {
    const eachExpr = this.element.getAttribute(':each')

    if (eachExpr) {
      const [args, iterable] = eachExpr.split(' in ')
      const [variable, indexName] = args.split(',').map((v) => v.trim())
      const items = await this._interpret(iterable)
      this.childClone ||= this.element.innerHTML

      let newHTML = ''

      items.forEach((item, index) => {
        // TODO: Use the lexer to replace the variables
        newHTML += this.childClone
          .replaceAll(indexName, index)
          .replaceAll(variable, `'${escapeHTML(item)}'`)
      })

      // ObserveDOM will be called for updated DOM to initialize the entities
      this.element.innerHTML = newHTML
    }
  }

  async evaluateAttribute(attribute) {
    if (attribute === ':class') this.evaluateClass()
    else if (attribute === ':text') this.evaluateText()
    else if ([':value', ':checked'].includes(attribute)) this.evaluateValue()
    else if (attribute === ':each') this.evaluateEach()
    else if (this.isDynamicAttribute(attribute)) {
      if (!this.dynamicAttributes.includes(attribute))
        this.dynamicAttributes.push(attribute)
      this.evaluateDynamicAttributes()
    }
  }

  async evaluateAll() {
    await this.evaluateValue()
    await this.evaluateClass()
    await this.evaluateText()
    await this.evaluateDynamicAttributes()
  }

  async evaluateDynamicAttributes() {
    for (const attr of this.dynamicAttributes) {
      const expr = this.element.getAttribute(attr)
      if (!expr) return

      const newValue = await this._interpret(expr)
      const nativeAttr = attr.slice(1)

      if (this.element[nativeAttr] !== newValue && newValue != null)
        this.element[nativeAttr] = newValue
    }
  }

  async evaluateText() {
    const textExpr = this.element.getAttribute(':text')
    if (!textExpr) return

    const newText = await this._interpret(textExpr)

    if (newText || newText == '') this.element.innerText = newText
  }

  async evaluateValue() {
    const valueExpr = this.element.getAttribute(':value')

    if (valueExpr) {
      const newValue = await this._interpret(valueExpr)

      if (this.element.value !== newValue && newValue != null)
        this.element.value = newValue
    }

    const checkedExpr = this.element.getAttribute(':checked')

    if (checkedExpr) {
      const newValue = await this._interpret(checkedExpr)

      if (newValue) this.element.checked = newValue
    }
  }

  hasAttribute(attr) {
    return !!this.element.getAttribute(attr)
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

    MiniJS.variables = MiniJS.variables.filter(
      (variable) => !unusedVariables.includes(variable)
    )

    unusedVariables.forEach((variable) => {
      if (variable.startsWith('el.')) {
        const varName = variable.replace('el.', '')
        if (window[this.uuid]?.[varName]) delete window[this.uuid]
      } else {
        delete window[variable]
      }
    })
  }
}
