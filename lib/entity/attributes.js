import { Events } from './events'
import { escapeHTML } from '../helpers/sanitize'
import { kebabToCamelCase } from '../helpers/strings'

export class Attributes {
  static CUSTOM_ATTRIBUTES = [
    ':class',
    ':text',
    ':value',
    ':checked',
    ':each',
    ':parent',
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
    this.childClone = null
    this.initialState = { classList: this.base.element.classList }

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

  _handleError(attr, error) {
    if (!this.base.isExists()) return
    console.error(
      `Failed to evaluate ${attr} for Entity#${this.base.id}:`,
      error
    )
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
    if (attr === ':parent') this.evaluateParent()
    else if (attr === ':class') await this.evaluateClass()
    else if (attr === ':text') await this.evaluateText()
    else if (attr === ':value') await this.evaluateValue()
    else if (attr === ':checked') await this.evaluateChecked()
    else if (attr === ':each') await this.evaluateEach()
    else {
      if (!this.dynamicAttributes.includes(attr))
        this.dynamicAttributes.push(attr)
      await this.evaluateOtherAttributes()
    }
  }

  evaluateParent() {
    if (!this.base.element.hasAttribute(':parent')) return
    if (this.base.isParent()) return
    this.base.setAsParent()
  }

  async evaluateClass() {
    const expr = this.base.element.getAttribute(':class')
    if (!expr) return

    try {
      const updatedClassNames = await this.base._interpret(expr, {
        base: this.initialState.classList,
        isClass: true,
      })

      this.base.element.setAttribute('class', updatedClassNames)
    } catch (error) {
      this._handleError(':class', error)
    }
  }

  async evaluateText() {
    const textExpr = this.base.element.getAttribute(':text')
    if (!textExpr) return

    try {
      const newText = await this.base._interpret(textExpr)

      if (newText || newText == '') this.base.element.textContent = newText
    } catch (error) {
      this._handleError(':text', error)
    }
  }

  async evaluateValue() {
    const valueExpr = this.base.element.getAttribute(':value')
    if (!valueExpr) return
    try {
      const newValue = await this.base._interpret(valueExpr)

      if (this.base.element.value !== newValue && newValue != null)
        this.base.element.value = newValue
    } catch (error) {
      this._handleError(':value', error)
    }
  }

  async evaluateChecked() {
    const checkedExpr = this.base.element.getAttribute(':checked')
    if (!checkedExpr) return

    try {
      const isChecked = await this.base._interpret(checkedExpr)

      if (this.base.element.checked !== isChecked && isChecked != null)
        this.base.element.checked = isChecked
    } catch (error) {
      this._handleError(':checked', error)
    }
  }

  async evaluateOtherAttributes() {
    for (const attr of this.dynamicAttributes) {
      if (Attributes.CUSTOM_ATTRIBUTES.includes(attr)) continue

      const expr = this.base.element.getAttribute(attr)
      if (!expr) return

      try {
        const newValue = await this.base._interpret(expr)
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
        this._handleError(attr, error)
      }
    }
  }

  async evaluateEach() {
    const eachExpr = this.base.element.getAttribute(':each')

    if (eachExpr == null) return

    const [args, iterable] = eachExpr.split(' in ')
    const [variable, indexName] = args.split(',').map((v) => v.trim())

    try {
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
    } catch (error) {
      this._handleError(':each', error)
    }
  }
}
