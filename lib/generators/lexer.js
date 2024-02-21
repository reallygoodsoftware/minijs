import { Parser } from 'acorn'
import * as walk from 'acorn-walk'
import escodegen from 'escodegen'

const IDENTIFIER_REGEX = /^[a-zA-Z_$]/

function getMemberIdentifier(node) {
  if (node.type === 'MemberExpression')
    return (
      getMemberIdentifier(node.object) +
      '.' +
      getMemberIdentifier(node.property)
    )
  if (node.type === 'ArrayExpression') return '[]'
  if (node.type === 'ThisExpression') return 'this'
  if (node.type === 'Literal') return node.raw
  if (node.type === 'CallExpression') return null
  if (node.type === 'NewExpression') return null
  return node.name
}

function setMemberIdentifier(node, members = []) {
  if (node.type === 'MemberExpression') {
    setMemberIdentifier(node.object, members)
    setMemberIdentifier(node.property, members)
  } else if (node.type === 'CallExpression') {
    return getMemberIdentifier(node.callee, members)
  } else if (node.type === 'Literal') {
    node.raw = members.shift()
  } else {
    node.name = members.shift()
  }
}

function getVariables(node) {
  const ids = { assigned: [], referenced: [] }

  if (node.type === 'ArrayPattern')
    ids.assigned = node.elements.reduce((element) => element.name)
  else if (node.type === 'ObjectPattern') {
    node.properties.forEach((property) => {
      if (property.type === 'RestElement') {
        if (property.argument.type === 'Identifier')
          ids.assigned.push(property.argument.name)
      } else if (property.type === 'Property') {
        if (property.key.type === 'Identifier')
          ids.assigned.push(property.key.name)
        if (property.value.type === 'Identifier')
          ids.referenced.push(property.value.name)
      }
    })
  } else if (node.type === 'Identifier') {
    ids.assigned = [node.name]
  } else if (node.type === 'ObjectExpression') {
    node.properties.forEach((property) => {
      if (property.type === 'Property') {
        if (property.key.type === 'Identifier')
          ids.referenced.push(property.key.name)
        if (property.value.type === 'Identifier')
          ids.referenced.push(property.value.name)
      }
    })
  } else if (node.type === 'AssignmentPattern') {
    if (node.name) ids.assigned = [node.name]
    else ids.assigned = getVariables(node.left).assigned
  }

  return {
    assigned: [...new Set(ids.assigned)],
    referenced: [...new Set(ids.referenced)],
  }
}

function getVariableNameObject(node, name) {
  if (node.type === 'ArrayPattern') {
    return [node.elements.find((element) => element.name === name)]
  } else if (node.type === 'ObjectPattern') {
    const keys = []

    node.properties.forEach((property) => {
      if (property.type === 'RestElement') {
        if (
          property.argument.type === 'Identifier' &&
          property.argument.name === name
        ) {
          keys.push(property.argument)
        }
      } else if (property.type === 'Property') {
        if (property.key.type === 'Identifier' && property.key.name === name) {
          keys.push(property.key)
        }
        if (
          property.value.type === 'Identifier' &&
          property.value.name === name
        ) {
          property.value._isValue = true
          keys.push(property.value)
        }
      }
    })

    return keys
  } else if (node.type === 'Identifier') {
    return [node]
  } else if (node.type === 'ObjectExpression') {
    const keys = []

    node.properties.forEach((property) => {
      if (property.type === 'Property') {
        if (property.key.type === 'Identifier' && property.key.name === name) {
          keys.push(property.key)
        }
        if (
          property.value.type === 'Identifier' &&
          property.value.name === name
        ) {
          property.value._isValue = true
          keys.push(property.value)
        }
      }
    })

    return keys
  }

  return []
}

/*
  Not Supported:
  - Variable shadowing
  - Function parameters
*/
export class Lexer {
  static debug = false
  static ID_TYPE = {
    declared: 'declared',
    assigned: 'assigned',
    referenced: 'referenced',
    member: 'member',
  }

