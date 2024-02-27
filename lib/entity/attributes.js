import { Events } from './events'
import { Interpreter, ClassInterpreter } from '../generators/interpreter'
import { kebabToCamelCase } from '../helpers/strings'
import { State } from '../state'

export class Attributes {
  static CUSTOM_ATTRIBUTES = [
    ':class',
    ':text',
    ':value',
    ':checked',
    ':each',
    ':each.item',
    ':group',
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

  constructor(base) {
    this.base = base
    this.dynamicAttributes = []
    this.initialState = { classList: this.base.element.classList }

    this.evaluateEachItem()
    this._getDynamicAttributes()
  }

  _getDynamicAttributes() {
    const el = this.base.element

    for (let i = 0; i < el.attributes.length; i++) {
      const attr = el.attributes[i]

      if (!Attributes.isValidAttribute(attr.name, el)) continue
      if (!this.dynamicAttributes.includes(attr.name))
        this.dynamicAttributes.push(attr.name)
    }
  }

  _handleError(attr, expr, error) {
    if (!this.base.isExists()) return
    console.error(
      `Failed to evaluate ${attr} for ${this.base.id}:\n\nCode:\n${expr}\n\n`,
      error
    )
  }

  async _interpret(expr, options = {}) {
    const Engine = options.isClass ? ClassInterpreter : Interpreter
    const engine = new Engine(expr, options)
    const ids = {
      $: 'document-querySelector',
      el: `proxyWindow['${this.base.id}${State.DISABLE_RE_RENDER_KEY}']`,
      // "this" is set under the interpreter as bind context
    }

    if (this.base.group)
      ids.group = `proxyWindow['${this.base.group.id}${State.DISABLE_RE_RENDER_KEY}']`

    engine.replace(ids)

    // window variables are used instead of proxy window
    // to avoid triggering re-renders (infinite loop)
    return await engine.interpret(this.base, this.base.state)
  }

  async evaluate() {
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
    if (!Attributes.isValidAttribute(attr, this.base.element)) return
    if (attr === ':group') this.evaluateGroup()
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
    if (!this.base.isInsideEachItem()) return
    if (this.base.isEachItemEvaluated()) return

    const state = {}

    const eachItemEl = this.base.getEachItemEl()

    Object.entries(eachItemEl.dataset).forEach(([key, value]) => {
      if (!key.startsWith('mini.each:')) return

      const name = key.replace('mini.each:', '')

      try {
        this.base.state[name] = JSON.parse(value)
      } catch (error) {
        console.error(
          `Failed to parse dataset.${key} for Entity#${this.base.id}:`,
          error
        )
      }
    })
  }

  evaluateGroup() {
    if (!this.base.element.hasAttribute(':group')) return
    if (this.base.isGroup()) return
    this.base.setAsGroup()
  }

  async evaluateClass() {
    const expr = this.base.element.getAttribute(':class')
    if (!expr) return

    try {
      const updatedClassNames = await this._interpret(expr, {
        base: this.initialState.classList,
        isClass: true,
      })

      this.base.element.setAttribute('class', updatedClassNames)
    } catch (error) {
      this._handleError(':class', expr, error)
    }
  }

  async evaluateText() {
    const expr = this.base.element.getAttribute(':text')
    if (!expr) return

    try {
      const newText = await this._interpret(expr)

      if (newText || newText == '') this.base.element.textContent = newText
    } catch (error) {
      this._handleError(':text', expr, error)
    }
  }

  async evaluateValue() {
    const expr = this.base.element.getAttribute(':value')
    if (!expr) return

    try {
      const newValue = await this._interpret(expr)

      if (this.base.element.value !== newValue && newValue != null)
        this.base.element.value = newValue
    } catch (error) {
      this._handleError(':value', expr, error)
    }
  }

  async evaluateChecked() {
    const expr = this.base.element.getAttribute(':checked')
    if (!expr) return

    try {
      const isChecked = await this._interpret(expr)

      if (this.base.element.checked !== isChecked && isChecked != null)
        this.base.element.checked = isChecked
    } catch (error) {
      this._handleError(':checked', expr, error)
    }
  }

  async evaluateOtherAttributes() {
    for (const attr of this.dynamicAttributes) {
      if (Attributes.CUSTOM_ATTRIBUTES.includes(attr)) continue

      const expr = this.base.element.getAttribute(attr)
      if (!expr) return

      try {
        const newValue = await this._interpret(expr)
        const nativeAttr = kebabToCamelCase(attr.slice(1))

        if (attr.startsWith(':data-')) {
          if (
            this.base.element.dataset[nativeAttr.slice(4)] !== newValue &&
            newValue != null
          ) {
            const datasetAttr =
              nativeAttr[4].toLowerCase() + nativeAttr.slice(5)
            this.base.element.dataset[datasetAttr] = newValue
          }
        } else if (
          this.base.element[nativeAttr] !== newValue &&
          newValue != null
        )
          this.base.element[nativeAttr] = newValue
      } catch (error) {
        this._handleError(attr, expr, error)
      }
    }
  }

  async evaluateEach() {
    const eachExpr = this.base.element.getAttribute(':each')

    if (eachExpr == null) return

    const [args, iterable] = eachExpr.split(' in ')
    const [variable, indexName] = args.split(',').map((v) => v.trim())

    try {
      const items = await this._interpret(iterable)
      this.childClone ||= this.base.element.cloneNode(true).children

      this.base.element.innerHTML = ''

      items.forEach((item, index) => {
        Array.from(this.childClone).forEach((child) => {
          const clonedChild = child.cloneNode(true)
          clonedChild.setAttribute(':each.item', false)
          clonedChild.dataset[`mini.each:${variable}`] = JSON.stringify(item)
          if (indexName) clonedChild.dataset[`mini.each:${indexName}`] = index

          // ObserveDOM will be called for updated DOM to initialize the entities
          this.base.element.appendChild(clonedChild)
        })
      })
    } catch (error) {
      this._handleError(':each', iterable, error)
    }
  }
}
