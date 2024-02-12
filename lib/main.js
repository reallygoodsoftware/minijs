import Entity from './entity'
import { Lexer } from './generators/lexer'
import { observeDOM } from './generators/observer'
import { State } from './state'
import { Events } from './entity/events'

let nativeProps = Object.getOwnPropertyNames(window)

const MiniJS = (() => {
  let _debug = false
  let _elements = []
  const state = new State()

  async function init() {
    // Automatically initialize when the script is loaded
    await _domReady()

    let startTime = performance.now()
    _setDebugMode()
    state.setProxyWindow()
    Events.initValidEvents()
    _findElements()
    _initializeGlobalVariables()
    state.attachVariableHelpers()
    Events.applyEvents(_elements)
    state.triggerDOMUpdate()
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
        if (
          record.type === 'attributes' &&
          record.attributeName.startsWith(':')
        ) {
          const entity = _elements.find(
            (entity) => entity.element === record.target
          )
          entity?.attributes.evaluateAttribute(record.attributeName)
        }

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

  function _setDebugMode() {
    if (!_debug) return
    console.log('MiniJS Debug Mode Enabled')
    Lexer.debug = true
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
      entity.events.evaluate(':load')
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
      return state.variables
    },
    set variables(variables) {
      state.variables = variables
    },
    get window() {
      return state.window
    },
    tryFromLocal,
  }
})()

window.MiniJS = MiniJS
