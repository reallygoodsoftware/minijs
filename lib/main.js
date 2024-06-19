import { State } from '@/state'
import { Entity } from '@/entity'

import { Lexer } from '@/generators/lexer'
import { Observer } from '@/generators/observer'

import { Events } from '@/entity/events'
import { EventsExtensions } from '@/extensions/events-extensions'
import { MiniArray } from '@/helpers/array'
import { EXPOSE } from './helpers'

export class Mini {
  static instance
  static debug = false

  constructor() {
    if (Mini.instance) return Mini.instance
    Mini.instance = this

    this.isReady = false
    this.state = new State(this)
    this.observer = new Observer(this)
    this.extensions = {
      events: new EventsExtensions(),
    }
  }

  init() {
    this._domReady(() => {
      this.isReady = true
      const startTime = performance.now()
      this._setDebugMode()
      this.state.setProxyWindow()
      Events.initValidEvents()
      this._initEntities()
      this._initializeGlobalVariables()
      Events.applyEvents()
      this.state.evaluate()
      this.observer.init()
      const endTime = performance.now()
      const executionTime = endTime - startTime
      console.log(`MiniJS took ${executionTime}ms to run.`)
    })
  }
  
  /**
   * Execute a function now if DOMContentLoaded has fired, otherwise listen for it.
   *
   * This function uses isReady because there is no reliable way to ask the browser whether
   * the DOMContentLoaded event has already been fired; there's a gap between DOMContentLoaded
   * firing and readystate=complete.
   */
  _domReady(fn) {
    // Checking readyState here is a failsafe in case minijs script tag entered the DOM by
    // some means other than the initial page load.
    if (this.isReady || document.readyState === 'complete') {
      fn()
    } else {
      // if document is not ready (loading, interactive), add an event listener
      document.addEventListener('DOMContentLoaded', fn)
    }
  }

  async _setDebugMode() {
    if (!this.debug) return
    console.log('MiniJS Debug Mode Enabled')
    Lexer.debug = true
  }

  _initEntities() {
    const elements = document.body.getElementsByTagName('*')

    for (let i = 0; i < elements.length; i++) {
      const element = elements[i]
      if (element.nodeType !== 1) continue

      const entity = new Entity(element)
      if (entity.isInsideEachEl()) entity.dispose()
    }
  }

  _initializeGlobalVariables() {
    const entities = Array.from(this.state.entities.values())
    entities.forEach((entity, index) => {
      entity.getVariables()
    })
  }
}

const MiniJS = (() => {
  const mini = new Mini()

  try {
    mini.init()
  } catch (error) {
    console.error('Error initializing MiniJS:', error)
  }
  
  return {
    get debug() {
      return Mini.debug
    },
    set debug(value) {
      Mini.debug = !!value

      if (Mini.debug) MiniJS.main = mini
      else delete MiniJS.main
    },
    get window() {
      return mini.state.window
    },
    get Array() {
      return MiniArray
    },
    resolveScript: () => {
      return mini.observer.resolveScript()
    },
    extendEvents: (events) => {
      mini.extensions.events.extend(events)
    },
  }
})()

window.MiniJS = MiniJS

Object.keys(EXPOSE).forEach((key) => {
  window[key] = EXPOSE[key]
});
