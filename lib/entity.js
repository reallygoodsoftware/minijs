
export default class Entity {
  constructor(el) {
    this.element = el
    this.tagName = el.tagName
    this.initialState = {
      className: el.className,
    }
    this.variables = []
    this.id = this.generateEntityUUID()
  }

  setAsParent() {
    this.uuid = this.id
    this.element.dataset.uuid = this.uuid
  }

  isParent() {
    return !!this.uuid
  }

  getVariablesFromEvents() {
    this.allEvents.forEach(event => {
      const expr = this.element.getAttribute(event)
      if (expr) {
        const regex = /(\$?\w+(\.\w+)?)\s*=/g;
        let match;
        while ((match = regex.exec(expr)) !== null) {
          if (match && !window.hasOwnProperty(match[1]) && !match[1].includes("this.")) {
            if (match[1].includes("el.")) {
              const varName = match[1].replace("el.", "")
              this.setAsParent()
              if (!window[this.uuid]) {
                window[this.uuid] = {}
              }
              window[this.uuid][varName] = MiniJS.tryFromLocal(match[1].replace("el.", this.uuid))
              MiniJS.variables.push(this.uuid)
            } else {
              window[match[1]] = MiniJS.tryFromLocal(match[1])
            }
            MiniJS.variables.push(match[1])
          }
        }
      }
    });
  }

  getVariables() {
    const allVariables = MiniJS.variables
    const attributeToken = Array.from(this.element.attributes).map(attr => attr.value)
    const filtered = [...new Set(allVariables.filter(v => attributeToken.find(t => t.includes(v))))]

    for (let token of filtered) {
      if (typeof window[token] === 'function') {
        const otherVariables = allVariables.filter(v => window[token].toString().includes(v))
        filtered.concat(otherVariables) 
      }
      if (token.includes("el.") && !this.parent) {
        this.parent = this.getParent()
      }
    }

    this.variables = filtered
  }

  get allEvents() {
    const allMainEvents = MiniJS.allEvents
    const eventsSet = new Set(allMainEvents);
    const attributeNames = Array.from(this.element.attributes).map(attr => attr.name);

    const intersections = attributeNames.filter(value => eventsSet.has(value));

    return intersections
  }

  get baseClasses() {
    return this.initialState.className.split(" ")
  }

  _eventAction(attrName) {
    const attrVal = this.element.getAttribute(attrName)
    return this._sanitizeExpression(attrVal)
  }

  _sanitizeExpression(expr) {
    // Add proxyWindow
    console.log(expr, this.variables)
    this.variables.forEach(variable => {
      const exp = expr.split(";").find(x => x.includes(variable))
      if (exp){
        if (exp.includes('el.')) {
          // Pre process hte expr just to get the newValue but not saving it to the actual variable just yet
          window['temp'] = eval(`proxyWindow['${this.parent.uuid}']`)
          let tempExpr = exp
          tempExpr = tempExpr.replaceAll(variable, `temp['${variable.replace("el.", "")}']`)
          eval(tempExpr)
          const newVal = JSON.stringify(window['temp'])

          const newExpr = exp.replace(exp, `proxyWindow.${this.parent.uuid} = ${newVal};`)
          expr = expr.replace(exp, newExpr)
        } else {
          expr = expr.replace(variable, `proxyWindow.${variable}`)
        }
      }
    })

    expr = expr.replace("this", "this.element")
    return expr
  }

  _sanitizeContentExpression(expr) {
    if (expr.includes("el.")) {
      let parentEntity = this.parent
      this.variables.forEach(variable => {
        if (variable.includes("el.")) {
          const newExpr = `proxyWindow.${parentEntity.uuid}['${variable.replace("el.", "")}']`
          expr = expr.replace(variable, newExpr)
        }
      })
    }
    return expr
  }

  getParent() {
    if (this.isParent()) {
      return this
    } else {
      let currentElement = this.element
      let parentNode = currentElement.parentNode
      while(!parentNode.dataset.uuid) {
        currentElement = parentNode
        parentNode = currentElement.parentNode
      }
      const entity = MiniJS.elements.find(e => e.uuid == parentNode.dataset.uuid)
      return entity
    }
  }

  generateEntityUUID() {
    return 'Entity' + Date.now() + Math.floor(Math.random() * 10000);
}


  evaluateEventAction(attrName) {
    eval(this._eventAction(attrName))
  }

  evaluateClass() {
    const classExpr = this.element.getAttribute(":class");
    if (classExpr) {
      const newClassNames = eval(this._sanitizeContentExpression(classExpr))
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

      const elements = this.element.querySelectorAll("*")
      const entities = []

      for (let i = 0; i < elements.length; i++) {
        const entity = new Entity(elements[i])
        entity.getVariablesFromEvents()
        entity.getVariables()
        entity.applyEventBindings()
        entity.evaluateAll()
        MiniJS.elements.push(entity)
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
      const newText = eval(this._sanitizeContentExpression(textExpr))
      if (newText || newText == '')
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

    this.allEvents.forEach(eventName => {
      el[eventName] = () => {
        this.evaluateEventAction(eventName)
      }
    })

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