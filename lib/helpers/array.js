function deepSearch(arr, queries, isSubItem = false) {
  const newArray = []

  for (let i = 0; i < arr.length; i++) {
    if (Array.isArray(arr[i])) {
      const subArray = deepSearch(arr[i], queries, true)

      if (subArray.length > 0) newArray.push(subArray)
    } else {
      const lowercaseItem = arr[i].toString().trim().toLowerCase()
      const matches = queries.some((query) => lowercaseItem.includes(query))

      if (matches) {
        if (isSubItem) return arr
        else newArray.push(arr[i])
      }
    }
  }

  return newArray
}

function deepEquality(arr1, arr2) {
  if (!Array.isArray(arr1) || !Array.isArray(arr2)) return false
  if (arr1.length !== arr2.length) return false

  for (let i = 0; i < arr1.length; i++) {
    if (Array.isArray(arr1[i]) && Array.isArray(arr2[i])) {
      if (!deepEquality(arr1[i], arr2[i])) return false
    } else if (arr1[i] !== arr2[i]) return false
  }

  return true
}

function getArrayItemIndex(arr, targetItem) {
  return arr.findIndex(
    (item) => Array.isArray(item) ? deepEquality(item, targetItem) : item === targetItem
  )
}

function getNextArrayItem(arr, targetArray, nextIndexCallback) {
  const index = getArrayItemIndex(arr, targetArray)
  if (index === -1) return null

  const nextIndex = nextIndexCallback(index, arr.length)
  const difference = Math.abs(nextIndex - index)

  if (difference === 0) return arr[index]
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

  static deepConvert = (arr) => {
    const newArray = new MiniArray()
  
    for (let i = 0; i < arr.length; i++)
      if (Array.isArray(arr[i])) newArray.push(MiniArray.deepConvert(arr[i]))
      else newArray.push(arr[i])
  
    return newArray
  }  

  constructor(...arr) {
    const newArray = []
    
    for (let i = 0; i < arr.length; i++)
      if (Array.isArray(arr[i]))
        newArray.push(MiniArray.deepConvert(arr[i]))
      else newArray.push(arr[i])

    super(...newArray)
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
      const nextItem = getNextArrayItem(this, item, (index) => index + 1)
      if (Array.isArray(nextItem)) return new MiniArray(...nextItem)
      return nextItem
    } else {
      const flatArray = this.deepFlat()
      const nextIndex = flatArray.indexOf(item) + 1
      let nextItem

      if (nextIndex === -1) nextItem = flatArray.first
      else
        nextItem =
          nextIndex >= flatArray.length
            ? flatArray.first
            : flatArray.at(nextIndex)

      if (Array.isArray(nextItem)) return new MiniArray(...nextItem)
      return nextItem
    }
  }

  previousItem(item) {
    if (Array.isArray(item)) {
      return getNextArrayItem(this, item, (index) => index - 1)
    } else {
      const flatArray = this.deepFlat()
      const previousIndex = flatArray.indexOf(item) - 1
      let previousItem

      if (previousIndex === -1) previousItem = flatArray.last
      else
        previousItem =
          previousIndex < 0 ? flatArray.last : flatArray.at(previousIndex)

      if (Array.isArray(previousItem)) return new MiniArray(...previousItem)
      return previousItem
    }
  }

  toggle(...args) {
    const toAddValues = []
    
    for (let i = 0; i < args.length; i++) {
      const arg = args[i];
      const index = getArrayItemIndex(this, arg)

      if (index === -1)
        toAddValues.push(arg)
      else
        this.splice(index, 1);
    }

    this.push(...new MiniArray(...toAddValues))

    return this
  }

  add(...args) {
    this.push(...new MiniArray(...args))
    return this
  }

  remove(...args) {
    for (let i = 0; i < args.length; i++) {
      const arg = args[i];
      const index = getArrayItemIndex(this, arg)

      if (index === -1) continue

      this.splice(index, 1);
    }

    return this
  }

  replaceAt(index, value) {
    this.splice(index, 1, value)
    return this
  }

  subtract(...args) {
    const newArray = []

    for (let i = 0; i < this.length; i++) {
      const item = this[i]
      const index = getArrayItemIndex(args, item)

      if (index === -1) newArray.push(item)
    }

    return new MiniArray(...newArray)
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
