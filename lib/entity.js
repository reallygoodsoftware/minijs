import Lexer from './lexer'

export default class Entity {
  constructor(el) {
    this.element = el
    this.tagName = el.tagName
    this.initialState = {
      className: el.className,
    }
    this.variables = []
    this.dynamicAttributes = [];
    this.dependencies = [];
    this.id = this.generateEntityUUID()

    this._getDynamicAttributes();
  }

  setAsParent() {
    this.uuid = this.id
    this.element.dataset.uuid = this.uuid
  }

  isParent() {
    return !!this.uuid
  }

  _getDynamicAttributes() {
    const IGNORED_ATTRIBUTES = [':class', ':text', ':value'];
    const RESERVED_KEYWORDS = ['document', 'window', 'proxyWindow'];

    const attributes = Array.from(this.element.attributes)
    const dynamicAttributes = attributes.filter((attr) => (
      !IGNORED_ATTRIBUTES.includes(attr.name)
      && attr.name.startsWith(':')
      && this.element.hasAttribute(attr.name.slice(1))
    ));
    
    this.dynamicAttributes = dynamicAttributes.map((attr) => {
      const lexer = new Lexer(attr.value);
      
      lexer.filter(Lexer.TOKEN.IdentifierName).forEach((token) => {
        if (RESERVED_KEYWORDS.includes(token.value)) return;
        if (token.value === 'el') return;
        if (token.declaration || token.assignment || token.accessed || token.method || token.calculated) return;

        const parentTokens = token.parent?.split('.');
        if (RESERVED_KEYWORDS.includes(parentTokens?.[0])) return;

        // Ignore object with no assignment
        if (token.parent?.length === 0) return;

        const value = token.parent
          ? `${token.parent}.${token.value}`
          : token.value;
        
        if (this.dependencies.includes(value)) return;
        this.dependencies.push(value);
      });

      return attr.name;
    });
    
    this.dynamicAttributes = [...new Set(this.dynamicAttributes)];
    this.dependencies = [...new Set(this.dependencies)];

    this._initDependencies();
  }

  _initDependencies() {
    this.dependencies.forEach((value) => {
      if (value.startsWith('el.')) {
        this.setAsParent();

        const varName = value.replace("el.", "");

        if (!window[this.uuid])
          window[this.uuid] = {};
        window[this.uuid][varName] = MiniJS.tryFromLocal(value.replace("el.", this.uuid))

        if (!this.dependencies.includes(this.uuid))
          this.dependencies.push(this.uuid);
      } else {
        window[value] = MiniJS.tryFromLocal(value);
      }
    });
  }

