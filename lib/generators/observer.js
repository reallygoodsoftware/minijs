const MutationObserver =
  window.MutationObserver || window.WebKitMutationObserver

export function observeDOM(obj, callback) {
  if (obj == null || obj.nodeType !== 1) return

  if (MutationObserver) {
    // define a new observer
    const mutationObserver = new MutationObserver(callback)

    // have the observer observe for changes in children
    mutationObserver.observe(obj, { childList: true, subtree: true })

    return mutationObserver
    // browser support fallback
  } else if (window.addEventListener) {
    obj.addEventListener('DOMNodeInserted', callback, false)
    obj.addEventListener('DOMNodeRemoved', callback, false)
  }

  return () => {
    if (MutationObserver) return
    obj.removeEventListener('DOMNodeInserted', callback, false)
    obj.removeEventListener('DOMNodeRemoved', callback, false)
  }
}
