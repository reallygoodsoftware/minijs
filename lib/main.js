import Entity from './entity'
import MiniArray from './array';

let nativeProps = Object.getOwnPropertyNames(window);

const MiniJS = (() => {
  window.proxyWindow = null;
  const isProxy = Symbol('isProxy');

  let _ignoredVariables = [];
  let _elements = [];
  let _variables = [];
  let _allEvents = [];
  let _customStatements = [":each"];
  let _customProperties = [":text", ":class", ":value", ":checked"];
  let _customEvents = [":change", ":clickout", ":keyup.up", ":keyup.left", ":keyup.down", ":keyup.right", ":keyup.enter", ":keyup.space", ":press"];

  const watchHandler = {
    set: function(target, property, value) {
      let proxyValue = value;
      const variable = target.__parent__
        ? `${target.__parent__}.${property}`
        : property;
      
      // TODO: Uncommet after working on ignoring non MiniJS variables
      // if (typeof value === 'object' && value !== null && value?.constructor === Object)
      //   proxyValue = _setProxyObject(value, variable);
      
      // Set variable to new value
      target[property] = proxyValue;

      // Store to localstorage
      if (property[0] === "$") {
        localStorage.setItem(property, JSON.stringify(proxyValue));
      }

      if (_variables.includes(variable)) {
        updateStates(variable)
        _addMethodsToVariables([variable])
      }

      return true;
    },
    get: function(target, property) {
      if (property === isProxy)
        return true;
      return target[property];
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
    // Temporarily commented out - need to work on MiniJS.ignore first
    // _setProxyVariables();
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

  function _initializeGlobalVariables() {
    _elements.forEach((entity, index) => {
      entity.getVariables();
    });
  }
  
  function _setProxyObject(object, parent) {
    if (object == null || object.__proxy__) return object;
    if (typeof object !== 'object') return object;
    if (Array.isArray(object)) return object;
    if (object?.constructor !== Object) return;
    
    Object.keys(object).forEach((key) => {
      if (object[key] == null) return;
      if (typeof object[key] !== 'object') return;
      if (Array.isArray(object[key])) return;
      if (object.__proxy__) return;

      object[key] = _setProxyObject(object[key], `${parent}.${key}`);
    });

    const proxyObject = new Proxy(object, watchHandler);
    proxyObject.__parent__ = parent;

    return proxyObject;
  }

  function _setProxyVariables() {
    _variables.forEach((variable) => {
      proxyWindow[variable] = _setProxyObject(proxyWindow[variable], variable);
    });
  }

  function tryFromLocal(varName) {
    try {
      if (varName.startsWith('$')) {
        const localValue = localStorage.getItem(varName);

        if (localValue == null) return localValue;
        return JSON.parse(localValue);
      }

      return undefined;
    } catch {
      return undefined;
    }
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
    get ignore() {
      return _ignoredVariables;
    },
    set ignore(ignoredVariables) {
      _ignoredVariables = ignoredVariables;
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
