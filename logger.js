const winston = require('winston');

const errorLogger = new winston.transports.File({
    handleExceptions: true,
    humanReadableUnhandledException: true,
    level: "debug",
    timestamp: true,
    filename: process.env.ERROR_LOG_FILE,
    maxsize: 10000,
    zippedArchive: true,
    json: true
});

var logger = new winston.Logger({
    transports: [
        // infoLogger,
        errorLogger
    ],
    exitOnError: false
});

module.exports = logger;