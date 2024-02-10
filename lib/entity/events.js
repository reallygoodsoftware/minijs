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
  static CUSTOM_EVENTS = [':change', ':clickout', ':press']
  static CUSTOM_KEY_EVENTS = [':keyup', ':keydown', ':keypress']

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

  static isValidEvent(event) {
    return (
      Events.validEvents.includes(event) ||
      Events.CUSTOM_KEY_EVENTS.some((key) => event.startsWith(key + '.'))
    )
  }

  constructor(base) {
    this.base = base
    this.listener = {}
  }

  apply() {
    this.dispose()

    const el = this.base.element

    // Change binding
    if (el.hasAttribute(':change')) {
      this.listener[':change'] = {
        el,
        eventName:
          el.type == 'checkbox' || el.tagName == 'select' ? 'change' : 'input',
        event: () => {
          this.evaluate(':change')
        },
      }
    }

    if (el.hasAttribute(':clickout')) {
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

    if (el.hasAttribute(':press')) {
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

    // Other Event Bindings
    Array.from(el.attributes).forEach((attr) => {
      if (
        attr.name.startsWith(':') &&
        !MiniJS.allCustomBindings.includes(attr.name)
      ) {
        const nativeEventName = attr.name.substring(1)
        this.listener[attr.name] = {
          el,
          eventName: nativeEventName,
          event: () => {
            this.evaluate(attr.name)
          },
        }
      } else if (attr.name.startsWith(':keyup.')) {
        const [event, keycode] = attr.name.split('.')
        const nativeEventName = event.substring(1)

        let key = keycode[0].toUpperCase() + keycode.slice(1)

        if (['up', 'down', 'left', 'right'].includes(keycode)) {
          key = 'Arrow' + key
        } else if (!['enter', 'space'].includes(keycode)) {
          return
        }

        this.listener[attr.name] = {
          el,
          eventName: nativeEventName,
          event: (e) => {
            if (e.target !== el) return
            if (e.key !== key) return
            this.evaluate(attr.name)
          },
        }
      }
    })

    // Add event listeners
    Object.keys(this.listener).forEach((key) => {
      const listener = this.listener[key]

      if (Array.isArray(listener)) {
        listener.forEach(({ el, eventName, event }) => {
          el.addEventListener(eventName, event)
        })
      } else {
        const { el, eventName, event } = listener
        el.addEventListener(eventName, event)
      }
    })
  }

  async evaluate(attr) {
    const value = this.base.element.getAttribute(attr)
    if (!value) return
    await this.base._interpret(value)
  }

  dispose() {
    Object.keys(this.listener).forEach((key) => {
      const listener = this.listener[key]

      if (Array.isArray(listener)) {
        listener.forEach(({ el, eventName, event }) => {
          el.removeEventListener(eventName, event)
        })
      } else {
        const { el, eventName, event } = listener
        el.removeEventListener(eventName, event)
      }
    })
  }
}
