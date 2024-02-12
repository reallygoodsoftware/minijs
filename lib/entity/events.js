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

export class Events {
  static CUSTOM_KEY_EVENTS = [':keyup', ':keydown', ':keypress']
  static CUSTOM_EVENTS = [
    ':change',
    ':clickout',
    ':press',
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

  constructor(base) {
    this.base = base
    this.listener = {}
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

  apply() {
    this.dispose()

    this.setChangeEvent()
    this.setClickoutEvent()
    this.setPressEvent()

    const el = this.base.element

    // Other Event Bindings
    Array.from(el.attributes).forEach((attr) => {
      if (attr.name === ':load') return
      if (!Events.isValidEvent(attr.name)) return

      const isKeyEvent = Events.CUSTOM_KEY_EVENTS.some((keyType) =>
        attr.name.startsWith(keyType + '.')
      )

      if (isKeyEvent) {
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

  setKeyEvent(attr) {
    const [event, keycode] = attr.split('.')

    if (!Events.CUSTOM_KEY_EVENTS.includes(event)) return

    const el = this.base.element

    if (!el.hasAttribute(attr)) return
    if (this.listener[attr]) this.disposeEvent(attr)

    let key = keycode[0].toUpperCase() + keycode.slice(1)

    if (['up', 'down', 'left', 'right'].includes(keycode)) {
      key = 'Arrow' + key
    } else if (!['enter', 'space'].includes(keycode)) {
      return
    }

    this.listener[attr] = {
      el,
      eventName: event.substring(1),
      event: (e) => {
        if (e.target !== el) return
        if (e.key !== key) return
        this.evaluate(attr)
      },
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
    await this.base._interpret(value)
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
