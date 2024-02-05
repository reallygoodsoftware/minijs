import { Interpreter, ClassInterpreter } from './generators/interpreter';
import { Lexer } from './generators/lexer';

export default class Entity {
  constructor(el) {
    this.element = el
    this.tagName = el.tagName
    this.initialState = {
      className: el.className,
    }
    this.variables = []
    this.dynamicAttributes = [];
    this.id = this.generateEntityUUID();

    this._getDynamicAttributes();

    if (MiniJS.debug)
      this.element.dataset.entityId = this.id;
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
      const attr = this.element.attributes[i];
      if (MiniJS.allCustomBindings.includes(attr.name)) continue;
      if (MiniJS.allEvents.includes(attr.name) || this.allEvents.includes(attr.name)) continue;
      if (!attr.name.startsWith(':')) continue;
      if (this.dynamicAttributes.includes(attr.name)) continue;
      this.dynamicAttributes.push(attr.name);
    }
  }

  getVariables() {
    this._getVariablesFromAttributes();
    this._getVariablesFromEvents();
    this._initVariables();
  }

  _getVariablesFromAttributes() {
    const RESERVED_KEYWORDS = ['$', 'window', 'document', 'console'];
    const CUSTOM_ATTRIBUTES = [':each', ':class', ':text', ':value', ':checked'];
    
    [...this.dynamicAttributes, ...CUSTOM_ATTRIBUTES].forEach((name) => {
      const attr = this.element.attributes[name];
      if (!attr) return;

      const lexer = new Lexer(attr.value, {
        ignoredKeys: RESERVED_KEYWORDS,
      });
      const { referenced, member, assigned } = lexer.identifiers;

      const filtered = [...referenced, ...member, ...assigned].filter((value) => {
        const isNativeVariable = typeof(window[value]) === "function"
          && window[value].toString().indexOf("[native code]") === -1;
        
        return !isNativeVariable;
      })

      this.variables.push(...filtered);

      return attr.name;
    });
  }

  _getVariablesFromEvents() {
    const RESERVED_KEYWORDS = ['event', '$', 'window', 'document', 'console'];

    this.allEvents.forEach((event) => {
      const expr = this.element.getAttribute(event);
      
      const lexer = new Lexer(expr, {
        ignoredKeys: RESERVED_KEYWORDS,
      });
      const { referenced, member, assigned } = lexer.identifiers;

      const filtered = [...referenced, ...member, ...assigned].filter((value) => {
        const isNativeVariable = typeof(window[value]) === "function"
          && window[value].toString().indexOf("[native code]") === -1;
        
        return !isNativeVariable;
      });

      this.variables.push(...filtered);
    });
  }

  _initVariables() {
    this.variables = [...new Set(this.variables)];
    MiniJS.variables = [...new Set(MiniJS.variables.concat(this.variables))];

    this.variables.forEach((variable) => {
      if (variable.startsWith('el.')) {
        this.setAsParent();

        if (!this.parent)
          this.parent = this.getParent();

        const varName = variable.replace("el.", "");

        if (!window[this.uuid])
          window[this.uuid] = {};
        window[this.uuid][varName] = MiniJS.tryFromLocal(variable.replace("el.", this.uuid))

        if (!this.variables.includes(this.uuid))
          this.variables.push(this.uuid);
      } else if (typeof window[variable] === 'function') {
        this.variables.splice(this.variables.indexOf(variable), 1);
        MiniJS.variables.splice(MiniJS.variables.indexOf(variable), 1);
      } else {
        window[variable] = variable.startsWith('$')
          ? MiniJS.tryFromLocal(variable)
          : window[variable];
      }
    });
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

  async _interpret(expr, options = {}) {
    const Engine = options.isClass ? ClassInterpreter : Interpreter
    const engine = new Engine(expr, options)
    const ids = { '$': 'document.querySelector' };

    this.variables.forEach((variable) => {
      if (variable.startsWith('el.')) {
        const members = variable.split('.')
        ids[variable] = `proxyWindow['${this.parent.uuid}'].` + members.slice(1).join('.')
      } else {
        ids[variable] = `proxyWindow-${variable}`
      }
    });

    engine.replace(ids, ['declared'])

    return await engine.interpret(this)
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


  async evaluateEventAction(attrName) {
    const attrVal = this.element.getAttribute(attrName)
    await this._interpret(attrVal)
  }

  async evaluateClass() {
    const expr = this.element.getAttribute(':class');
    if (!expr) return;

    this.element.className = await this._interpret(expr, {
      base: this.baseClasses,
      isClass: true,
    });
  }

  async evaluateLoadEvents() {
    const loadExpr = this.element.getAttribute(":load");
    if (!loadExpr) return;
    await this.evaluateEventAction(":load");
  }

  async evaluateEach() {
    const eachExpr = this.element.getAttribute(":each");

    if (eachExpr) {
      const [args, iterable] = eachExpr.split(' in ');
      const [variable, indexName] = args.split(',').map(v => v.trim());
      const items = await this._interpret(iterable);
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
        entity.getVariables()
        entity.applyEventBindings()
        await entity.evaluateAll()
        MiniJS.elements.push(entity)
      }
    }
  }

  async evaluateAll() {
    await this.evaluateValue()
    await this.evaluateClass()
    await this.evaluateText()
    await this.evaluateDynamicAttributes();
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

    if (newText || newText == '')
      this.element.innerText = newText
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

      if (newValue)
        this.element.checked = newValue
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
        if (!document.documentElement.contains(e.target)) return
        if (el.contains(e.target)) return
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
