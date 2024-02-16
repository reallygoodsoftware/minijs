export function kebabToCamelCase(string) {
  return string.replace(/-([a-z])/g, function (g) {
    return g[1].toUpperCase()
  })
}

export function camelToKebabCase(string) {
  return string.replace(
    /[A-Z]+(?![a-z])|[A-Z]/g,
    ($, ofs) => (ofs ? '-' : '') + $.toLowerCase()
  )
}