  getVariablesFromEvents() {
    const RESERVED_KEYWORDS = ['event', 'document', 'window', 'this', 'proxyWindow'];

    this.allEvents.forEach(event => {
      const expr = this.element.getAttribute(event);
      const lexer = new Lexer(expr);
      const tokens = [];
      
      lexer.filter(Lexer.TOKEN.IdentifierName).forEach((token) => {
        if (RESERVED_KEYWORDS.includes(token.value)) return;
        if (token.value === 'el') return;
        if (token.declaration || token.accessed || token.method || token.calculated) return;

        const parentTokens = token.parent?.split('.');
        if (RESERVED_KEYWORDS.includes(parentTokens?.[0])) return;

        // Ignore object with no assignment
        if (token.parent?.length === 0) return;

        const value = token.parent
          ? `${token.parent}.${token.value}`
          : token.value;
        
        if (tokens.includes(value)) return;
        if (value.startsWith('el.')) {
          this.setAsParent();

          const varName = value.replace("el.", "");

          if (!window[this.uuid])
            window[this.uuid] = {};
          window[this.uuid][varName] = MiniJS.tryFromLocal(value.replace("el.", this.uuid))

          if (!tokens.includes(this.uuid))
            tokens.push(this.uuid);
        } else if (MiniJS.tryFromLocal(value) != null) {
          window[value] = MiniJS.tryFromLocal(value);
        }
        
        tokens.push(value);
      });
      
      MiniJS.variables.push(...tokens);
    });
    
    MiniJS.variables = [...new Set(MiniJS.variables)];
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

    const intersections = attributeNames.filter((value) => {
      if (eventsSet.has(value)) return true;
      if (!value.startsWith(":")) return false;

      const nativeEventName = `on${value.substring(1)}`;
      return eventsSet.has(nativeEventName);
    });

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
    const lexer = new Lexer(expr);

    lexer.replace((token) => {
      if (token.type === Lexer.TOKEN.ReservedWord && token.value === 'this'
        && token.parent == null && !token.declaration) {
        return 'this.element';
      }
    });

    if (this.parent)
      lexer.replace((token) => {
        if (token.type === Lexer.TOKEN.IdentifierName && token.value === 'el'
          && token.parent == null && !token.declaration) {
          return `proxyWindow['${this.parent.uuid}']`;
        }
      });

    this.variables.forEach((variable) => {
      lexer.replace((token) => {
        if (token.type === Lexer.TOKEN.IdentifierName && token.value === variable
          && token.parent == null && !token.declaration) {
          return `proxyWindow.${variable}`;
        }
      });
    })

    return lexer.output();
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

  evaluateLoadEvents() {
    const loadExpr = this.element.getAttribute(":load");
    if (!loadExpr) return;
    this.evaluateEventAction(":load");
  }

  evaluateEach() {
    const eachExpr = this.element.getAttribute(":each");

    if (eachExpr) {
      const [args, iterable] = eachExpr.split(' in ');
      const [variable, indexName] = args.split(',').map(v => v.trim());
      const items = eval(iterable);
      this.childClone ||= this.element.innerHTML

      let newHTML = ''

      items.forEach((item, index) => {
        newHTML += this.childClone
          .replaceAll(indexName, index)
          .replaceAll(variable, `'${item}'`);
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
    this.evaluateDynamicAttributes();
  }

  evaluateDynamicAttributes() {
    this.dynamicAttributes.forEach((attr) => {
      const expr = this.element.getAttribute(attr);
      if (!expr) return;

      const newValue = eval(this._sanitizeExpression(expr));
      const nativeAttr = attr.slice(1);

      if (this.element[nativeAttr] !== newValue && newValue != null)
        this.element[nativeAttr] = newValue;
    });
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
      const newValue = eval(valueExpr);
      if (this.element.value !== newValue && newValue != null)
        this.element.value = newValue;
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

    if (el.hasAttribute(":clickout")) {
      document.addEventListener("click", (e) => {
        if (!document.body.contains(e.target)) return;
        if (el.contains(e.target)) return;
        this.evaluateEventAction(":clickout")
      });
    }

    if (el.hasAttribute(":press")) {
      el.addEventListener("keyup", (e) => {
        if (e.target !== el) return;
        if (!["Enter", "Space"].includes(e.code)) return;
        if (e.code == "Space") e.preventDefault();
        this.evaluateEventAction(":press");
      });

      el.addEventListener("click", (e) => {
        this.evaluateEventAction(":press");
      });

      el.addEventListener("touchstart", (e) => {
        this.evaluateEventAction(":press");
      });
    }
    
    // Other Event Bindings
    Array.from(el.attributes).forEach((attr) => {
      if (attr.name.startsWith(":") && !MiniJS.allCustomBindings.includes(attr.name)) {
        const nativeEventName = attr.name.substring(1);
        el.addEventListener(nativeEventName, (e) => {
          this.evaluateEventAction(attr.name);
        });
      } else if (attr.name.startsWith(":keyup.")) {
        const [event, keycode] = attr.name.split(".");
        const nativeEventName = event.substring(1);

        let key = keycode[0].toUpperCase() + keycode.slice(1);

        if (["up", "down", "left", "right"].includes(keycode)) {
          key = "Arrow" + key; 
        } else if (!["enter", "space"].includes(keycode)) {
          return;
        }

        el.addEventListener(nativeEventName, (e) => {
          if (e.target !== el) return;
          if (e.key !== key) return;
          this.evaluateEventAction(attr.name);
        });
      }
    });
  }

  hasAttribute(attr) {
    return !!this.element.getAttribute(attr)
  }
}