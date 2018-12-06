'use strict';

Object.defineProperty(exports, "__esModule", {
  value: true
});

var _config = require('@config/config.redis');

Object.keys(_config).forEach(function (key) {
  if (key === "default" || key === "__esModule") return;
  Object.defineProperty(exports, key, {
    enumerable: true,
    get: function get() {
      return _config[key];
    }
  });
});

var _config2 = require('@config/config.server');

Object.keys(_config2).forEach(function (key) {
  if (key === "default" || key === "__esModule") return;
  Object.defineProperty(exports, key, {
    enumerable: true,
    get: function get() {
      return _config2[key];
    }
  });
});

var _config3 = require('@config/config.signals');

Object.keys(_config3).forEach(function (key) {
  if (key === "default" || key === "__esModule") return;
  Object.defineProperty(exports, key, {
    enumerable: true,
    get: function get() {
      return _config3[key];
    }
  });
});

var _config4 = require('@config/config.socket');

Object.keys(_config4).forEach(function (key) {
  if (key === "default" || key === "__esModule") return;
  Object.defineProperty(exports, key, {
    enumerable: true,
    get: function get() {
      return _config4[key];
    }
  });
});