  constructor(code, options = {}) {
    this._code = code.trim()
    this._isClass = options.isClass ?? false
    this._ignoredKeys = options.ignoredKeys ?? []
    try {
      this._ast = Parser.parse(code, {
        ecmaVersion: 'latest',
        sourceType: 'module',
        // Will interpret code inside an async function so return is allowed
        allowReturnOutsideFunction: true,
      })
    } catch (error) {
      throw new Error('Failed to parse code\n\n' + code + '\n\n' + error.stack)
    }
    this._identifiers = null
    this._ignoreIdTypes = []
    this._replacedIdentifiers = {}

    this.isExpression =
      this._ast.body[0]?.type === 'ExpressionStatement' &&
      this._ast.body.length === 1
  }

  get identifiers() {
    if (this._identifiers) return this._identifiers

    const ignoredKeys = this._ignoredKeys
    const ids = {
      declared: [],
      assigned: [],
      referenced: [],
      member: [],
    }

    walk.simple(this._ast, {
      Identifier(node) {
        if (ignoredKeys.includes(node.name)) return
        if (
          ids.declared.includes(node.name) ||
          ids.assigned.includes(node.name)
        )
          return
        ids.referenced.push(node.name)
      },
      VariableDeclarator(node) {
        let { assigned, referenced } = getVariables(node.id)
        const initValues = getVariables(node.init ?? {})

        assigned = assigned
          .concat(initValues.assigned)
          .filter(
            (name) =>
              !ignoredKeys.includes(name) &&
              !(ids.declared.includes(name) || ids.assigned.includes(name))
          )
        referenced = referenced
          .concat(initValues.referenced)
          .filter(
            (name) =>
              !ignoredKeys.includes(name) && !ids.declared.includes(name)
          )

        assigned.forEach((name) => {
          ids.declared.push(name)

          if (ids.referenced.includes(name))
            ids.referenced.splice(ids.referenced.indexOf(name), 1)
          if (ids.assigned.includes(name))
            ids.assigned.splice(ids.assigned.indexOf(name), 1)
        })

        referenced.forEach((name) => {
          if (ids.declared.includes(name)) return
          if (ids.referenced.includes(name)) return
          ids.referenced.push(name)
        })
      },
      AssignmentExpression(node) {
        let { assigned, referenced } = getVariables(node.left)

        assigned = assigned.filter(
          (name) => !ignoredKeys.includes(name) && !ids.declared.includes(name)
        )
        referenced = referenced.filter(
          (name) => !ignoredKeys.includes(name) && !ids.declared.includes(name)
        )

        assigned.forEach((name) => {
          ids.assigned.push(name)
          if (ids.referenced.includes(name))
            ids.referenced.splice(ids.referenced.indexOf(name), 1)
        })

        referenced.forEach((name) => {
          if (ids.declared.includes(name)) return
          if (ids.referenced.includes(name)) return
          ids.referenced.push(name)
        })
      },
      MemberExpression(node) {
        const identifier = getMemberIdentifier(node)

        const members = identifier.split('.')
        const hasInvalidIdentifiers = members.some(
          (member) =>
            !IDENTIFIER_REGEX.test(member) ||
            ['null', 'undefined'].includes(member)
        )
        if (hasInvalidIdentifiers) return

        if (identifier.startsWith('this.')) return
        if (ignoredKeys.some((key) => identifier.startsWith(key + '.'))) return
        if (ids.member.includes(identifier)) return
        if (ids.declared.includes(members[0])) return
        ids.member.push(identifier)
      },
      ArrowFunctionExpression(node) {
        const params = node.params.reduce(
          (acc, param) => [...acc, ...getVariables(param).assigned],
          []
        )

        params.forEach((id) => {
          if (ids.declared.includes(id)) return
          ids.declared.push(id)
        })
      },
      FunctionDeclaration(node) {
        if (!ids.declared.includes(node.id.name))
          ids.declared.push(node.id.name)

        const params = node.params.reduce(
          (acc, param) => [...acc, ...getVariables(param).assigned],
          []
        )

        params.forEach((id) => {
          if (ids.declared.includes(id)) return
          ids.declared.push(id)
        })
      },
    })

    ids.referenced = ids.referenced.filter(
      (value) =>
        !ids.declared.includes(value) &&
        !ids.assigned.includes(value) &&
        !(
          typeof globalThis[value] === 'function' &&
          globalThis[value].toString().indexOf('[native code]') !== -1
        )
    )
    ids.assigned = ids.assigned.filter((value) => !ids.declared.includes(value))

    this._identifiers = ids

    return ids
  }

