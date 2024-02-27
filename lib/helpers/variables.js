export const isNativeVariable = (variable) =>
  typeof window[variable] === 'function' &&
  window[variable].toString().indexOf('[native code]') !== -1
