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

const SPECIAL_KEYS = ['ctrl', 'meta', 'alt', 'shift']

function mapKey(keycode, key) {
  if (keycode.startsWith('Key')) return keycode.slice(3).toLowerCase()
  if (keycode.startsWith('Digit')) return keycode.slice(5).toLowerCase()
  if (keycode.startsWith('Numpad')) return keycode.slice(6).toLowerCase()
  if (keycode.startsWith('Arrow')) return keycode.slice(5).toLowerCase()
  if (keycode.startsWith('Meta')) return 'meta'
  if (keycode.startsWith('Alt')) return 'alt'
  if (keycode.startsWith('Control')) return 'ctrl'
  if (keycode.startsWith('Shift')) return 'shift'
  return keycode.toLowerCase()
}

export class Events {
  static CUSTOM_KEY_EVENTS = [':keyup', ':keydown', ':keypress']
  static CUSTOM_EVENTS = [
    ':change',
    ':clickout',
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
    const entities = Array.from(MiniJS.state.entities.values())
    entities.forEach((entity) => {
      entity.events.apply()
    })
  }

  static isValidEvent(event) {
    if (!event.startsWith(':')) return false
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

  constructor(base) {
    this.base = base
    this.listener = {}
    this.keysPressed = {}
    this.dynamicEvents = []

    this._getDynamicEvents()
  }

  _getDynamicEvents() {
    const attributeNames = Array.from(this.base.element.attributes).map(
      (attr) => attr.name
    )

    this.dynamicEvents = attributeNames.filter((value) =>
      Events.isValidEvent(value)
    )
  }

  _handleError(attr, error) {
    if (!this.base.isExists()) return
    console.error(
      `Failed to evaluate ${attr} for Entity#${this.base.id}:`,
      error
    )
  }

  apply() {
    this.dispose()
    this.evaluate(':load')

    this.setChangeEvent()
    this.setClickoutEvent()
    this.setPressEvent()

    const el = this.base.element

    // Other Event Bindings
    Array.from(el.attributes).forEach((attr) => {
      if (attr.name === ':load') return
      if (!Events.isValidEvent(attr.name)) return

      const isKeyEvent = Events.CUSTOM_KEY_EVENTS.some(
        (key) => attr.name.startsWith(key + '.') || attr.name === key
      )

      if (Events.isKeyEvent(attr.name)) {
        this.setKeyEvent(attr.name)
      } else if (!Events.CUSTOM_EVENTS.includes(attr.name)) {
        this.setEvent(attr.name)
      }
    })

    // Add event listeners
    Object.keys(this.listener).forEach((attr) => {
      this.applyEvent(attr)
    })
  }

  applyEvent(attr) {
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
    const el = this.base.element

    if (!el.hasAttribute(':change')) return
    if (this.listener[':change']) this.disposeEvent(':change')

    this.listener[':change'] = {
      el,
      eventName:
        el.type == 'checkbox' || el.tagName == 'select' ? 'change' : 'input',
      event: () => {
        this.evaluate(':change')
      },
    }
  }

  setClickoutEvent() {
    const el = this.base.element

    if (!el.hasAttribute(':clickout')) return
    if (this.listener[':clickout']) this.disposeEvent(':clickout')

    this.listener[':clickout'] = {
      el: document,
      eventName: 'click',
      event: (e) => {
        if (!document.documentElement.contains(e.target)) return
        if (el.contains(e.target)) return
        this.evaluate(':clickout')
      },
    }
  }

  setPressEvent() {
    const el = this.base.element

    if (!el.hasAttribute(':press')) return
    if (this.listener[':press']) this.disposeEvent(':press')

    this.listener[':press'] = []
    this.listener[':press'].push({
      el,
      eventName: 'keyup',
      event: (e) => {
        if (e.target !== el) return
        if (!['Enter', 'Space'].includes(e.code)) return
        if (e.code == 'Space') e.preventDefault()
        this.evaluate(':press')
      },
    })

    this.listener[':press'].push({
      el,
      eventName: 'click',
      event: (e) => {
        this.evaluate(':press')
      },
    })

    this.listener[':press'].push({
      el,
      eventName: 'touchstart',
      event: (e) => {
        this.evaluate(':press')
      },
    })
  }

  // ! FIX: Update handling for multiple key events on same elemnt, should only add one event listener
  setKeyEvent(attr) {
    const [event, ...keycodes] = attr.split('.')

    if (!Events.CUSTOM_KEY_EVENTS.includes(event)) return

    const el = this.base.element

    if (!el.hasAttribute(attr)) return
    if (this.listener[attr]) this.disposeEvent(attr)

    const [specialKeys, normalKeys] = keycodes.reduce(
      ([special, normal], key) => {
        const lowerKey = key.toLowerCase()
        if (SPECIAL_KEYS.includes(lowerKey)) {
          special.push(lowerKey)
        } else {
          normal.push(lowerKey)
        }
        return [special, normal]
      },
      [[], []]
    )

    this.listener[attr] = []
    const ctx = this
    const nativeEventName = event.substring(1)

    const areKeysPressed = (e) =>
      normalKeys.every((key) => ctx.keysPressed[key]) &&
      specialKeys.every((key) => e[`${key}Key`])

    if (keycodes.length) {
      const handleKeyPress = (e) => {
        if (e.target !== el) return

        if (nativeEventName === 'keyup' && nativeEventName === e.type) {
          if (areKeysPressed(e)) this.evaluate(attr)
        }

        ctx.keysPressed[mapKey(e.code, e.key)] = e.type == 'keydown'

        if (nativeEventName === 'keydown' && nativeEventName === e.type) {
          if (areKeysPressed(e)) this.evaluate(attr)
        }
      }

      this.listener[attr].push({
        el,
        eventName: 'keydown',
        event: handleKeyPress,
      })

      this.listener[attr].push({
        el,
        eventName: 'keyup',
        event: handleKeyPress,
      })

      if (nativeEventName === 'keypress') {
        this.listener[attr].push({
          el,
          eventName: nativeEventName,
          event: (e) => {
            if (e.target !== el) return
            if (!areKeysPressed(e)) return
            this.evaluate(attr)
          },
        })
      }
    } else {
      this.listener[attr].push({
        el,
        eventName: nativeEventName,
        event: (e) => {
          if (e.target !== el) return
          this.evaluate(attr)
        },
      })
    }
  }

  setEvent(attr) {
    const el = this.base.element
    const nativeEventName = attr.substring(1)

    this.listener[attr] = {
      el,
      eventName: nativeEventName,
      event: () => {
        this.evaluate(attr)
      },
    }
  }

  async evaluate(attr) {
    const value = this.base.element.getAttribute(attr)
    if (!value) return

    if (attr === ':load') {
      const elVariables = this.base.variables
        .filter((v) => v.startsWith('el.') && v !== 'el')
        .map((v) => v.replace('el.', ''))
      const variables = this.base.variables.filter((v) => !v.startsWith('el.'))

      MiniJS.state.attachVariableHelpers(variables)
      MiniJS.state.attachVariableHelpers(elVariables, this.base.id)
    }

    try {
      await this.base._interpret(value)
    } catch (error) {
      this._handleError(attr, error)
    }
  }

  disposeEvent(attr) {
    const listener = this.listener[attr]
    if (Array.isArray(listener)) {
      listener.forEach(({ el, eventName, event }) => {
        el.removeEventListener(eventName, event)
      })
    } else {
      const { el, eventName, event } = listener
      el.removeEventListener(eventName, event)
    }
  }

  dispose() {
    Object.keys(this.listener).forEach((attr) => {
      this.disposeEvent(attr)
    })
  }
}
