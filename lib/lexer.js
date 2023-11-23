import { Parser } from 'acorn';
import * as walk from 'acorn-walk';
import escodegen from 'escodegen';

const IDENTIFIER_REGEX = /^[a-zA-Z_$]/;

function getMemberIdentifier(node) {
  if (node.type === 'MemberExpression')
    return getMemberIdentifier(node.object) + '.' + getMemberIdentifier(node.property);
  if (node.type === 'CallExpression')
    return getMemberIdentifier(node.callee);
  if (node.type === 'ArrayExpression')
    return '[]';
  if (node.type === 'ThisExpression')
    return 'this';
  if (node.type === 'Literal')
    return node.raw;

  return node.name;
}

function setMemberIdentifier(node, members = []) {
  if (node.type === 'MemberExpression') {
    setMemberIdentifier(node.object, members);
    setMemberIdentifier(node.property, members);
  } else if (node.type === 'CallExpression') {
    return getMemberIdentifier(node.callee, members);
  } else if (node.type === 'Literal') {
    node.raw = members.shift();
  } else {
    node.name = members.shift();
  }
}

export default class Lexer {
  static debug = false;
  static ID_TYPE = {
    declared: 'declared',
    assigned: 'assigned',
    referenced: 'referenced',
    member: 'member',
  };

  constructor(code, ignoredKeys = []) {
    this._code = code;
    this._ignoredKeys = ignoredKeys;
    this._ast = Parser.parse(code, {
      ecmaVersion: 'latest',
      sourceType: 'module',
    });
    this._identifiers = null;
    this._ignoreIdTypes = [];
    this._replacedIdentifiers = {};
  }

  get identifiers() {
    if (this._identifiers) return this._identifiers;

    const ignoredKeys = this._ignoredKeys;
    const ids = {
      declared: [],
      assigned: [],
      referenced: [],
      member: [],
    };
    
    walk.simple(this._ast, {
      Identifier(node) {
        if (ignoredKeys.includes(node.name)) return;
        if (ids.declared.includes(node.name) || ids.assigned.includes(node.name)) return;
        ids.referenced.push(node.name);
      },
      VariableDeclarator(node) {
        const name = node.id.name;
        if (ignoredKeys.includes(name)) return;
        if (ids.declared.includes(name) || ids.assigned.includes(name)) return;
        ids.declared.push(name);

        if (ids.referenced.includes(name))
          ids.referenced.splice(ids.referenced.indexOf(name), 1);
        if (ids.assigned.includes(name))
          ids.assigned.splice(ids.assigned.indexOf(name), 1);
      },
      AssignmentExpression(node) {
        if (node.left.type !== 'Identifier') return;
        const name = node.left.name;
        if (ignoredKeys.includes(name)) return;
        if (ids.declared.includes(name)) return;
        ids.assigned.push(name);

        if (ids.referenced.includes(name))
          ids.referenced.splice(ids.referenced.indexOf(name), 1);
      },
      MemberExpression(node) {
        const identifier = getMemberIdentifier(node);
        
        const members = identifier.split('.');
        const hasInvalidIdentifiers = members.some((member) => !IDENTIFIER_REGEX.test(member));
        if (hasInvalidIdentifiers) return;

        if (identifier.startsWith('this.')) return;
        if (ignoredKeys.some((key) => identifier.startsWith(key + '.'))) return;
        if (ids.member.includes(identifier)) return;
        ids.member.push(identifier);
      },
    });

    ids.referenced = ids.referenced.filter((value) => (
      !ids.declared.includes(value) && !ids.assigned.includes(value)
    ));
    ids.assigned = ids.assigned.filter((value) => !ids.declared.includes(value));

    this._identifiers = ids;

    return ids;
  }

  replace(ids, ignoredTypes = []) {
    this._ignoreIdTypes = ignoredTypes;
    this._replacedIdentifiers = ids;

    Object.entries(ids).forEach(([key, value]) => {
      const keyLength = key.split('.').length;
      if (keyLength === 1) return;
      if (keyLength !== value.split('.').length) {
        if (Lexer.debug)
          console.warn(`[Lexer.replace] Identifier "${key}" has different length with "${value}"`);
        else
          delete ids[key];
      }
    });
  }

  output() {
    if (Object.keys(this._replacedIdentifiers).length) {
      const identifiers = this._replacedIdentifiers;
      const ignoredKeys = this._ignoredKeys;
      const ids = new Map();

      walk.simple(this._ast, {
        Identifier(node) {
          if (ignoredKeys.includes(node.name)) return;
          
          const item = ids.get(node.name);
          ids.set(node.name, {
            type: item?.type === Lexer.ID_TYPE.declared
              ? item.type
              : Lexer.ID_TYPE.referenced,
            objects: [...(item?.objects || []), node],
          });
        },
        VariableDeclarator(node) {
          const name = node.id.name;
          if (ignoredKeys.includes(name)) return;
          
          const item = ids.get(name);
          ids.set(name, {
            type: Lexer.ID_TYPE.declared,
            objects: [...(item?.objects || []), node.id],
          });
        },
        UnaryExpression(node) {
          if (node.argument.type !== 'Identifier') return;

          const name = node.argument.name;
          if (ignoredKeys.includes(name)) return;
          
          const item = ids.get(name);
          ids.set(name, {
            type: item?.type || Lexer.ID_TYPE.referenced,
            objects: [...(item?.objects || []), node.argument],
          });
        },
        AssignmentExpression(node) {
          if (node.left.type !== 'Identifier') return;

          const name = node.left.name;
          if (ignoredKeys.includes(name)) return;
          
          const item = ids.get(name);
          ids.set(name, {
            type: item?.type === Lexer.ID_TYPE.declared
              ? item.type
              : Lexer.ID_TYPE.assigned,
            objects: [...(item?.objects || []), node.left],
          });
        },
        MemberExpression(node) {
          const identifier = getMemberIdentifier(node);
          
          const members = identifier.split('.');
          const hasInvalidIdentifiers = members.some((member) => !IDENTIFIER_REGEX.test(member));
          if (hasInvalidIdentifiers) return;

          if (ignoredKeys.some((key) => identifier.startsWith(key + '.'))) return;

          const item = ids.get(identifier);
          ids.set(identifier, {
            type: Lexer.ID_TYPE.member,
            objects: [...(item?.objects || []), node],
          });
        },
        ThisExpression(node) {
          if (identifiers.hasOwnProperty('this')) {
            node.type = 'Identifier';
            node.name = identifiers['this'];
          }
        },
      });

      for (const [id, item] of ids) {
        if (this._ignoreIdTypes.includes(Lexer.ID_TYPE.declared) && item.type === Lexer.ID_TYPE.declared) continue;
        if (this._ignoreIdTypes.includes(Lexer.ID_TYPE.referenced) && item.type === Lexer.ID_TYPE.referenced) continue;
        if (this._ignoreIdTypes.includes(Lexer.ID_TYPE.member) && item.type === Lexer.ID_TYPE.member) continue;
        if (this._ignoreIdTypes.includes(Lexer.ID_TYPE.assigned) && item.type === Lexer.ID_TYPE.assigned) continue;
        if (!(id in identifiers)) continue;

        if (item.type === 'member') {
          const members = identifiers[id].split('.');
          item.objects.forEach((item) => {
            setMemberIdentifier(item.object, members);
          });
        } else {
          item.objects.forEach((object) => {
            object.name = identifiers[id];
          });
        }
      }
    }

    const output = escodegen.generate(this._ast);
    if (Lexer.debug) {
      console.log({ input: this._code, output, ids: this._replacedIdentifiers });
    }
    return output;
  }
}
