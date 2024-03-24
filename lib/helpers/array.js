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

function deepSearch(arr, queries, isSubItem = false) {
  const newArray = []

  for (let i = 0; i < arr.length; i++) {
    if (Array.isArray(arr[i])) {
      const subArray = deepSearch(arr[i], queries, true)

      if (subArray.length > 0)
        newArray.push(subArray)
    } else {
      const lowercaseItem = arr[i].toString().trim().toLowerCase()
      const matches = queries.some((query) => lowercaseItem.includes(query))

      if (matches) {
        if (isSubItem)
          return arr
        else
          newArray.push(arr[i])
      }
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

function getNextIndex(arr, targetArray, nextIndexCallback) {
  const index = arr.findIndex(subArray => 
    Array.isArray(subArray) && deepEquality(subArray, targetArray)
  );

  if (index === -1) return null;
  
  const nextIndex = nextIndexCallback(index, arr.length)
  const difference = Math.abs(nextIndex - index)

  if (difference === 0)
    return arr[index]
  else if (nextIndex >= arr.length) {
    return difference === 1 ? arr.first : arr[difference - 1]
  } else if (nextIndex < 0) {
    return difference === 1 ? arr.last : arr[arr.length - difference]
  } else {
    return arr[nextIndex]
  }
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

  get deepFirst() {
    return this.deepFlat().first
  }

  get deepLast() {
    return this.deepFlat().last
  }

  deepFlat() {
    return this.flat(Infinity)
  }

  nextItem(item) {
    if (Array.isArray(item)) {
      return getNextIndex(this, item, (index) => index + 1)
    } else {
      const flatArray = this.deepFlat()
      const nextIndex = flatArray.indexOf(item) + 1
      if (nextIndex === -1) return null
      return nextIndex >= flatArray.length ? flatArray.first : flatArray.at(nextIndex)
    }
  }

  previousItem(item) {
    if (Array.isArray(item)) {
      return getNextIndex(this, item, (index) => index - 1)
    } else {
      const flatArray = this.deepFlat()
      const previousIndex = flatArray.indexOf(item) - 1
      if (previousIndex === -1) return null
      return previousIndex < 0 ? flatArray.last : flatArray.at(previousIndex)
    }
  }

  toggle(...args) {
    const values = flattenArgs(args)
    const flattenArray = this.deepFlat()
    const toAddValues = values.filter((value) => !flattenArray.includes(value))

    deepRemove(this, values)
    this.push(...toAddValues)

    return this
  }

  add(...args) {
    const flattenArray = this.deepFlat()
    const toAddValues = flattenArgs(args).filter(
      (value) => !flattenArray.includes(value)
    )

    this.push(...toAddValues)

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
        (Array.isArray(arg) ? arg.flat(Infinity) : [arg]).map((query) => {
          return query.toString().trim().toLowerCase().split()
        })
      )
      .flat(Infinity)

    return new MiniArray(...deepSearch(this, queries))
  }

  sameAs(array) {
    return deepEquality(this, array)
  }
}
