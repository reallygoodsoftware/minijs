import { Entity } from '../entity'

const MutationObserver =
  window.MutationObserver || window.WebKitMutationObserver

function observeDOM(obj, callback) {
  if (obj == null || obj.nodeType !== 1) return

  if (MutationObserver) {
    // define a new observer
    const mutationObserver = new MutationObserver(callback)

    // have the observer observe for changes in children
    mutationObserver.observe(obj, {
      childList: true,
      subtree: true,
      attributes: true,
    })

    return mutationObserver
    // browser support fallback
  } else if (window.addEventListener) {
    obj.addEventListener('DOMNodeInserted', callback, false)
    obj.addEventListener('DOMNodeRemoved', callback, false)

    return () => {
      obj.removeEventListener('DOMNodeInserted', callback, false)
      obj.removeEventListener('DOMNodeRemoved', callback, false)
    }
  }
}

export class Observer {
  constructor(state) {
    this.state = state
    this.observer = null
  }

  init() {
    this.observe(document.body, (mutation) => {
      mutation.forEach((record) => {
        if (
          record.type === 'attributes' &&
          record.attributeName.startsWith(':')
        ) {
          const entity = this.state.getEntityByElement(record.target)
          if (!entity) return

          const attr = record.attributeName

          if (Events.isValidEvent(attr)) entity.events.applyEvent(attr)
          else entity.attributes.evaluateAttribute(attr)
        }

        record.removedNodes.forEach((node) => {
          if (node.nodeType !== 1) return
          const entity = this.state.getEntityByElement(node)
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

  observe(obj, callback) {
    this.observer = observeDOM(obj, callback)
  }

  disconnect() {
    if (this.observer == null) return
    this.observer.disconnect()
  }
}
