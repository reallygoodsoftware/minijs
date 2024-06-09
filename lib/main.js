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

    this.state = new State(this)
    this.observer = new Observer(this)
    this.extensions = {
      events: new EventsExtensions(),
    }
  }

  async init() {
    // Automatically initialize when the script is loaded
    await this._domReady()

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
  }

  async reset() {
    this.observer.disconnect()
    this.state.dispose()
    await this.init()
  }

  async _domReady() {
    return new Promise((resolve) => {
      if (document.readyState == 'loading') {
        document.addEventListener('DOMContentLoaded', resolve)
      } else {
        document.removeEventListener('DOMContentLoaded', resolve)
        resolve()
      }
    })
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

  mini.init().catch((error) => {
    console.error('Error initializing MiniJS:', error)
  })

  // Reset MiniJS when the user navigates back
  window.addEventListener('popstate', () => {
    mini.reset().catch((error) => {
      console.error('Error resetting MiniJS after navigation:', error);
    });
  });

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
    reset: async () => {
      await mini.reset()
    }
  }
})()

window.MiniJS = MiniJS

Object.keys(EXPOSE).forEach((key) => {
  window[key] = EXPOSE[key]
});
