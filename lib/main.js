import Entity from './entity'
import MiniArray from './helpers/array'
import { Lexer } from './generators/lexer'
import { observeDOM } from './generators/observer'

let nativeProps = Object.getOwnPropertyNames(window)

const MiniJS = (() => {
  window.proxyWindow = null
  const isProxy = Symbol('isProxy')

  let _debug = false
  let _ignoredVariables = []
  let _elements = []
  let _variables = []
  let _allEvents = []
  let _customStatements = [':each']
  let _customProperties = [':text', ':class', ':value', ':checked']
  let _customEvents = [
    ':change',
    ':clickout',
    ':keyup.up',
    ':keyup.left',
    ':keyup.down',
    ':keyup.right',
    ':keyup.enter',
    ':keyup.space',
    ':press',
  ]

  const watchHandler = {
    set: function (target, property, value) {
      let proxyValue = value
      const variable = target.__parent__
        ? `${target.__parent__}.${property}`
        : property

      // Set variable to new value
      target[property] = proxyValue

      // Store to localstorage
      if (property[0] === '$') {
        localStorage.setItem(property, JSON.stringify(proxyValue))
      }

      if (_variables.includes(variable)) {
        updateStates(variable)
        _addMethodsToVariables([variable])
      }

      return true
    },
    get: function (target, property) {
      if (property === isProxy) return true
      return target[property]
    },
  }

  function _getAllPossibleEventNames() {
    const elements = [
      'div',
      'a',
      'input',
      'textarea',
      'select',
      'button',
      'video',
      'audio',
      'img',
      'form',
      'details',
      'iframe',
      'canvas',
    ]
    const allEvents = new Set()

    elements.forEach((tag) => {
      const ele = document.createElement(tag)
      for (let name in ele) {
        if (name.startsWith('on')) allEvents.add(name)
      }
    })

    _allEvents = [...allEvents]
  }

  async function init() {
    // Automatically initialize when the script is loaded
    await _domReady()

    let startTime = performance.now()
    _setDebugMode()
    _setProxyWindow()
    _getAllPossibleEventNames()
    _findElements()
    _initializeGlobalVariables()
    _addMethodsToVariables()
    _applyBindings()
    updateStates()
    _listenToDOMChanges()
    // Temporarily commented out - to be reviewed
    // _evaluateLoadEvents();
    const endTime = performance.now()
    const executionTime = endTime - startTime
    console.log(`MiniJS took ${executionTime}ms to run.`)
  }

  function _listenToDOMChanges() {
    observeDOM(document.body, (mutation) => {
      mutation.forEach((record) => {
        record.removedNodes.forEach((node) => {
          if (node.nodeType !== 1) return
          const entity = _elements.find((entity) => entity.element === node)
          entity?.dispose()
        })

        record.addedNodes.forEach((node) => {
          if (node.nodeType !== 1) return
          const entity = new Entity(node)
          entity.init()
          entity.initChildren()
        })
      })
    })
  }

  function _addMethodsToVariables(variables = _variables) {
    variables.forEach((variable) => {
      if (
        Array.isArray(proxyWindow[variable]) &&
        !(proxyWindow[variable] instanceof MiniArray)
      ) {
        proxyWindow[variable] = new MiniArray(...proxyWindow[variable])
      }
    })
  }

  function _setProxyWindow() {
    proxyWindow = new Proxy(window, watchHandler)
  }

  function _setDebugMode() {
    if (_debug) {
      console.log('MiniJS Debug Mode Enabled')
      Lexer.debug = true
    }
  }

  function _initializeGlobalVariables() {
    _elements.forEach((entity, index) => {
      entity.getVariables()
    })
  }

  function tryFromLocal(varName) {
    try {
      if (varName.startsWith('$')) {
        const localValue = localStorage.getItem(varName)

        if (localValue == null) return localValue
        return JSON.parse(localValue)
      }

      return undefined
    } catch {
      return undefined
    }
  }

  function _evaluateLoadEvents() {
    _elements.forEach((entity) => {
      entity.evaluateLoadEvents()
    })
  }

  async function updateStates(property = null) {
    for (const entity of _elements) {
      if (
        entity.variables.includes(property) ||
        property == null ||
        entity.uuid == property ||
        entity.parent?.uuid == property
      ) {
        await entity.evaluateEach()
        await entity.evaluateAll()
      }
    }
  }

  function _applyBindings() {
    _elements.forEach((entity) => {
      entity.applyEventBindings()
    })
  }

  function _findElements() {
    const elems = document.body.getElementsByTagName('*')

    for (let i = 0; i < elems.length; i++) {
      const elem = elems[i]
      if (elem.nodeType !== 1) continue

      const entity = new Entity(elem)
      _elements.push(entity)
    }
  }

  function _domReady() {
    return new Promise((resolve) => {
      if (document.readyState == 'loading') {
        document.addEventListener('DOMContentLoaded', resolve)
      } else {
        document.removeEventListener('DOMContentLoaded', resolve)
        resolve()
      }
    })
  }

  init().catch((error) => {
    console.error('Error initializing MiniJS:', error)
  })

  return {
    get debug() {
      return _debug
    },
    set debug(value) {
      _debug = !!value
    },
    get elements() {
      return _elements
    },
    set elements(newElements) {
      _elements = newElements
    },
    get variables() {
      return _variables
    },
    set variables(newVarList) {
      _variables = newVarList
    },
    get ignore() {
      return _ignoredVariables
    },
    set ignore(ignoredVariables) {
      _ignoredVariables = ignoredVariables
    },
    get allCustomBindings() {
      return [..._customProperties, ..._customEvents, ..._customStatements]
    },
    get allEvents() {
      return [..._allEvents, ..._customEvents]
    },
    get window() {
      return proxyWindow
    },
    tryFromLocal,
  }
})()

window.MiniJS = MiniJS
