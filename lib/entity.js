
export default class Entity {
  constructor(el) {
    this.element = el
    this.tagName = el.tagName

    this.initialState = {
      className: el.className,
    }
  }

  get variables() {
    const allVariables = MiniJS.variables
    const attributeToken = Array.from(this.element.attributes).map(attr => attr.value).join(" ");
    const filtered = allVariables.filter(v => attributeToken.includes(v))
    
    return filtered
  }

  get baseClasses() {
    return this.initialState.className.split(" ")
  }

  _eventAction(attrName) {
    const attrVal = this.element.getAttribute(attrName)
    return this._sanitizeExpression(attrVal)
  }

  _sanitizeExpression(expr) {
    //  Add proxyWindow
    
    this.variables.forEach(variable => {
      if (expr.includes(variable) && !expr.includes(`proxyWindow.${variable}`)) {
        expr = expr.replace(variable, `proxyWindow.${variable}`)
      }
    })
    
    expr = expr.replace("this", "this.element")
    return expr
  }

  evaluateEventAction(attrName) {
    eval(this._eventAction(attrName))
  }

  evaluateClass() {
    const classExpr = this.element.getAttribute(":class");
    if (classExpr) {
      const newClassNames = eval(classExpr)
      const classesCombined = [...this.baseClasses, ...newClassNames.split(" ")].join(" ")
      this.element.className = classesCombined;
    }
  }

  evaluateText() {
    const textExpr = this.element.getAttribute(":text");
      if (textExpr) {
        const newText = eval(textExpr)
        if (newText)
          this.element.innerText = newText;
      }
  }

  evaluateValue() {
    const valueExpr = this.element.getAttribute(":value");
    if (valueExpr) {
      const newValue = eval(valueExpr)
      if (newValue)
      {
        this.element.value = newValue
      }
    }

    const checkedExpr = this.element.getAttribute(":checked");
    if (checkedExpr) {
      const newValue = eval(checkedExpr)
      if (newValue)
      {
        this.element.checked = newValue
      }
    }
  }

  hasAttribute(attr) {
    return !!this.element.getAttribute(attr)
  }
}