
require("dotenv").config();
const moment = require("moment");
const winston = require('winston');

var serverErrorsTransport = new (require('winston-daily-rotate-file'))({
//=>
    name: 'serverErrors',
//<=
    filename: "errors.log",
    datePattern: 'D-MM-YYYY',
    dirname: "./log",
    prepend: true,
    json: false,
    zippedArchive: true,
    maxSize: '10m',
    maxFiles: '2d',
    timestamp: function () {
        return moment().format('D/MM/YYYY HH:mm:ss:SSS');
    }
})

var wrtcTransport = new (require('winston-daily-rotate-file'))({
//=>
    name: 'invalidDNS',
//<=
    filename: "wrtc.log",
    datePattern: 'D-MM-YYYY',
    dirname: "./log",
    prepend: true,
    json: false,
    zippedArchive: true,
    maxSize: '10m',
    maxFiles: '2d',
    timestamp: function () {
        return moment().format('D/MM/YYYY HH:mm:ss:SSS');
    }
})

var wrtcLogger = new (winston.Logger)({
    transports: [
        wrtcTransport
    ]
});

var serverErrors = new (winston.Logger)({
    transports: [
        serverErrorsTransport
    ]
});

let noop = {
    info: function () {
    },
    error: function () {
    },
    warn: function () {
    }
};

const logger = {
    error: console.error,
    warn: console.info,
    info: console.log
};

if (process.env.STATUS === "development") {

    var verboseTransport = new (require('winston-daily-rotate-file'))({
        name: 'verbose',
        filename: process.env.VERBOSE_LOG_FILE,
        datePattern: 'D-MM-YYYY',
        dirname: process.env.LOG_DIR + process.env.VERBOSE_LOG_DIR,
        prepend: true,
        json: true,
        zippedArchive: true,
        maxSize: '20m',
        maxFiles: '2d',
        timestamp: function () {
            return moment().format('D/MM/YYYY HH:mm:ss:SSS');
        }
    });


    var verbose = new (winston.Logger)({
        transports: [
            verboseTransport
        ]
    });

    module.exports = {
        invalidDNS: logger,
        verbose: logger,
        serverErrors: logger
    };
} else {
    module.exports = {
        wrtcLogger,
        serverErrors
    };
}

// const winston = require('winston');
//
// const infoLogger = new winston.transports.File({
//     handleExceptions: true,
//     humanReadableUnhandledException: true,
//     level: "info",
//     timestamp: true,
//     filename: process.env.INFO_LOG_FILE,
//     maxsize: 10000,
//     zippedArchive: true,
//     json: true
// });
//
// const errorLogger = new winston.transports.File({
//     handleExceptions: true,
//     humanReadableUnhandledException: true,
//     level: "error",
//     timestamp: true,
//     filename: process.env.ERROR_LOG_FILE,
//     maxsize: 10000,
//     zippedArchive: true,
//     json: true
// });
//
// const consoleLogger = new winston.transports.Console({
//     handleExceptions: true,
//     json: true,
//     level: "debug"
// });
//
// var logger = new winston.Logger({
//     transports: [
//         // infoLogger,
//         errorLogger
//     ],
//     exitOnError: false
// });
//
// module.exports = logger;