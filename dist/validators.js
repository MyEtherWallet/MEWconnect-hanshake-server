'use strict';

Object.defineProperty(exports, "__esModule", {
  value: true
});

var _typeof = typeof Symbol === "function" && typeof Symbol.iterator === "symbol" ? function (obj) { return typeof obj; } : function (obj) { return obj && typeof Symbol === "function" && obj.constructor === Symbol && obj !== Symbol.prototype ? "symbol" : typeof obj; };

exports.default = isValid;

var _validate = require('validate');

var _validate2 = _interopRequireDefault(_validate);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

var wholeEncrypted = ['answerSignal', 'offerSignal'];
var signature = 'signature';
var rtcConnected = 'rtcConnected';
var tryTurn = 'tryTurn';

var optionsCheck = function optionsCheck(opts) {
  if (typeof opts === 'string') {
    return true;
  } else if (typeof opts === 'number') {
    return false;
  } else if ((typeof opts === 'undefined' ? 'undefined' : _typeof(opts)) === 'object') {
    return true;
  } else {
    return false;
  }
};

var rtcConnectedValidator = new _validate2.default({
  type: String,
  required: true
});
var signatureValidator = new _validate2.default({
  signed: {
    type: String,
    required: true
  },
  connId: {
    type: String,
    required: true
  },
  version: {
    iv: {
      type: {
        type: String,
        required: true
      },
      data: {
        type: Array,
        required: true
      }
    },
    ephemPublicKey: {
      type: {
        type: String,
        required: true
      },
      data: {
        type: Array,
        required: true
      }
    },
    ciphertext: {
      type: {
        type: String,
        required: true
      },
      data: {
        type: Array,
        required: true
      }
    },
    mac: {
      type: {
        type: String,
        required: true
      },
      data: {
        type: Array,
        required: true
      }
    }
  }
});
var encryptedValidator = new _validate2.default({
  data: {
    iv: {
      type: {
        type: String,
        required: true
      },
      data: {
        type: Array,
        required: true,
        length: 16
      }
    },
    ephemPublicKey: {
      type: {
        type: String,
        required: true
      },
      data: {
        type: Array,
        required: true,
        length: 65
      }
    },
    ciphertext: {
      type: {
        type: String,
        required: true
      },
      data: {
        type: Array,
        required: true
      }
    },
    mac: {
      type: {
        type: String,
        required: true
      },
      data: {
        type: Array,
        required: true,
        length: 32
      }
    }
  },
  connId: {
    type: String,
    required: true
  }
}, { strip: false });
var tryTurnValidator = new _validate2.default({
  connId: {
    type: String,
    required: true
  },
  cont: {
    type: Boolean
  }
});

function isValid(message) {
  return new Promise(function (resolve, reject) {
    var errors = void 0;
    if (wholeEncrypted.includes(message[0])) {
      errors = encryptedValidator.validate(message[1]);
    } else if (message[0] === signature) {
      errors = signatureValidator.validate(message[1]);
    } else if (message[0] === rtcConnected) {
      errors = rtcConnectedValidator.validate(message[1]);
    } else if (message[0] === tryTurn) {
      errors = tryTurnValidator.validate(message[1]);
    } else {
      resolve(false);
    }

    if (message[1].options !== undefined && message[1].options !== null) {
      if (!optionsCheck(message[1].options)) {
        if (!errors) errors = [];
        errors.push('Invalid Options Field');
      }
    }

    if (errors.length > 0) {
      resolve(false);
    } else {
      resolve(true);
    }
  });
}