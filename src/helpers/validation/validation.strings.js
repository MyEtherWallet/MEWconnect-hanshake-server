'use strict'

const validConnId = (string) => {
  let validHex = /[0-9A-Fa-f].*/.test(string)
  let validLength = (string.length === 32)
  let result = (validHex && validLength)
  return result
}

const validHex = (string) => {
  let validHex = /[0-9A-Fa-f].*/.test(string)
  return validHex
}

export { validConnId, validHex }
