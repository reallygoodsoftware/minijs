import { Interpreter, ClassInterpreter } from './generators/interpreter'
import { Lexer } from './generators/lexer'
import { escapeHTML } from './helpers/sanitize'

export default class Entity {
  constructor(el) {
    this.element = el
    this.tagName = el.tagName
    this.initialState = {
      className: el.className,
    }
    this.variables = []
    this.listener = {}
    this.dynamicAttributes = []
    this.id = this.generateEntityUUID()

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

  _getDynamicAttributes() {
    for (let i = 0; i < this.element.attributes.length; i++) {
      const attr = this.element.attributes[i]
      if (MiniJS.allCustomBindings.includes(attr.name)) continue
      if (
        MiniJS.allEvents.includes(attr.name) ||
        this.allEvents.includes(attr.name)
      )
        continue
      if (!attr.name.startsWith(':')) continue
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

    this.allEvents.forEach((event) => {
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

  get allEvents() {
    const allMainEvents = MiniJS.allEvents
    const eventsSet = new Set(allMainEvents)
    const attributeNames = Array.from(this.element.attributes).map(
      (attr) => attr.name
    )

    const intersections = attributeNames.filter((value) => {
      if (eventsSet.has(value)) return true
      if (!value.startsWith(':')) return false

      const nativeEventName = `on${value.substring(1)}`
      return eventsSet.has(nativeEventName)
    })

    return intersections
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

  async init(shouldAdd = false) {
    this.getVariables()
    this.applyEventBindings()
    await this.evaluateAll()

    if (shouldAdd || !this.isInsideEachElement()) MiniJS.elements.push(this)
  }

  initChildren() {
    const elements = this.element.querySelectorAll('*')

    for (let i = 0; i < elements.length; i++) {
      const element = elements[i]
      if (element.nodeType !== 1) continue

      try {
        const entity = new Entity(element)
        entity.init(true)
      } catch (error) {
        console.error('Failed to initialize child entity:', error)
      }
    }
  }

  isInsideEachElement() {
    let value = this.element.parentElement

    while (value) {
      if (value.hasAttribute && value.hasAttribute(':each')) return true
      value = value.parentElement
    }

    return false
  }

  async evaluateEventAction(attrName) {
    const attrVal = this.element.getAttribute(attrName)
    await this._interpret(attrVal)
  }

  async evaluateClass() {
    const expr = this.element.getAttribute(':class')
    if (!expr) return

    this.element.className = await this._interpret(expr, {
      base: this.baseClasses,
      isClass: true,
    })
  }

  async evaluateLoadEvents() {
    const loadExpr = this.element.getAttribute(':load')
    if (!loadExpr) return
    await this.evaluateEventAction(':load')
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

  applyEventBindings() {
    const el = this.element

    // Change binding
    if (el.hasAttribute(':change')) {
      this.listener[':change'] = {
        el,
        eventName:
          el.type == 'checkbox' || el.tagName == 'select' ? 'change' : 'input',
        event: () => {
          this.evaluateEventAction(':change')
        },
      }
    }

    if (el.hasAttribute(':clickout')) {
      this.listener[':clickout'] = {
        el: document,
        eventName: 'click',
        event: (e) => {
          if (!document.documentElement.contains(e.target)) return
          if (el.contains(e.target)) return
          this.evaluateEventAction(':clickout')
        },
      }
    }

    if (el.hasAttribute(':press')) {
      this.listener[':press'] = []
      this.listener[':press'].push({
        el,
        eventName: 'keyup',
        event: (e) => {
          if (e.target !== el) return
          if (!['Enter', 'Space'].includes(e.code)) return
          if (e.code == 'Space') e.preventDefault()
          this.evaluateEventAction(':press')
        },
      })

      this.listener[':press'].push({
        el,
        eventName: 'click',
        event: (e) => {
          this.evaluateEventAction(':press')
        },
      })

      this.listener[':press'].push({
        el,
        eventName: 'touchstart',
        event: (e) => {
          this.evaluateEventAction(':press')
        },
      })
    }

    // Other Event Bindings
    Array.from(el.attributes).forEach((attr) => {
      if (
        attr.name.startsWith(':') &&
        !MiniJS.allCustomBindings.includes(attr.name)
      ) {
        const nativeEventName = attr.name.substring(1)
        this.listener[attr.name] = {
          el,
          eventName: nativeEventName,
          event: () => {
            this.evaluateEventAction(attr.name)
          },
        }
      } else if (attr.name.startsWith(':keyup.')) {
        const [event, keycode] = attr.name.split('.')
        const nativeEventName = event.substring(1)

        let key = keycode[0].toUpperCase() + keycode.slice(1)

        if (['up', 'down', 'left', 'right'].includes(keycode)) {
          key = 'Arrow' + key
        } else if (!['enter', 'space'].includes(keycode)) {
          return
        }

        this.listener[attr.name] = {
          el,
          eventName: nativeEventName,
          event: (e) => {
            if (e.target !== el) return
            if (e.key !== key) return
            this.evaluateEventAction(attr.name)
          },
        }
      }
    })

    // Add event listeners
    Object.keys(this.listener).forEach((key) => {
      const listener = this.listener[key]

      if (Array.isArray(listener)) {
        listener.forEach(({ el, eventName, event }) => {
          el.addEventListener(eventName, event)
        })
      } else {
        const { el, eventName, event } = listener
        el.addEventListener(eventName, event)
      }
    })
  }

  hasAttribute(attr) {
    return !!this.element.getAttribute(attr)
  }

  removeEventBindings() {
    Object.keys(this.listener).forEach((key) => {
      const { el, eventName, event } = this.listener[key]
      el.removeEventListener(eventName, event)
    })
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
      entity.removeEventBindings()
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
        delete window[this.uuid][varName]
      } else {
        delete window[variable]
      }
    })
  }
}
