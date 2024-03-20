import { Mini } from '@/main'
import { State } from '@/state'
import { Interpreter } from '@/generators/interpreter'
import { camelToKebabCase } from '@/helpers/strings'
import { EventsExtensions } from '@/extensions/events-extensions'

const ELEMENTS = [
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

const SYSTEM_KEYS = ['ctrl', 'meta', 'alt', 'shift']
const DIRECTION_KEYS = ['up', 'down', 'left', 'right']

function mapKey(keycode, key) {
  if (keycode.startsWith('Key')) return [keycode.slice(3).toLowerCase()]
  if (keycode.startsWith('Digit')) return [keycode.slice(5).toLowerCase()]
  if (keycode.startsWith('Numpad')) return [keycode.slice(6).toLowerCase()]
  if (keycode.startsWith('Arrow')) return [keycode.slice(5).toLowerCase()]
  if (keycode.startsWith('Meta')) {
    const direction = keycode.slice(4).toLowerCase()
    if (direction.length) return ['meta', `meta-${direction}`]
    return ['meta']
  }
  if (keycode.startsWith('Alt')) {
    const direction = keycode.slice(3).toLowerCase()
    if (direction.length) return ['alt', `alt-${direction}`]
    return ['alt']
  }
  if (keycode.startsWith('Control')) {
    const direction = keycode.slice(7).toLowerCase()
    if (direction.length) return ['ctrl', `ctrl-${direction}`]
    return ['ctrl']
  }
  if (keycode.startsWith('Shift')) {
    const direction = keycode.slice(5).toLowerCase()
    if (direction.length) return ['shift', `shift-${direction}`]
    return ['shift']
  }
  return [camelToKebabCase(keycode).toLowerCase()]
}

export class Events {
  static CUSTOM_KEY_EVENTS = [':keyup', ':keydown', ':keypress']
  static CUSTOM_EVENTS = [
    ':change',
    ':clickout',
    ':clickme',
    ':press',
    ':load',
    ...Events.CUSTOM_KEY_EVENTS,
  ]

  static initValidEvents() {
    const events = new Set()

    ELEMENTS.forEach((tag) => {
      const el = document.createElement(tag)
      for (const name in el) {
        if (name.startsWith('on')) events.add(`:${name.substring(2)}`)
      }
    })

    Events.validEvents = [...events, ...Events.CUSTOM_EVENTS]
  }

  static applyEvents() {
    const mini = new Mini()
    const entities = Array.from(mini.state.entities.values())
    entities.forEach((entity) => {
      entity.events.apply()
    })
  }

  static isValidEvent(event) {
    if (!event.startsWith(':')) return false
    if (event === ':keyevents') return false
    if (event in EventsExtensions.USER_CUSTOM_EVENTS) return true

    return (
      Events.validEvents.includes(event) ||
      Events.CUSTOM_KEY_EVENTS.some((key) => event.startsWith(key + '.'))
    )
  }
  static isKeyEvent(attr) {
    return Events.CUSTOM_KEY_EVENTS.some(
      (key) => attr.startsWith(key + '.') || attr === key
    )
  }

  constructor(entity) {
    this.entity = entity
    this.listener = {}
    this.keysPressed = {}
    this.dynamicEvents = []

    this._getDynamicEvents()
  }

  _getDynamicEvents() {
    const attributeNames = Array.from(this.entity.element.attributes).map(
      (attr) => attr.name
    )

    this.dynamicEvents = attributeNames.filter((value) =>
      Events.isValidEvent(value)
    )
  }

  apply() {
    this.dispose()

    const keyEvents = []

    Array.from(this.entity.element.attributes).forEach((attr) => {
      if (!Events.isValidEvent(attr.name)) return

      const isKeyEvent = Events.CUSTOM_KEY_EVENTS.some(
        (key) => attr.name.startsWith(key + '.') || attr.name === key
      )

      if (Events.isKeyEvent(attr.name)) {
        keyEvents.push(attr.name)
      } else this.setEvent(attr.name)
    })

    this.setKeyEvents(keyEvents)

    // Add event listeners
    Object.keys(this.listener).forEach((attr) => {
      this.applyEvent(attr, false)
    })
  }

  applyEvent(attr, attachListener = true) {
    if (attachListener) this.setEvent(attr)

    const listener = this.listener[attr]
    if (!listener) return

    if (Array.isArray(listener)) {
      listener.forEach(({ el, eventName, event }) => {
        el.addEventListener(eventName, event)
      })
    } else {
      const { el, eventName, event } = listener
      el.addEventListener(eventName, event)
    }
  }

  setChangeEvent() {
    const el = this.entity.element
    const key = ':change'

    if (this.listener[key]) this.disposeEvent(key, false)

    const expr = el.getAttribute(key)
    if (!expr) return

    this.listener[key] = {
      el,
      eventName:
        el.type == 'checkbox' || el.tagName == 'select' ? 'change' : 'input',
      event: () => {
        this.evaluate(key)
      },
    }
  }

  setClickoutEvent() {
    const el = this.entity.element
    const key = ':clickout'

    if (this.listener[key]) this.disposeEvent(key, false)

    const expr = el.getAttribute(key)
    if (!expr) return

    this.listener[key] = {
      el: document,
      eventName: 'click',
      event: (e) => {
        if (!document.documentElement.contains(e.target)) return
        if (el.contains(e.target)) return
        this.evaluate(key)
      },
    }
  }

  setClickMeEvent() {
    const el = this.entity.element
    const key = ':clickme'

    if (this.listener[key]) this.disposeEvent(key, false)

    const expr = el.getAttribute(key)
    if (!expr) return

    this.listener[key] = {
      el,
      eventName: 'click',
      event: (e) => {
        if (e.target !== el) return
        this.evaluate(key)
      },
    }
  }

  setPressEvent() {
    const el = this.entity.element
    const key = ':press'

    if (this.listener[key]) this.disposeEvent(key, false)

    const expr = el.getAttribute(key)
    if (!expr) return

    this.listener[key] = []
    this.listener[key].push({
      el,
      eventName: 'keyup',
      event: (e) => {
        if (e.target !== el) return
        if (!['Enter', 'Space'].includes(e.code)) return
        if (e.code == 'Space') e.preventDefault()
        this.evaluate(key)
      },
    })

    this.listener[key].push({
      el,
      eventName: 'click',
      event: (e) => {
        this.evaluate(key)
      },
    })

    this.listener[key].push({
      el,
      eventName: 'touchstart',
      event: (e) => {
        this.evaluate(key)
      },
    })
  }

  setKeyEvents(attrs) {
    if (!attrs.length) return

    const el = this.entity.element

    const keyEvents = attrs
      .map((attribute) => {
        const [event, ...keycodes] = attribute.split('.')
        const nativeEventName = event.substring(1)

        const [systemKeys, normalKeys] = keycodes.reduce(
          ([system, normal], key) => {
            const lowerKey = key.toLowerCase()

            const [systemKey, directionKey] = lowerKey.split('-')

            if (
              SYSTEM_KEYS.includes(systemKey) &&
              (directionKey == null || DIRECTION_KEYS.includes(directionKey))
            ) {
              system.push(lowerKey)
            } else {
              normal.push(lowerKey)
            }
            return [system, normal]
          },
          [[], []]
        )

        return {
          attribute,
          event,
          nativeEventName,
          keycodes: { systemKeys, normalKeys },
        }
      })
      .filter(({ attribute, event }) => {
        if (Events.isKeyEvent(event)) return true

        const expr = el.getAttribute(attribute)
        return expr != null
      })

    if (!keyEvents.length) return

    const listenerKey = ':keyevents'
    if (this.listener[listenerKey]) this.disposeEvent(listenerKey, false)
    this.listener[listenerKey] = []

    const ctx = this

    const areKeysPressed = (e, keycodes) => {
      return (
        keycodes.normalKeys.every((key) => {
          const [_, directionKey] = key.split('-')

          if (directionKey) return ctx.keysPressed[key]

          return ctx.keysPressed[key]
        }) &&
        keycodes.systemKeys.every((key) => {
          const [_, directionKey] = key.split('-')

          if (directionKey) return ctx.keysPressed[key]

          return e[`${key}Key`] || ctx.keysPressed[key]
        })
      )
    }

    const handleKeyPress = (e) => {
      if (e.target !== el) return

      if (e.type === 'keyup') {
        const keyUpEvents = keyEvents.filter(
          (event) => event.nativeEventName === 'keyup'
        )

        keyUpEvents.forEach((keyEvent) => {
          if (areKeysPressed(e, keyEvent.keycodes))
            this.evaluate(keyEvent.attribute)
        })
      }

      const pressedKeys = mapKey(e.code, e.key)
      const isPressed = e.type === 'keydown'

      pressedKeys.forEach((key) => {
        ctx.keysPressed[key] = isPressed
      })

      if (e.type === 'keydown') {
        const keyDownEvents = keyEvents.filter(
          (event) => event.nativeEventName === 'keydown'
        )

        keyDownEvents.forEach((keyEvent) => {
          if (areKeysPressed(e, keyEvent.keycodes))
            this.evaluate(keyEvent.attribute)
        })
      }
    }

    this.listener[listenerKey].push({
      el,
      eventName: 'keydown',
      event: handleKeyPress,
    })

    this.listener[listenerKey].push({
      el,
      eventName: 'keyup',
      event: handleKeyPress,
    })

    const keyPressEvents = keyEvents.filter(
      (event) => event.nativeEventName === 'keypress'
    )

    if (keyPressEvents.length) {
      this.listener[listenerKey].push({
        el,
        eventName: 'keypress',
        event: (e) => {
          if (e.target !== el) return

          keyPressEvents.forEach((keyEvent) => {
            if (areKeysPressed(e, keyEvent.keycodes))
              this.evaluate(keyEvent.attribute)
          })
        },
      })
    }
  }

  setEvent(attr) {
    if (attr === ':press') return this.setPressEvent()
    else if (attr === ':change') return this.setChangeEvent()
    else if (attr === ':clickout') return this.setClickoutEvent()
    else if (attr === ':clickme') return this.setClickMeEvent()
    else if (attr === ':load') return this.evaluate(':load')

    const el = this.entity.element

    if (this.listener[attr]) this.disposeEvent(attr, false)

    const expr = el.getAttribute(attr)
    if (!expr) return

    const nativeEventName =
      attr in EventsExtensions.USER_CUSTOM_EVENTS
        ? EventsExtensions.USER_CUSTOM_EVENTS[attr]
        : attr.substring(1)

    this.listener[attr] = {
      el,
      eventName: nativeEventName,
      event: () => {
        this.evaluate(attr)
      },
    }
  }

  async evaluate(attr) {
    const expr = this.entity.element.getAttribute(attr)
    if (!expr) return

    try {
      this._attachVariableHelpers(attr)

      await this._interpret(expr)

      this._attachVariableHelpers(attr)
    } catch (error) {
      if (!this.entity.isExists()) return
      console.error(
        `Failed to evaluate ${attr} for ${this.entity.id}:\n\nCode:\n${expr}\n\n`,
        error
      )
    }
  }

  _attachVariableHelpers(attr) {
    const variables = []
    const elVariables = []
    const scopeVariables = []

    this.entity.data.getAttributeVariables(attr).forEach((variable) => {
      const [_, object] = variable.split('.')

      if (State.isElState(variable)) elVariables.push(object)
      else if (State.isScopeState(variable)) scopeVariables.push(object)
      else variables.push(variable)
    })

    const state = this.entity.base.state

    state.attachVariableHelpers(variables)
    state.attachVariableHelpers(elVariables, this.entity.id)

    if (this.entity.scope)
      state.attachVariableHelpers(scopeVariables, this.entity.scope.id)
  }

  async _interpret(expr) {
    const engine = new Interpreter(expr)
    const ids = {
      $: 'document-querySelector',
      el: `proxyWindow['${this.entity.id}']`,
      // "this" is set under the interpreter as bind context
    }

    if (this.entity.scope) ids.scope = `proxyWindow['${this.entity.scope.id}']`

    this.entity.data.variables.forEach((variable) => {
      if (State.isElState(variable) || State.isScopeState(variable)) return

      ids[variable] = `proxyWindow-${variable}`
    })

    engine.replace(ids)

    await engine.interpret(this.entity, this.entity.state)

    const state = this.entity.base.state
    engine._arrayVariables.forEach((variable) => {
      if (!this.entity.data.variables.includes(variable)) return

      if (State.isElState(variable) || State.isScopeState(variable)) {
        const [type, object] = variable.split('.')

        if (!object) return
        
        if (type === State.EL_STATE) {
          const varName = `${this.entity.id}.${object}`
          state.evaluateDependencies(varName)
        } else if (type === State.SCOPE_STATE) {
          if (!this.entity.scope) return
          const varName = `${this.entity.scope.id}.${object}`
          state.evaluateDependencies(varName)
        }
      } else
        state.evaluateDependencies(variable)
    })
  }

  disposeEvent(attr, disableTracking = true) {
    const listener = this.listener[attr]

    if (Array.isArray(listener)) {
      listener.forEach(({ el, eventName, event }) => {
        el.removeEventListener(eventName, event)
      })
    } else {
      const { el, eventName, event } = listener
      el.removeEventListener(eventName, event)
    }

    if (this.listener[attr]) delete this.listener[attr]
    if (attr === ':keyevents') this.keysPressed = {}

    if (disableTracking)
      this.dynamicEvents = this.dynamicEvents.filter((event) => event !== attr)
  }

  dispose() {
    Object.keys(this.listener).forEach((attr) => {
      this.disposeEvent(attr, true)
    })
  }
}
