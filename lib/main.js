import { Entity } from './entity'
import { Lexer } from './generators/lexer'
import { Observer } from './generators/observer'
import { State } from './state'
import { Events } from './entity/events'

let nativeProps = Object.getOwnPropertyNames(window)

const MiniJS = (() => {
  let _debug = false
  const state = new State()
  const observer = new Observer(state)

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
    observer.init()
    const endTime = performance.now()
    const executionTime = endTime - startTime
    console.log(`MiniJS took ${executionTime}ms to run.`)
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

      const entity = new Entity(elem)
      if (entity.isInsideEachEl()) entity.dispose()
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
    get observer() {
      return observer
    },
    tryFromLocal,
  }
})()

window.MiniJS = MiniJS
