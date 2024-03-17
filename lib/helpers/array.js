export class MiniArray extends Array {
  static mutateMethods = ['fill', 'pop', 'push', 'shift', 'unshift', 'splice', 'sort', 'reverse', 'copyWithin', 'toggle', 'add', 'remove', 'replaceAt']

  constructor(...args) {
    super(...args)
  }

  get first() {
    return this[0]
  }

  get last() {
    return this.at(-1)
  }

  nextItem(item) {
    const nextIndex = this.indexOf(item) + 1
    return nextIndex >= this.length ? this.first : this.at(nextIndex)
  }

  previousItem(item) {
    const previousIndex = this.indexOf(item) - 1
    return previousIndex < 0 ? this.last : this.at(previousIndex)
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

  remove(value) {
    let index = this.indexOf(value)
    if (index === -1) return this

    this.splice(index, 1)
    return this
  }

  replaceAt(index, value) {
    this.splice(index, 1, value)
    return this
  }
  
  subtract(arr) {
    return new MiniArray(...this.filter((item) => !arr.includes(item)))
  }

  search(query) {
    const normalizedQuery = query.toLowerCase().split(/\s+/)

    const matches = this.filter((item) => {
      const lowercaseItem = item.toLowerCase()
      return normalizedQuery.every((word) => lowercaseItem.includes(word))
    })

    return new MiniArray(...matches)
  }
}
