import Entity from './entity'

let nativeProps = Object.getOwnPropertyNames(window);

const MiniJS = (() => {
  let _elements = [];
  let _variables = [];
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
        _addMethodsToVariables([property])
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
    _addMethodsToVariables();
    _applyBindings();
    updateStates();
  }

  function _addMethodsToVariables(variables = _variables) {
    variables.forEach((variable) => {
      if( Array.isArray(proxyWindow[variable]))
      {

        function first() {
          return proxyWindow[variable][0]
        }

        function last() {
          return proxyWindow[variable][proxyWindow[variable].length - 1]
        }

        function toggling(value) {
          let newValue;

          if (Array.isArray(value)) {
             newValue = value
          } else {
            let index = this.indexOf(value);
            if (index === -1) {
              newValue = this.concat(value);
            } else {
              newValue = this.slice(0, index).concat(this.slice(index + 1));
            }
          }
          proxyWindow[variable] = newValue;
        };

        function add(value) {
          let newValue;

          let index = this.indexOf(value);
          if (index === -1) {
            newValue = this.concat(value);
            proxyWindow[variable] = newValue;
          }
          
        }

        function remove(value) {
          let newValue;

          let index = this.indexOf(value);
          if (index !== -1) {
            newValue = this.slice(0, index).concat(this.slice(index + 1));
            proxyWindow[variable] = newValue;
          }
        }

        function searchMatches(input, tags) {
          // Normalize the input by converting to lowercase and splitting it into words
          const inputWords = input.toLowerCase().split(/\s+/);
      
          // Filter the tags based on whether every word in the input appears somewhere in the tag
          const matches = tags.filter(tag => {
              const lowerTag = tag.toLowerCase();
              return inputWords.every(word => lowerTag.includes(word));
          });
      
          return matches;
      }
        
        function searching(value) {
          const result = searchMatches(value, this)
          return result
        }
        
        
        proxyWindow[variable].first = first()
        proxyWindow[variable].last = last()
        proxyWindow[variable].remove = remove
        proxyWindow[variable].add = add
        proxyWindow[variable].toggle = toggling
        proxyWindow[variable].search = searching
      }
    })
  }

  function _setProxyWindow() {
    proxyWindow = new Proxy(window, watchHandler);
  }

  function _initializeGlobalVariables() {
    // set all user defined window variable
    let currentProps = Object.getOwnPropertyNames(window);
    _variables = currentProps.filter(p => !nativeProps.includes(p));



    _elements.forEach(entity => {
      const el = entity.element
      const loadExpr = el.getAttribute(_loadEvent);
      if(loadExpr) {
        const assignments = loadExpr.split(";").map(a => a.trim()).filter(a => a.length > 0);
        assignments.forEach(assignment => {
          const [varName, varVal] = assignment.replace(" ", "").split("=")
          window[varName] = varName.startsWith('$') ? JSON.parse(localStorage.getItem(varName)) || undefined : undefined;
          eval(assignment)
          _variables.push(varName)
        });
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
        entity.evaluateEach()
        entity.evaluateAll()
      }
    })
  }
  

  function _applyBindings() {
    _elements.forEach(entity => {
      entity.applyEventBindings()
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
      if (!isInsideEachElement(entity.element.parentElement)) {
        _elements.push(entity);
      }
    }
  }

  function isInsideEachElement(element) {
    while (element) {
      if (element.hasAttribute && element.hasAttribute(':each')) {
        return true;
      }
      element = element.parentElement;
    }
    return false;
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
    },
    get window() {
      return proxyWindow
    }
  };
})();

window.MiniJS = MiniJS;
