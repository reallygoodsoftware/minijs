import { Events } from '@/entity/events'
import { Interpreter, ClassInterpreter } from '@/generators/interpreter'
import { kebabToCamelCase } from '@/helpers/strings'
import { State } from '@/state'
import { Mini } from '@/main'

export class Attributes {
  static CUSTOM_ATTRIBUTES = [
    ':class',
    ':text',
    ':value',
    ':checked',
    ':each',
    ':each.item',
    ':scope',
  ]
  static FORBIDDEN_ATTRIBUTES = [':innerHTML', ':innerText']

  static isValidAttribute(attribute, element) {
    if (!attribute.startsWith(':')) return false
    if (Attributes.FORBIDDEN_ATTRIBUTES.includes(attribute)) return false
    if (Events.isValidEvent(attribute)) return false
    if (Attributes.CUSTOM_ATTRIBUTES.includes(attribute)) return true

    const [nativeAttr] = attribute.replace(':', '').split('.')

    if (nativeAttr.startsWith('data-')) return true
    if (element[kebabToCamelCase(nativeAttr)] === undefined) return false

    return true
  }

  constructor(entity) {
    this.base = new Mini()
    this.entity = entity
    this.dynamicAttributes = []
    this.initialState = { classList: this.entity.element.classList }

    this.evaluateEachItem()
    this._getDynamicAttributes()
  }

  _getDynamicAttributes() {
    const el = this.entity.element

    for (let i = 0; i < el.attributes.length; i++) {
      const attr = el.attributes[i]

      if (!Attributes.isValidAttribute(attr.name, el)) continue
      if (!this.dynamicAttributes.includes(attr.name))
        this.dynamicAttributes.push(attr.name)
    }
  }

  _handleError(attr, expr, error) {
    if (!this.entity.isExists()) return
    console.error(
      `Failed to evaluate ${attr} for ${this.entity.id}:\n\nCode:\n${expr}\n\n`,
      error
    )
  }

  async _interpret(expr, options = {}) {
    const Engine = options.isClass ? ClassInterpreter : Interpreter
    const engine = new Engine(expr, options)
    const ids = {
      $: 'document-querySelector',
      el: `proxyWindow['${this.entity.id}${State.DISABLE_RE_RENDER_KEY}']`,
      scope: this.entity.scope
        ? `proxyWindow['${this.entity.scope.id}${
            !options.isScope ? State.DISABLE_RE_RENDER_KEY : ''
          }']`
        : undefined,
      ...(options.ids || {}),
      // "this" is set under the interpreter as bind context
    }

    engine.replace(ids)

    // window variables are used instead of proxy window
    // to avoid triggering re-renders (infinite loop)
    return await engine.interpret(this.entity, this.entity.state)
  }

  async evaluateVariable(variable) {
    const attributes = this.entity.data.getVariableAttributes(variable)

    const promises = []

    attributes.forEach((attr) => {
      promises.push(this.evaluateAttribute(attr))
    })

    await Promise.all(promises)
  }

  async evaluate() {
    await this.evaluateAttribute(':scope')
    await this.evaluateClass()
    await this.evaluateText()
    await this.evaluateValue()
    await this.evaluateChecked()

    for (const attr of this.dynamicAttributes) {
      if (Attributes.CUSTOM_ATTRIBUTES.includes(attr)) continue
      await this.evaluateAttribute(attr)
    }

    await this.evaluateEach()
  }

  async evaluateAttribute(attr) {
    if (!Attributes.isValidAttribute(attr, this.entity.element)) return
    if (attr === ':scope') await this.evaluateScope()
    else if (attr === ':class') await this.evaluateClass()
    else if (attr === ':text') await this.evaluateText()
    else if (attr === ':value') await this.evaluateValue()
    else if (attr === ':checked') await this.evaluateChecked()
    else if (attr === ':each') await this.evaluateEach()
    else if (attr === ':each.item') await this.evaluateEachItem()
    else {
      if (!this.dynamicAttributes.includes(attr))
        this.dynamicAttributes.push(attr)
      await this.evaluateOtherAttributes()
    }
  }

  evaluateEachItem() {
    if (!this.entity.isInsideEachItem()) return
    if (this.entity.isEachItemEvaluated()) return

    const state = {}

    const eachItemEl = this.entity.getEachItemEl()

    Object.entries(eachItemEl.dataset).forEach(([key, value]) => {
      if (!key.startsWith('mini.each:')) return

      const name = key.replace('mini.each:', '')

      try {
        this.entity.state[name] = JSON.parse(value)
      } catch (error) {
        console.error(
          `Failed to parse dataset.${key} for Entity#${this.entity.id}:`,
          error
        )
      }
    })
  }

