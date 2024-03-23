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

function deepEquality(arr1, arr2) {
  if (arr1.length !== arr2.length) return false

  for (let i = 0; i < arr1.length; i++) {
    if (Array.isArray(arr1[i]) && Array.isArray(arr2[i])) {
      if (!deepEquality(arr1[i], arr2[i])) return false
    } else if (arr1[i] !== arr2[i]) return false
  }

  return true
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

  toggle(...args) {
    const values = flattenArgs(args)
    const flattenArray = this.deepFlat()
    const toAddValues = values.filter((value) => !flattenArray.includes(value))
    
    deepRemove(this, values)
    this.push(...toAddValues)

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

  sameAs(array) {
    return deepEquality(this, array)
  }
}
