import { Parser } from 'acorn'
import * as walk from 'acorn-walk'
import escodegen from 'escodegen'

function getMemberIdentifier(node) {
  if (node.type === 'MemberExpression') {
    const object = getMemberIdentifier(node.object)
    const property = getMemberIdentifier(node.property)

    if (object !== null && property !== null) return object + '.' + property
    else if (object !== null) return object
    else if (property !== null) return property
    else return ''
  }
  if (node.type === 'ArrayExpression') return '[]'
  if (node.type === 'ThisExpression') return 'this'
  if (node.type === 'Literal') return node.raw
  if (node.type === 'CallExpression') return ''
  if (node.type === 'NewExpression') return ''
  return node.name
}

function getDeclaredVariables(node, isParent = true) {
  if (node.type === 'VariableDeclaration') {
    const ids = node.declarations.reduce((acc, decl) => {
      if (decl.type === 'VariableDeclarator') {
        if (decl.id.type === 'Identifier') acc.push(decl.id.name)
        else if (decl.id.type === 'ArrayPattern') {
          decl.id.elements.forEach((element) => {
            if (element.type === 'Identifier') acc.push(element.name)
          })
        } else if (decl.id.type === 'ObjectPattern') {
          decl.id.properties.forEach((prop) => {
            if (prop.value.type === 'Identifier') acc.push(prop.value.name)
          })
        }
      } else if (decl.id.type === 'Identifier') acc.push(decl.id.name)
      else if (decl.id.type === 'ArrayPattern') {
        decl.id.elements.forEach((element) => {
          if (element.type === 'Identifier') acc.push(element.name)
        })
      } else if (decl.id.type === 'ObjectPattern') {
        decl.id.properties.forEach((prop) => {
          if (prop.value.type === 'Identifier') acc.push(prop.value.name)
        })
      }

      return acc
    }, [])

    return ids
  } else if (
    [
      'FunctionDeclaration',
      'ArrowFunctionExpression',
      'FunctionExpression',
    ].includes(node.type)
  ) {
    const ids = []
    if (isParent) {
      const params = node.params.reduce((acc, param) => {
        if (param.type === 'Identifier') acc.push(param.name)
        if (
          param.type === 'RestElement' &&
          param.argument.type === 'Identifier'
        )
          acc.push(param.argument.name)
        return acc
      }, [])

      ids.push(...params)
    }

    if (node.id?.type === 'Identifier') ids.push(node.id.name)
    return ids
  } else if (node.type === 'ObjectPattern') {
    const ids = node.properties.reduce((acc, prop) => {
      if (prop.value.type === 'Identifier') acc.push(prop.value.name)
      return acc
    }, [])

    return ids
  }

  return []
}

function getVariables(node) {
  const ids = []

  if (node.type === 'Identifier') ids.push(node.name)
  else if (node.type === 'MemberExpression') {
    const [object] = getMemberIdentifier(node.object).split('.')
    if (object.length) ids.push(object)
  } else if (node.type === 'AssignmentExpression') {
    ids.push(...getVariables(node.left))
    ids.push(...getVariables(node.right))
  } else if (node.type === 'ArrayPattern') {
    node.elements.forEach((element) => {
      if (element.type === 'Identifier') ids.push(element.name)
    })
  } else if (node.type === 'ObjectPattern') {
    node.properties.forEach((prop) => {
      if (prop.value.type === 'Identifier') ids.push(prop.value.name)
    })
  }

  return ids
}

export class Lexer {
  static debug = false
  static IGNORED_KEYS = ['event', 'window', 'document', 'console', 'Math']
  static ENTITY_KEYS = ['el', 'parent']

  constructor(code) {
    this._code = code
    this._declaredIdentifiers = null
    this._identifiers = null
    this.__replacedIdentifiers = {}

    try {
      this._ast = Parser.parse(code, {
        ecmaVersion: 'latest',
        sourceType: 'module',
        // Will interpret code inside an async function so return is allowed
        allowReturnOutsideFunction: true,
      })

      this.isExpression =
        this._ast.body[0]?.type === 'ExpressionStatement' &&
        this._ast.body.length === 1
    } catch (error) {
      throw new Error('Failed to parse code\n\n' + code + '\n\n' + error.stack)
    }
  }

  deepClone(obj) {
    return JSON.parse(JSON.stringify(obj))
  }

  /**
   * Checks if a variable is declared in the current scope
   * @param {string} id - The variable name
   * @param {Array} state - The current state of the program (node object)
   * @returns {boolean} - Whether the variable is declared or not
   */
  isDeclared(id, state) {
    const ancestors = this.deepClone(state)
    let currentNode = null
    let previousNode = null
    let isParent = true

    while (ancestors.length) {
      previousNode = currentNode
      currentNode = ancestors.pop()
      isParent = true

      // Move to the previous line of the program
      if (['Program', 'BlockStatement'].includes(currentNode.type)) {
        const { start, end, type } = previousNode
        const previousNodeIndex = currentNode.body.findIndex(
          (node) =>
            node.start === start && node.end === end && node.type === type
        )

        currentNode.body = currentNode.body.slice(0, previousNodeIndex)
        ancestors.push(currentNode)

        const nextNodeIndex =
          previousNodeIndex === -1
            ? currentNode.body.length - 1
            : previousNodeIndex - 1
        currentNode = currentNode.body[nextNodeIndex]
        isParent = false
      }

      if (currentNode == null) break

      const declarations = getDeclaredVariables(currentNode, isParent)
      if (declarations.includes(id)) return true
    }

    return false
  }

