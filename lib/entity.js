
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

  evaluateEach() {
    const eachExpr = this.element.getAttribute(":each");

    if (eachExpr) {
      const [variable, iterable] = eachExpr.split(' in ');
      const items = eval(iterable);
      this.childClone ||= this.element.innerHTML

      let newHTML = ''

      items.forEach(item => {
        newHTML += this.childClone.replaceAll(variable, `'${item}'`)
      })

      this.element.innerHTML = newHTML
      
      const xpathResult = document.evaluate(
        './/*[@*[starts-with(name(), ":")]]',
        this.element, // Use the current :each element as the context node
        null,
        XPathResult.ORDERED_NODE_SNAPSHOT_TYPE,
        null
      );
    
      for (let i = 0; i < xpathResult.snapshotLength; i++) {
        const entity = new Entity(xpathResult.snapshotItem(i))
        entity.applyEventBindings()
        entity.evaluateAll()
      }
    
    }
  }

  evaluateAll() {
    this.evaluateValue()
    this.evaluateClass()
    this.evaluateText()
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

  applyEventBindings() {
    const el = this.element
    // Click binding
    if (el.hasAttribute(":click")) {
      el.addEventListener("click", (e) => {
        this.evaluateEventAction(":click")
      });
    }

    // Change binding
    if (el.hasAttribute(":change")) {
      if (el.type == "checkbox" || el.tagName == "select") {
        el.addEventListener("change", (e) => {
          this.evaluateEventAction(":change")
        });
      } else {
        el.addEventListener("input", (e) => {
          this.evaluateEventAction(":change")
        });
      }
    }

    if (el.hasAttribute(":enter")) {
      el.addEventListener("keypress", (e) => {
        if ( e.key == "Enter") {
          this.evaluateEventAction(":enter")
        }
      });
    }

    if (el.hasAttribute(":keypress")) {
      el.addEventListener("keypress", (e) => {
        this.evaluateEventAction(":keypress")
      });
    }

    if (el.hasAttribute(":keydown")) {
      el.addEventListener("keydown", (e) => {
        this.evaluateEventAction(":keydown")
      });
    }

    if (el.hasAttribute(":keyup")) {
      el.addEventListener("keyup", (e) => {
        this.evaluateEventAction(":keyup")
      });
    }

    document.addEventListener('click', (e) => {
      if (el.hasAttribute(":clickout") && !el.contains(e.target))
      {
        this.evaluateEventAction(":clickout")
      }
    });
  }

  hasAttribute(attr) {
    return !!this.element.getAttribute(attr)
  }
}