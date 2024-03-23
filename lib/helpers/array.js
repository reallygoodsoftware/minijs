// Mutates original array
function deepRemove(arr, values) {
  for (let i = 0; i < arr.length; i++) {
    if (Array.isArray(arr[i])) {
      deepRemove(arr[i], values)
    } else if (values.includes(arr[i])) {
      arr.splice(i, 1)
      i--
    }
  }
}

// Non-mutating deepRemove
function deepSubtract(arr, values) {
  const newArray = []

  for (let i = 0; i < arr.length; i++) {
    if (Array.isArray(arr[i])) {
      newArray.push(deepSubtract(arr[i], values))
    } else if (!values.includes(arr[i])) {
      newArray.push(arr[i])
    }
  }

  return newArray
}

function flattenArgs(args) {
  return args
    .map((arg) => (Array.isArray(arg) ? arg.flat(Infinity) : [arg]))
    .flat()
}

export class MiniArray extends Array {
  static mutateMethods = [
    'fill',
    'pop',
    'push',
    'shift',
    'unshift',
    'splice',
    'sort',
    'reverse',
    'copyWithin',
    'toggle',
    'add',
    'remove',
    'replaceAt',
  ]

  constructor(...args) {
    super(...args)
  }

  get first() {
    return this[0]
  }

  get last() {
    return this.at(-1)
  }

  deepFlat() {
    return this.flat(Infinity)
  }

  nextItem(item) {
    const flatArray = this.deepFlat()
    const nextIndex = flatArray.indexOf(item) + 1
    return nextIndex >= this.length ? flatArray.first : flatArray.at(nextIndex)
  }

  previousItem(item) {
    const flatArray = this.deepFlat()
    const previousIndex = flatArray.indexOf(item) - 1
    return previousIndex < 0 ? flatArray.last : flatArray.at(previousIndex)
  }

  toggle(value) {
    let newValue

    if (Array.isArray(value)) {
      this.length = 0
      this.push(...value)
    } else {
      let index = this.indexOf(value)

      if (index === -1) {
        this.push(value)
      } else {
        this.splice(index, 1)
      }
    }

    return this
  }

  add(value) {
    let index = this.indexOf(value)
    if (index !== -1) return this

    this.push(value)
    return this
  }

  remove(...args) {
    deepRemove(this, flattenArgs(args))
    return this
  }

  replaceAt(index, value) {
    this.splice(index, 1, value)
    return this
  }

  subtract(...args) {
    return new MiniArray(...deepSubtract(this, flattenArgs(args)))
  }

  search(...args) {
    const queries = args
      .map((arg) =>
        (Array.isArray(arg) ? arg.flat(Infinity) : [arg]).map((query) =>
          query.toString().trim().toLowerCase().split(/\s+/)
        )
      )
      .flat()

    const matches = this.deepFlat().filter((item) => {
      const lowercaseItem = item.toString().trim().toLowerCase()
      return queries.some((query) =>
        query.every((world) => lowercaseItem.includes(world))
      )
    })

    return new MiniArray(...matches)
  }
}