  /**
   * Get all declared identifiers in the program
   * @returns {Array} - The declared identifiers
   * Note: declared identifiers may only indicate a variable declaration,
   * variable shadowing may be used. Use isDeclared to check.
   */
  get declaredIdentifiers() {
    if (this._declaredIdentifiers) return this._declaredIdentifiers
    this.identifiers
    return this._declaredIdentifiers
  }

  /**
   * Get all identifiers in the program
   * @returns {Array} - The identifiers
   */
  get identifiers() {
    if (this._identifiers) return this._identifiers
    this._identifiers = []
    this._declaredIdentifiers = []

    walk.fullAncestor(this._ast, (node, state, parent) => {
      if (node?.type === 'MemberExpression') {
        const id = getMemberIdentifier(node)
        const [object, ...properties] = id.split('.')

        if (object.length && Lexer.ENTITY_KEYS.includes(object)) {
          this._identifiers.push(object)
          this._identifiers.push([object, properties[0]].join('.'))
        }
      } else if (node?.type === 'Identifier') {
        if (Lexer.IGNORED_KEYS.includes(node.name)) return
        if (this._declaredIdentifiers.includes(node.name)) return
        if (this._identifiers.includes(node.name)) return

        const ancestors = state.slice(0, -1)
        if (this.isDeclared(node.name, ancestors))
          this._declaredIdentifiers.push(node.name)
        else this._identifiers.push(node.name)
      } else {
        const declarations = getDeclaredVariables(node, true).filter(
          (id) =>
            !Lexer.IGNORED_KEYS.includes(id) &&
            id !== 'this' &&
            !this._declaredIdentifiers.includes(id)
        )

        const ancestors = state.slice(0, -1)
        const variables = getVariables(node).filter(
          (id) =>
            !declarations.includes(id) &&
            !Lexer.IGNORED_KEYS.includes(id) &&
            id !== 'this' &&
            !this.isDeclared(id, ancestors)
        )

        if (declarations.length)
          this._declaredIdentifiers =
            this._declaredIdentifiers.concat(declarations)

        if (variables.length)
          this._identifiers = this._identifiers.concat(variables)
      }
    })

    this._identifiers = [...new Set(this._identifiers)].filter((id) => {
      const isNativeVariable =
        typeof globalThis[id] === 'function' &&
        globalThis[id].toString().indexOf('[native code]') === -1

      return !isNativeVariable
    })
    this._declaredIdentifiers = [...new Set(this._declaredIdentifiers)]

    return this._identifiers
  }

  /**
   * Used to replace a given identifiers in the program
   * @param {Object} ids - The identifiers to replace. { identifier: replacement }
   */
  replace(ids) {
    this._replacedIdentifiers = ids

    Object.entries(ids).forEach(([key, value]) => {
      if (key.split('.').length > 1)
        throw new Error(
          `Cannot replace member expression identifier: ${key} with ${value}`
        )
    })
  }

  /**
   * Replace the identifiers in the program with the given replacements.
   * Needs to run the "replace" method first.
   * @returns {Object} - The replaced AST
   */
  replaceAST() {
    if (this._replacedIdentifiers == null) return this._ast

    const foundIds = this.identifiers
    const identifiers = this._replacedIdentifiers

    const hasIdsToReplace = foundIds.some((id) => identifiers[id] != null)
    if (!hasIdsToReplace) return this._ast

    const ast = this.deepClone(this._ast)

    walk.fullAncestor(ast, (node, state) => {
      if (identifiers['this'] != null && node?.type === 'ThisExpression') {
        node.type = 'Identifier'
        node.name = identifiers['this']
      }

      if (node?.type !== 'Identifier') return
      if (identifiers[node.name] == null) return

      if (this._declaredIdentifiers.includes(node.name)) {
        const ancestors = state.slice(0, -1)
        const isDeclared = this.isDeclared(node.name, ancestors)
        if (isDeclared) return
      }

      node.name = identifiers[node.name].replace(/-/g, '.')
    })

    return ast
  }

  /**
   * Gets the output with replaced identifiers
   * @returns {string} - The output of the program
   */
  output() {
    if (this._replacedIdentifiers == null) return this._code

    const foundIds = this.identifiers
    const identifiers = this._replacedIdentifiers

    const hasIdsToReplace = foundIds.some((id) => identifiers[id] != null)
    if (!hasIdsToReplace) return this._code

    const ast = this.replaceAST()
    const output = escodegen.generate(ast)

    if (Lexer.debug)
      console.log({
        type: 'Lexer.output',
        input: this._code,
        output,
        ids: identifiers,
      })

    return output
  }

  /**
   * Gets the conditional expressions in the program. Used in :class directive.
   * @returns {Array} - The conditional expressions [{ test, consequent, alternate, isExpression }]
   * Note: isExpression is used to differentiate between if statements and conditional expressions
   */
  conditional() {
    if (this._replacedIdentifiers == null) return this._code

    const ast = this.replaceAST()
    const output = []

    walk.simple(ast, {
      ConditionalExpression(node) {
        const test = escodegen.generate(node.test)
        const consequent = escodegen.generate(node.consequent)
        const alternate = escodegen.generate(node.alternate)

        output.push({ test, consequent, alternate, isExpression: true })
      },
      IfStatement(node) {
        const test = escodegen.generate(node.test)
        let consequent = escodegen.generate(node.consequent)
        let alternate = escodegen.generate(node.alternate)

        // remove block statement symbols
        consequent = consequent.substring(1, consequent.length - 1)
        alternate = alternate.substring(1, alternate.length - 1)

        output.push({ test, consequent, alternate, isExpression: false })
      },
    })

    if (Lexer.debug)
      console.log({
        type: 'Lexer.conditional',
        input: this._code,
        output,
        ids: this._replacedIdentifiers,
      })

    return output
  }
}
