import { Events } from './events'
import { escapeHTML } from '../helpers/sanitize'

export class Attributes {
  static CUSTOM_ATTRIBUTES = [':class', ':text', ':value', ':checked', ':each']

  static isValidAttribute(attribute, element) {
    if (!attribute.startsWith(':')) return false
    if (Events.isValidEvent(attribute)) return false
    if (Attributes.CUSTOM_ATTRIBUTES.includes(attribute)) return true

    const [nativeAttr] = attribute.replace(':', '').split('.')
    if (element[nativeAttr] !== undefined) return false

    return true
  }

  constructor(base) {
    this.base = base
    this.dynamicAttributes = []
    this.childClone = null
    this.initialState = { className: this.base.element.className }

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

  get baseClasses() {
    return this.initialState.className.split(' ')
  }

  async evaluate() {
    await this.evaluateClass()
    await this.evaluateText()
    await this.evaluateValue()

    for (const attr of this.dynamicAttributes) {
      if (Attributes.CUSTOM_ATTRIBUTES.includes(attr)) continue
      await this.evaluateAttribute(attr)
    }

    await this.evaluateEach()
  }

  async evaluateAttribute(attr) {
    if (!Attributes.isValidAttribute(attr, this.base.element)) return
    if (attr === ':class') await this.evaluateClass()
    else if (attr === ':text') await this.evaluateText()
    else if ([':value', ':checked'].includes(attr)) await this.evaluateValue()
    else if (attr === ':each') await this.evaluateEach()
    else {
      if (!this.dynamicAttributes.includes(attr))
        this.dynamicAttributes.push(attr)
      await this.evaluateOtherAttributes()
    }
  }

  async evaluateClass() {
    const expr = this.base.element.getAttribute(':class')
    if (!expr) return

    this.base.element.className = await this.base._interpret(expr, {
      base: this.baseClasses,
      isClass: true,
    })
  }

  async evaluateText() {
    const textExpr = this.base.element.getAttribute(':text')
    if (!textExpr) return

    const newText = await this.base._interpret(textExpr)

    if (newText || newText == '') this.base.element.innerText = newText
  }

  async evaluateValue() {
    const valueExpr = this.base.element.getAttribute(':value')

    if (valueExpr) {
      const newValue = await this.base._interpret(valueExpr)

      if (this.base.element.value !== newValue && newValue != null)
        this.base.element.value = newValue
    }

    const checkedExpr = this.base.element.getAttribute(':checked')

    if (checkedExpr) {
      const newValue = await this.base._interpret(checkedExpr)

      if (newValue) this.base.element.checked = newValue
    }
  }

  async evaluateOtherAttributes() {
    for (const attr of this.dynamicAttributes) {
      if (Attributes.CUSTOM_ATTRIBUTES.includes(attr)) continue

      const expr = this.base.element.getAttribute(attr)
      if (!expr) return

      const newValue = await this.base._interpret(expr)
      const nativeAttr = attr.slice(1)

      if (this.base.element[nativeAttr] !== newValue && newValue != null)
        this.base.element[nativeAttr] = newValue
    }
  }

  async evaluateEach() {
    const eachExpr = this.base.element.getAttribute(':each')

    if (eachExpr == null) return

    const [args, iterable] = eachExpr.split(' in ')
    const [variable, indexName] = args.split(',').map((v) => v.trim())
    const items = await this.base._interpret(iterable)
    this.childClone ||= this.base.element.innerHTML

    let newHTML = ''

    items.forEach((item, index) => {
      // TODO: Use the lexer to replace the variables
      newHTML += this.childClone
        .replaceAll(indexName, index)
        .replaceAll(variable, `'${escapeHTML(item)}'`)
    })

    // ObserveDOM will be called for updated DOM to initialize the entities
    this.base.element.innerHTML = newHTML
  }
}