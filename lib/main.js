import Entity from './entity'
import MiniArray from './array';

let nativeProps = Object.getOwnPropertyNames(window);

const MiniJS = (() => {
  window.proxyWindow = null;
  let _elements = [];
  let _variables = [];
  let _allEvents = [];
  let _customStatements = [":each"];
  let _customProperties = [":text", ":class", ":value", ":checked"];
  let _customEvents = [":change", ":clickout", ":enter", ":keyup.up", ":keyup.left", ":keyup.down", ":keyup.right"];

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

  function _getAllPossibleEventNames() {
    const elements = ['div', 'a', 'input', 'textarea', 'select', 'button', 'video', 'audio', 'img', 'form', 'details', 'iframe', 'canvas'];
    const allEvents = new Set();

    elements.forEach(tag => {
        const ele = document.createElement(tag);
        for (let name in ele) {
            if (name.startsWith('on')) allEvents.add(name);
        }
    });

    _allEvents = [...allEvents];
  }

  async function init() {
    // Automatically initialize when the script is loaded
    await _domReady();
    
    let startTime = performance.now();
    _setProxyWindow();
    _getAllPossibleEventNames();
    _findElements();
    _initializeGlobalVariables();
    _addMethodsToVariables();
    _applyBindings();
    _addHelpers();
    updateStates();
    // Temporarily commented out - to be reviewed
    // _evaluateLoadEvents();
    const endTime = performance.now();
    const executionTime = endTime - startTime;
    console.log(`myFunction took ${executionTime}ms to run.`);
  }

  function _addHelpers() {
    // Add times method to numbers
    // 5.times will return [undefined, undefined, undefined, undefined, undefined]
    Object.defineProperty(Number.prototype, 'times', {
      get: function() {
          return Array.from({length: this})
      }
    });
  }

  function _addMethodsToVariables(variables = _variables) {
    variables.forEach((variable) => {
      if(Array.isArray(proxyWindow[variable]) && !(proxyWindow[variable] instanceof MiniArray)) {
        proxyWindow[variable] = new MiniArray(...proxyWindow[variable]);
      }
    });
  }

  function _setProxyWindow() {
    proxyWindow = new Proxy(window, watchHandler);
  }

  function _setUserDefinedVariables() {
    let currentProps = Object.getOwnPropertyNames(window);
    _variables = currentProps.filter(p => !nativeProps.includes(p));
  }

  function _initializeGlobalVariables() {
    _setUserDefinedVariables()
    _elements.forEach((entity, index) => {
      entity.getVariablesFromEvents(index)
    });
    _elements.forEach((entity, index) => {
      entity.getVariables()
    });
  }

  function tryFromLocal(varName) {
    return varName.startsWith('$') ? JSON.parse(localStorage.getItem(varName)) || undefined : undefined;
  }

  function _evaluateLoadEvents() {
    _elements.forEach(entity => {
      entity.evaluateLoadEvents();
    });
  }

  function updateStates(property = null) {
    _elements.forEach(entity => {
      if (entity.variables.includes(property) || property == null || entity.uuid == property || entity.parent?.uuid == property)
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
    var elems = document.body.getElementsByTagName("*");

    for (let i = 0; i < elems.length; i++) {
      const elem = elems[i]
      const entity = new Entity(elem)
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

  init().catch(error => {
    console.error("Error initializing MiniJS:", error);
  });
  

  return {
    get elements() {
      return _elements;
    },
    set elements(newElements) {
      return newElements;
    },
    get variables() {
      return _variables;
    },
    set variables(newVarList) {
        _variables = newVarList;
    },
    get allCustomBindings() {
      return [..._customProperties, ..._customEvents, ..._customStatements];
    },
    get allEvents() {
      return [..._allEvents, ..._customEvents]
    },
    get window() {
      return proxyWindow
    },
    tryFromLocal
  };
})();

window.MiniJS = MiniJS;
