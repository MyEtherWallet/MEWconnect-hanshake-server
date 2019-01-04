'use strict';

Object.defineProperty(exports, "__esModule", {
  value: true
});
var validConnId = function validConnId(string) {
  var validHex = /[0-9A-Fa-f].*/.test(string);
  var validLength = string.length === 32;
  var result = validHex && validLength;
  return result;
};

var validHex = function validHex(string) {
  var validHex = /[0-9A-Fa-f].*/.test(string);
  return validHex;
};

exports.validConnId = validConnId;
exports.validHex = validHex;