const winston = require('winston');

const infoLogger = new winston.transports.File({
    handleExceptions: true,
    humanReadableUnhandledException: true,
    level: process.env.INFO_LOG_LEVEL,
    timestamp: true,
    filename: process.env.INFO_LOG_FILE,
    maxsize: 10000,
    zippedArchive: true,
    json: true
});

const errorLogger = new winston.transports.File({
    handleExceptions: true,
    humanReadableUnhandledException: true,
    level: "error",
    timestamp: true,
    filename: process.env.ERROR_LOG_FILE,
    maxsize: 10000,
    zippedArchive: true,
    json: true
});

const consoleLogger = new winston.transports.Console({
    handleExceptions: true,
    json: true,
    level: "debug"
});

var logger = new winston.Logger({
    transports: [
        // infoLogger,
        errorLogger
    ],
    exitOnError: false
});

module.exports = logger;