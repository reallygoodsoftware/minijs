class Entity {
  constructor(e) {
    this.element = e, this.tagName = e.tagName, this.initialState = {
      className: e.className
    }, this.variables = [], this.id = this.generateEntityUUID();
  }
  setAsParent() {
    this.uuid = this.id, this.element.dataset.uuid = this.uuid;
  }
  isParent() {
    return !!this.uuid;
  }
  getVariablesFromEvents() {
    this.allEvents.forEach((e) => {
      const t = this.element.getAttribute(e);
      if (t) {
        const a = /(\$?\w+(\.\w+)?)\s*=/g;
        let s;
        for (; (s = a.exec(t)) !== null; )
          if (s && !window.hasOwnProperty(s[1]) && !s[1].includes("this.")) {
            if (s[1].includes("el.")) {
              const c = s[1].replace("el.", "");
              this.setAsParent(), window[this.uuid] || (window[this.uuid] = {}), window[this.uuid][c] = MiniJS.tryFromLocal(s[1].replace("el.", this.uuid)), MiniJS.variables.push(this.uuid);
            } else
              window[s[1]] = MiniJS.tryFromLocal(s[1]);
            MiniJS.variables.push(s[1]);
          }
      }
    });
  }
  getVariables() {
    const e = MiniJS.variables, t = Array.from(this.element.attributes).map((s) => s.value), a = [...new Set(e.filter((s) => t.find((c) => c.includes(s))))];
    for (let s of a) {
      if (typeof window[s] == "function") {
        const c = e.filter((h) => window[s].toString().includes(h));
        a.concat(c);
      }
      s.includes("el.") && !this.parent && (this.parent = this.getParent());
    }
    this.variables = a;
  }
  get allEvents() {
    const e = MiniJS.allEvents, t = new Set(e);
    return Array.from(this.element.attributes).map((c) => c.name).filter((c) => t.has(c));
  }
  get baseClasses() {
    return this.initialState.className.split(" ");
  }
  _eventAction(e) {
    const t = this.element.getAttribute(e);
    return this._sanitizeExpression(t);
  }
  _sanitizeExpression(expr) {
    return console.log(expr, this.variables), this.variables.forEach((variable) => {
      const exp = expr.split(";").find((e) => e.includes(variable));
      if (exp)
        if (exp.includes("el.")) {
          window.temp = eval(`proxyWindow['${this.parent.uuid}']`);
          let tempExpr = exp;
          tempExpr = tempExpr.replaceAll(variable, `temp['${variable.replace("el.", "")}']`), eval(tempExpr);
          const newVal = JSON.stringify(window.temp), newExpr = exp.replace(exp, `proxyWindow.${this.parent.uuid} = ${newVal};`);
          expr = expr.replace(exp, newExpr);
        } else
          expr = expr.replace(variable, `proxyWindow.${variable}`);
    }), expr = expr.replace("this", "this.element"), expr;
  }
  _sanitizeContentExpression(e) {
    if (e.includes("el.")) {
      let t = this.parent;
      this.variables.forEach((a) => {
        if (a.includes("el.")) {
          const s = `proxyWindow.${t.uuid}['${a.replace("el.", "")}']`;
          e = e.replace(a, s);
        }
      });
    }
    return e;
  }
  getParent() {
    if (this.isParent())
      return this;
    {
      let e = this.element, t = e.parentNode;
      for (; !t.dataset.uuid; )
        e = t, t = e.parentNode;
      return MiniJS.elements.find((s) => s.uuid == t.dataset.uuid);
    }
  }
  generateEntityUUID() {
    return "Entity" + Date.now() + Math.floor(Math.random() * 1e4);
  }
  evaluateEventAction(attrName) {
    eval(this._eventAction(attrName));
  }
  evaluateClass() {
    const classExpr = this.element.getAttribute(":class");
    if (classExpr) {
      const newClassNames = eval(this._sanitizeContentExpression(classExpr)), classesCombined = [...this.baseClasses, ...newClassNames.split(" ")].join(" ");
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
      const elements = this.element.querySelectorAll("*");
      for (let e = 0; e < elements.length; e++) {
        const t = new Entity(elements[e]);
        t.getVariablesFromEvents(), t.getVariables(), t.applyEventBindings(), t.evaluateAll(), MiniJS.elements.push(t);
      }
    }
  }
  evaluateAll() {
    this.evaluateValue(), this.evaluateClass(), this.evaluateText();
  }
  evaluateText() {
    const textExpr = this.element.getAttribute(":text");
    if (textExpr) {
      const newText = eval(this._sanitizeContentExpression(textExpr));
      (newText || newText == "") && (this.element.innerText = newText);
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
    this.allEvents.forEach((t) => {
      e[t] = () => {
        this.evaluateEventAction(t);
      };
    }), e.hasAttribute(":click") && e.addEventListener("click", (t) => {
      this.evaluateEventAction(":click");
    }), e.hasAttribute(":change") && (e.type == "checkbox" || e.tagName == "select" ? e.addEventListener("change", (t) => {
      this.evaluateEventAction(":change");
    }) : e.addEventListener("input", (t) => {
      this.evaluateEventAction(":change");
    })), e.hasAttribute(":enter") && e.addEventListener("keypress", (t) => {
      t.key == "Enter" && this.evaluateEventAction(":enter");
    }), e.hasAttribute(":keypress") && e.addEventListener("keypress", (t) => {
      this.evaluateEventAction(":keypress");
    }), e.hasAttribute(":keydown") && e.addEventListener("keydown", (t) => {
      this.evaluateEventAction(":keydown");
    }), e.hasAttribute(":keyup") && e.addEventListener("keyup", (t) => {
      this.evaluateEventAction(":keyup");
    }), document.addEventListener("click", (t) => {
      e.hasAttribute(":clickout") && !e.contains(t.target) && this.evaluateEventAction(":clickout");
    });
  }
  hasAttribute(e) {
    return !!this.element.getAttribute(e);
  }
}
let nativeProps = Object.getOwnPropertyNames(window);
const MiniJS$1 = (() => {
  window.proxyWindow = null;
  let e = [], t = [], a = [], s = [":click", ":change", ":input", ":clickout"];
  const c = {
    set: function(n, i, o) {
      return n[i] = o, i[0] === "$" && localStorage.setItem(i, JSON.stringify(o)), t.includes(i) && (m(i), f([i])), !0;
    }
  };
  function h() {
    const n = ["div", "a", "input", "textarea", "select", "button", "video", "audio", "img", "form", "details", "iframe", "canvas"], i = /* @__PURE__ */ new Set();
    n.forEach((o) => {
      const d = document.createElement(o);
      for (let p in d)
        p.startsWith("on") && i.add(p);
    }), a = [...i];
  }
  async function A() {
    await _();
    let n = performance.now();
    S(), h(), L(), W(), f(), M(), k(), m();
    const o = performance.now() - n;
    console.log(`myFunction took ${o}ms to run.`);
  }
  function k() {
    Object.defineProperty(Number.prototype, "times", {
      get: function() {
        return Array.from({ length: this });
      }
    });
  }
  function f(n = t) {
    n.forEach((i) => {
      if (Array.isArray(proxyWindow[i])) {
        let w = function() {
          return proxyWindow[i][0];
        }, E = function() {
          return proxyWindow[i][proxyWindow[i].length - 1];
        }, x = function(r) {
          let l;
          if (Array.isArray(r))
            l = r;
          else {
            let u = this.indexOf(r);
            u === -1 ? l = this.concat(r) : l = this.slice(0, u).concat(this.slice(u + 1));
          }
          proxyWindow[i] = l;
        }, v = function(r) {
          let l;
          this.indexOf(r) === -1 && (l = this.concat(r), proxyWindow[i] = l);
        }, g = function(r) {
          let l, u = this.indexOf(r);
          u !== -1 && (l = this.slice(0, u).concat(this.slice(u + 1)), proxyWindow[i] = l);
        }, y = function(r, l) {
          const u = r.toLowerCase().split(/\s+/);
          return l.filter((P) => {
            const C = P.toLowerCase();
            return u.every((J) => C.includes(J));
          });
        }, b = function(r) {
          return y(r, this);
        };
        var o = w, d = E, p = x, $ = v, O = g, z = y, F = b;
        proxyWindow[i].first = w(), proxyWindow[i].last = E(), proxyWindow[i].remove = g, proxyWindow[i].add = v, proxyWindow[i].toggle = x, proxyWindow[i].search = b;
      }
    });
  }
  function S() {
    proxyWindow = new Proxy(window, c);
  }
  function V() {
    t = Object.getOwnPropertyNames(window).filter((i) => !nativeProps.includes(i));
  }
  function W() {
    V(), e.forEach((n, i) => {
      n.getVariablesFromEvents(i);
    }), e.forEach((n, i) => {
      n.getVariables();
    });
  }
  function N(n) {
    return n.startsWith("$") && JSON.parse(localStorage.getItem(n)) || void 0;
  }
  function m(n = null) {
    e.forEach((i) => {
      var o;
      (i.variables.includes(n) || n == null || i.uuid == n || ((o = i.parent) == null ? void 0 : o.uuid) == n) && (i.evaluateEach(), i.evaluateAll());
    });
  }
  function M() {
    e.forEach((n) => {
      n.applyEventBindings();
    });
  }
  function L() {
    var n = document.body.getElementsByTagName("*");
    for (let i = 0; i < n.length; i++) {
      const o = n[i], d = new Entity(o);
      T(d.element.parentElement) || e.push(d);
    }
  }
  function T(n) {
    for (; n; ) {
      if (n.hasAttribute && n.hasAttribute(":each"))
        return !0;
      n = n.parentElement;
    }
    return !1;
  }
  function _() {
    return new Promise((n) => {
      document.readyState == "loading" ? document.addEventListener("DOMContentLoaded", n) : n();
    });
  }
  return A().catch((n) => {
    console.error("Error initializing MiniJS:", n);
  }), {
    get elements() {
      return e;
    },
    set elements(n) {
      return n;
    },
    get variables() {
      return t;
    },
    set variables(n) {
      t = n;
    },
    get allEvents() {
      return [...a, ...s];
    },
    get window() {
      return proxyWindow;
    },
    tryFromLocal: N
  };
})();
window.MiniJS = MiniJS$1;