  /*
    - For members, dot notation for replacement
      Example: { 'console.log': 'consoler.logger' } -> consoler.logger('Hello World')
    - For a single member to include multiple identifiers, use dash notation
      Example: { 'console.log': 'window-console.log-ger' } -> window.console.log.ger('Hello World')
   */
  replace(ids, ignoredTypes = []) {
    this._ignoreIdTypes = ignoredTypes
    this._replacedIdentifiers = ids

    Object.entries(ids).forEach(([key, value]) => {
      const keyLength = key.split('.').length
      if (keyLength === 1) return
      if (keyLength !== value.split('.').length) {
        if (Lexer.debug)
          console.warn(
            `[Lexer.replace] Identifier "${key}" has different length with "${value}"`
          )
        else delete ids[key]
      }
    })
  }

  output() {
    if (Object.keys(this._replacedIdentifiers).length) {
      const identifiers = this._replacedIdentifiers
      const ignoredKeys = this._ignoredKeys
      const ids = new Map()

      walk.simple(this._ast, {
        Identifier(node) {
          if (ignoredKeys.includes(node.name)) return

          const item = ids.get(node.name)
          ids.set(node.name, {
            type:
              item?.type === Lexer.ID_TYPE.declared
                ? item.type
                : Lexer.ID_TYPE.referenced,
            objects: [...(item?.objects || []), node],
          })
        },
        VariableDeclarator(node) {
          let { assigned, referenced } = getVariables(node.id)
          const initValues = getVariables(node.init ?? {})

          assigned = assigned
            .concat(initValues.assigned)
            .filter((name) => !ignoredKeys.includes(name))
          referenced = referenced
            .concat(initValues.referenced)
            .filter((name) => !ignoredKeys.includes(name))

          const setReferenceNodes = (name, type) => {
            const item = ids.get(name)
            const idNodes = getVariableNameObject(node.id, name)
            const initIdNodes = getVariableNameObject(node.init, name)

            idNodes.forEach((idNode) => {
              ids.set(name, {
                type,
                objects: [...(item?.objects || []), idNode],
              })
            })

            initIdNodes.forEach((idNode) => {
              if (!idNode._isValue) return

              ids.set(name, {
                type: Lexer.ID_TYPE.referenced,
                objects: [...(item?.objects || []), idNode],
              })
            })
          }

          assigned.forEach((name) =>
            setReferenceNodes(name, Lexer.ID_TYPE.declared)
          )
          referenced.forEach((name) =>
            setReferenceNodes(name, Lexer.ID_TYPE.referenced)
          )
        },
        UnaryExpression(node) {
          if (node.argument.type !== 'Identifier') return

          const name = node.argument.name
          if (ignoredKeys.includes(name)) return

          const item = ids.get(name)
          ids.set(name, {
            type: item?.type || Lexer.ID_TYPE.referenced,
            objects: [...(item?.objects || []), node.argument],
          })
        },
        AssignmentExpression(node) {
          let { assigned, referenced } = getVariables(node.left)

          assigned = assigned.filter((name) => !ignoredKeys.includes(name))
          referenced = referenced.filter((name) => !ignoredKeys.includes(name))

          const setReferenceNodes = (name, type) => {
            const item = ids.get(name)
            const idNodes = getVariableNameObject(node.left, name)

            idNodes.forEach((idNode) => {
              ids.set(name, {
                type:
                  type ??
                  (item?.type === Lexer.ID_TYPE.declared
                    ? item.type
                    : Lexer.ID_TYPE.assigned),
                objects: [...(item?.objects || []), idNode],
              })
            })
          }

          assigned.forEach((name) => setReferenceNodes(name))
          referenced.forEach((name) =>
            setReferenceNodes(name, Lexer.ID_TYPE.referenced)
          )
        },
        MemberExpression(node) {
          const identifier = getMemberIdentifier(node)

          const members = identifier.split('.')
          const hasInvalidIdentifiers = members.some(
            (member) =>
              !IDENTIFIER_REGEX.test(member) ||
              ['null', 'undefined'].includes(member)
          )

          if (hasInvalidIdentifiers) return

          const parentItem = ids.get(members[0])
          if (parentItem?.type === Lexer.ID_TYPE.declared) return

          if (ignoredKeys.some((key) => identifier.startsWith(key + '.')))
            return

          const item = ids.get(identifier)
          ids.set(identifier, {
            type: Lexer.ID_TYPE.member,
            objects: [...(item?.objects || []), node],
          })
        },
        ThisExpression(node) {
          if (identifiers.hasOwnProperty('this')) {
            node.type = 'Identifier'
            node.name = identifiers['this']
          }
        },
      })

      for (const [id, item] of ids) {
        if (
          this._ignoreIdTypes.includes(Lexer.ID_TYPE.declared) &&
          item.type === Lexer.ID_TYPE.declared
        )
          continue
        if (
          this._ignoreIdTypes.includes(Lexer.ID_TYPE.referenced) &&
          item.type === Lexer.ID_TYPE.referenced
        )
          continue
        if (
          this._ignoreIdTypes.includes(Lexer.ID_TYPE.member) &&
          item.type === Lexer.ID_TYPE.member
        )
          continue
        if (
          this._ignoreIdTypes.includes(Lexer.ID_TYPE.assigned) &&
          item.type === Lexer.ID_TYPE.assigned
        )
          continue
        if (!(id in identifiers)) continue

        if (item.type === 'member') {
          const members = identifiers[id]
            .split('.')
            .map((member) => member.replace(/-/g, '.'))

          item.objects.forEach((item) => {
            setMemberIdentifier(item.object, [...members])
          })
        } else {
          item.objects.forEach((object) => {
            object.name = identifiers[id].replace(/-/g, '.')
          })
        }
      }
    }

    const logOutput = (output) => {
      if (!Lexer.debug) return
      console.log({ input: this._code, output, ids: this._replacedIdentifiers })
    }

    if (this._isClass) {
      const that = this
      let output = []
      let hasConditional = false

      walk.simple(this._ast, {
        ConditionalExpression(node) {
          hasConditional = true

          const test = escodegen.generate(node.test)
          const consequent = escodegen.generate(node.consequent)
          const alternate = escodegen.generate(node.alternate)

          output.push({ test, consequent, alternate, isExpression: true })
        },
        IfStatement(node) {
          hasConditional = true

          const test = escodegen.generate(node.test)
          let consequent = escodegen.generate(node.consequent)
          let alternate = escodegen.generate(node.alternate)

          // remove block statement symbols
          consequent = consequent.substring(1, consequent.length - 1)
          alternate = alternate.substring(1, alternate.length - 1)

          output.push({ test, consequent, alternate, isExpression: false })
        },
      })

      if (!hasConditional) output = escodegen.generate(this._ast)

      logOutput(output)
      return output
    }

    const output = escodegen.generate(this._ast)
    logOutput(output)

    return output
  }
}
