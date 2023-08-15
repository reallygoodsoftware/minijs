class Entity {
  constructor(e) {
    this.element = e, this.tagName = e.tagName, this.initialState = {
      className: e.className
    };
  }
  get variables() {
    const e = MiniJS.variables, t = Array.from(this.element.attributes).map((l) => l.value).join(" ");
    return e.filter((l) => t.includes(l));
  }
  get baseClasses() {
    return this.initialState.className.split(" ");
  }
  _eventAction(e) {
    const t = this.element.getAttribute(e);
    return console.log(t), this._sanitizeExpression(t);
  }
  _sanitizeExpression(e) {
    return this.variables.forEach((t) => {
      e.includes(t) && !e.includes(`proxyWindow.${t}`) && (e = e.replace(t, `proxyWindow.${t}`));
    }), e = e.replace("this", "this.element"), e;
  }
  evaluateEventAction(attrName) {
    eval(this._eventAction(attrName));
  }
  evaluateClass() {
    const classExpr = this.element.getAttribute(":class");
    if (classExpr) {
      const newClassNames = eval(classExpr), classesCombined = [...this.baseClasses, ...newClassNames.split(" ")].join(" ");
      this.element.className = classesCombined;
    }
  }
  evaluateEach() {
    const eachExpr = this.element.getAttribute(":each");
    if (eachExpr) {
      const [variable, iterable] = eachExpr.split(" in "), items = eval(iterable);
      this.childClone || (this.childClone = this.element.innerHTML);
      let newHTML = "";
      items.forEach((e) => {
        newHTML += this.childClone.replaceAll(variable, `'${e}'`);
      }), this.element.innerHTML = newHTML;
      const xpathResult = document.evaluate(
        './/*[@*[starts-with(name(), ":")]]',
        this.element,
        // Use the current :each element as the context node
        null,
        XPathResult.ORDERED_NODE_SNAPSHOT_TYPE,
        null
      );
      for (let e = 0; e < xpathResult.snapshotLength; e++) {
        const t = new Entity(xpathResult.snapshotItem(e));
        t.applyEventBindings(), t.evaluateAll();
      }
    }
  }
  evaluateAll() {
    this.evaluateValue(), this.evaluateClass(), this.evaluateText();
  }
  evaluateText() {
    const textExpr = this.element.getAttribute(":text");
    if (textExpr) {
      const newText = eval(textExpr);
      newText && (this.element.innerText = newText);
    }
  }
  evaluateValue() {
    const valueExpr = this.element.getAttribute(":value");
    if (valueExpr) {
      const newValue = eval(valueExpr);
      newValue && (this.element.value = newValue);
    }
    const checkedExpr = this.element.getAttribute(":checked");
    if (checkedExpr) {
      const newValue = eval(checkedExpr);
      newValue && (this.element.checked = newValue);
    }
  }
  applyEventBindings() {
    const e = this.element;
    e.hasAttribute(":click") && e.addEventListener("click", () => {
      this.evaluateEventAction(":click");
    }), e.hasAttribute(":change") && (e.type == "checkbox" || e.tagName == "select" ? e.addEventListener("change", () => {
      this.evaluateEventAction(":change");
    }) : e.addEventListener("input", () => {
      this.evaluateEventAction(":change");
    })), e.hasAttribute(":enter") && e.addEventListener("keypress", (t) => {
      t.key == "Enter" && this.evaluateEventAction(":enter");
    }), document.addEventListener("click", (t) => {
      e.hasAttribute(":clickout") && !e.contains(t.target) && this.evaluateEventAction(":clickout");
    });
  }
  hasAttribute(e) {
    return !!this.element.getAttribute(e);
  }
}
const MiniJS$1 = (() => {
  const _elements = [], _variables = [], _actionEvents = [":click", ":change", ":input", ":keypress"], _loadEvent = ":load", watchHandler = {
    set: function(e, t, n) {
      return e[t] = n, t[0] === "$" && localStorage.setItem(t, JSON.stringify(n)), _variables.includes(t) && updateStates(t), !0;
    }
  };
  window.proxyWindow = null;
  async function init() {
    await _domReady(), _findElements(), _initializeGlobalVariables(), _setProxyWindow(), _addMethodsToVariables(), _applyBindings(), updateStates();
  }
  function _addMethodsToVariables() {
    _variables.forEach((e) => {
      if (Array.isArray(proxyWindow[e])) {
        let r = function(a) {
          let i;
          if (Array.isArray(a))
            i = a;
          else {
            let s = this.indexOf(a);
            s === -1 ? i = this.concat(a) : i = this.slice(0, s).concat(this.slice(s + 1));
          }
          proxyWindow[e] = i, proxyWindow[e].toggle = r;
        }, o = function(a, i) {
          const s = a.toLowerCase(), h = i.filter((c) => c.toLowerCase().includes(s));
          return h.sort((c, d) => Math.abs(s.length - c.length) - Math.abs(s.length - d.length)), h;
        }, u = function(a) {
          return o(a, this);
        };
        var t = r, n = o, l = u;
        proxyWindow[e].search = u, proxyWindow[e].toggle = r;
      }
    });
  }
  function _setProxyWindow() {
    proxyWindow = new Proxy(window, watchHandler);
  }
  function _initializeGlobalVariables() {
    _elements.forEach((entity) => {
      const el = entity.element, loadExpr = el.getAttribute(_loadEvent);
      if (loadExpr) {
        const assignments = loadExpr.split(";").map((e) => e.trim()).filter((e) => e.length > 0);
        assignments.forEach((assignment) => {
          const [varName, varVal] = assignment.replace(" ", "").split("=");
          window[varName] = varName.startsWith("$") && JSON.parse(localStorage.getItem(varName)) || void 0, eval(assignment), _variables.push(varName);
        });
      } else
        _actionEvents.forEach((e) => {
          const t = el.getAttribute(e);
          if (t) {
            const n = t.match(/(\$?\w+)\s*=\s*/);
            n && !window.hasOwnProperty(n[1]) && (window[n[1]] = n[1].startsWith("$") && JSON.parse(localStorage.getItem(n[1])) || void 0, _variables.push(n[1]));
          }
        });
    });
  }
  function updateStates(e = null) {
    _elements.forEach((t) => {
      (t.variables.includes(e) || e == null) && (t.evaluateEach(), t.evaluateAll());
    });
  }
  function _applyBindings() {
    _elements.forEach((e) => {
      e.applyEventBindings();
    });
  }
  function _findElements() {
    const e = document.evaluate(
      '//*[@*[starts-with(name(), ":")]]',
      document,
      null,
      XPathResult.ORDERED_NODE_SNAPSHOT_TYPE,
      null
    );
    for (let t = 0; t < e.snapshotLength; t++) {
      const n = new Entity(e.snapshotItem(t));
      isInsideEachElement(n.element.parentElement) || _elements.push(n);
    }
  }
  function isInsideEachElement(e) {
    for (; e; ) {
      if (e.hasAttribute && e.hasAttribute(":each"))
        return !0;
      e = e.parentElement;
    }
    return !1;
  }
  function _domReady() {
    return new Promise((e) => {
      document.readyState == "loading" ? document.addEventListener("DOMContentLoaded", e) : e();
    });
  }
  return init().catch((e) => {
    console.error("Error initializing MiniJS:", e);
  }), {
    get elements() {
      return [..._elements];
    },
    get variables() {
      return [..._variables];
    }
  };
})();
window.MiniJS = MiniJS$1;
