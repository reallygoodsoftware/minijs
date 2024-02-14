import { Entity } from './entity'
import { Lexer } from './generators/lexer'
import { observeDOM } from './generators/observer'
import { State } from './state'
import { Events } from './entity/events'

let nativeProps = Object.getOwnPropertyNames(window)

const MiniJS = (() => {
  let _debug = false
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
    Events.applyEvents()
    state.evaluate()
    _listenToDOMChanges()
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
          const entity = state.getEntityByElement(record.target)
          // TODO: Add support for dynamically inserted events like :click
          entity?.attributes.evaluateAttribute(record.attributeName)
        }

        record.removedNodes.forEach((node) => {
          if (node.nodeType !== 1) return
          const entity = state.getEntityByElement(node)
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
    const entities = Array.from(state.entities.values())
    entities.forEach((entity, index) => {
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

  function _findElements() {
    const elems = document.body.getElementsByTagName('*')

    for (let i = 0; i < elems.length; i++) {
      const elem = elems[i]
      if (elem.nodeType !== 1) continue

      new Entity(elem)
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
    get window() {
      return state.window
    },
    get state() {
      return state
    },
    tryFromLocal,
  }
})()

window.MiniJS = MiniJS
