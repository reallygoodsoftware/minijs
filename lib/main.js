import Entity from './entity'



const MiniJS = (() => {
  const _elements = [];
  const _variables = [];
  const _actionEvents = [":click", ":change", ":input", ":keypress"]
  const _loadEvent = ":load"
  const watchHandler = {
    set: function(target, property, value) {
      // Set window variable to new value
      target[property] = value;

      // Store to localstorage
      if (property[0] === "$") {
        localStorage.setItem(property, JSON.stringify(value));
      }

      if (_variables.includes(property)) {
        updateStates(property)
      }
      return true;
    }
  }

  window.proxyWindow = null;

  async function init() {
    await _domReady();
    _findElements();
    _initializeGlobalVariables();
    _setProxyWindow()
    _applyBindings();
    updateStates();
  }

  function _setProxyWindow() {
    proxyWindow = new Proxy(window, watchHandler);
  }

  function _initializeGlobalVariables() {
    _elements.forEach(entity => {
      const el = entity.element
      const loadExpr = el.getAttribute(_loadEvent);

      if(loadExpr) {
        const [varName, varVal] = loadExpr.replace(" ", "").split("=")
        window[varName] = varName.startsWith('$') ? JSON.parse(localStorage.getItem(varName)) || undefined : undefined;
        eval(loadExpr)
        _variables.push(varName)
      } else {
        _actionEvents.forEach(event => {
          const expr = el.getAttribute(event)
          if (expr) {
            const match = expr.match(/(\$?\w+)\s*=\s*/);
            if (match && !window.hasOwnProperty(match[1])) {
              window[match[1]] = match[1].startsWith('$') ? JSON.parse(localStorage.getItem(match[1])) || undefined : undefined;
              _variables.push(match[1])
            }
          }
        });
      }
    });
  }

  function updateStates(property = null) {
    _elements.forEach(entity => {
      if (entity.variables.includes(property) || property == null)
      {
        entity.evaluateValue()
        entity.evaluateClass()
        entity.evaluateText()
      }
    })
  }
  
  function triggerEventChanges(entity, event) {
    entity.evaluateEventAction(event)
  }

  function _applyBindings() {
    _elements.forEach(entity => {
      const el = entity.element
      // Click binding
      if (el.hasAttribute(":click")) {
        el.addEventListener("click", () => {
          triggerEventChanges(entity, ":click")
        });
      }

      // Change binding
      if (el.hasAttribute(":change")) {
        if (el.type == "checkbox" || el.tagName == "select") {
          el.addEventListener("change", () => {
            triggerEventChanges(entity, ":change")
          });
        } else {
          el.addEventListener("input", () => {
            triggerEventChanges(entity, ":change")
          });
        }
      }

      document.addEventListener('click', function(e) {
        if (entity.hasAttribute(":clickout") && !entity.element.contains(e.target))
        {
          entity.evaluateEventAction(":clickout")
        }
      });
    });
  }

  function _findElements() {
    const xpathResult = document.evaluate(
      '//*[@*[starts-with(name(), ":")]]',
      document,
      null,
      XPathResult.ORDERED_NODE_SNAPSHOT_TYPE,
      null
    );

    for (let i = 0; i < xpathResult.snapshotLength; i++) {
      const entity = new Entity(xpathResult.snapshotItem(i))
      _elements.push(entity);
    }
  }

  function _domReady() {
    return new Promise(resolve => {
      if (document.readyState == "loading") {
        document.addEventListener("DOMContentLoaded", resolve);
      } else {
        resolve();
      }
    });
  }

  // Automatically initialize when the script is loaded
  init().catch(error => {
    console.error("Error initializing MiniJS:", error);
  });

  return {
    get elements() {
      return [..._elements];
    },
    get variables() {
      return [..._variables];
    }
  };
})();

window.MiniJS = MiniJS;