  /*
    :scope is a special attribute that acts as an :load event
    when it has a given expr. Unlike other attributes, state updates
    inside :scope will trigger re-renders.

    NOTE: This should NOT be used in this.evaluate() because it will
    trigger an infinite loop.
  */
  async evaluateScope() {
    if (!this.entity.isScope()) return

    const expr = this.entity.element.getAttribute(':scope')
    if (!expr) return

    const ids = {}

    // null for dynamically inserted nodes
    if (window[this.entity.id] == null)
      window[this.entity.id] = this.base.state.create({}, this.entity.id)

    this.entity.data.scopeVariables.forEach((variable) => {
      ids[variable] = `proxyWindow['${this.entity.id}'].${variable}`
    })

    try {
      await this._interpret(expr, { isScope: true, ids })
    } catch (error) {
      this._handleError(':scope', expr, error)
    }
  }

  async evaluateClass() {
    const expr = this.entity.element.getAttribute(':class')
    if (!expr) return

    try {
      const updatedClassNames = await this._interpret(expr, {
        base: this.initialState.classList,
        isClass: true,
      })

      this.entity.element.setAttribute('class', updatedClassNames)
    } catch (error) {
      this._handleError(':class', expr, error)
    }
  }

  async evaluateText() {
    const expr = this.entity.element.getAttribute(':text')
    if (!expr) return

    try {
      const newText = await this._interpret(expr)

      if (newText || newText == '') this.entity.element.textContent = newText
    } catch (error) {
      this._handleError(':text', expr, error)
    }
  }

  async evaluateValue() {
    const expr = this.entity.element.getAttribute(':value')
    if (!expr) return

    try {
      const newValue = await this._interpret(expr)

      if (this.entity.element.value !== newValue && newValue != null)
        this.entity.element.value = newValue
    } catch (error) {
      this._handleError(':value', expr, error)
    }
  }

  async evaluateChecked() {
    const expr = this.entity.element.getAttribute(':checked')
    if (!expr) return

    try {
      const isChecked = await this._interpret(expr)

      if (this.entity.element.checked !== isChecked && isChecked != null)
        this.entity.element.checked = isChecked
    } catch (error) {
      this._handleError(':checked', expr, error)
    }
  }

  async evaluateOtherAttributes() {
    for (const attr of this.dynamicAttributes) {
      if (Attributes.CUSTOM_ATTRIBUTES.includes(attr)) continue

      const expr = this.entity.element.getAttribute(attr)
      if (!expr) return

      try {
        const newValue = await this._interpret(expr)
        const nativeAttr = kebabToCamelCase(attr.slice(1))

        if (attr.startsWith(':data-')) {
          if (
            this.entity.element.dataset[nativeAttr.slice(4)] !== newValue &&
            newValue != null
          ) {
            const datasetAttr =
              nativeAttr[4].toLowerCase() + nativeAttr.slice(5)
            this.entity.element.dataset[datasetAttr] = newValue
          }
        } else if (
          this.entity.element[nativeAttr] !== newValue &&
          newValue != null
        )
          this.entity.element[nativeAttr] = newValue
      } catch (error) {
        this._handleError(attr, expr, error)
      }
    }
  }

  async evaluateEach() {
    const eachExpr = this.entity.element.getAttribute(':each')

    if (eachExpr == null) return

    const [args, iterable] = eachExpr.split(' in ')
    const [variable, indexName] = args.split(',').map((v) => v.trim())

    try {
      const items = await this._interpret(iterable)
      this.entity.setEachItemTemplate()
      this.childClone ||= this.entity.getEachItemTemplate().children

      this.entity.element.innerHTML = ''

      items.forEach((item, index) => {
        Array.from(this.childClone).forEach((child) => {
          const clonedChild = child.cloneNode(true)
          clonedChild.setAttribute(':each.item', false)
          clonedChild.dataset[`mini.each:${variable}`] = JSON.stringify(item)
          if (indexName) clonedChild.dataset[`mini.each:${indexName}`] = index

          // ObserveDOM will be called for updated DOM to initialize the entities
          this.entity.element.appendChild(clonedChild)
        })
      })
    } catch (error) {
      this._handleError(':each', iterable, error)
    }
  }

  disposeAttribute(attr) {
    this.entity.data.deleteAttribute(attr)
    this.dynamicAttributes = this.dynamicAttributes.filter((a) => a !== attr)
  }
}
