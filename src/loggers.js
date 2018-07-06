import winston from 'winston'
// const winston = require('winston');

const errorLogger = new winston.transports.File({
  handleExceptions: true,
  humanReadableUnhandledException: true,
  level: 'debug',
  timestamp: true,
  filename: './server.log',
  maxsize: 10000,
  zippedArchive: true
  // json: true,
})

const logger = new winston.Logger({
  transports: [
    // infoLogger,
    errorLogger
  ],
  exitOnError: false
})

function consoleLoggerWrap (logToConsole) {
  return function consoleLogger (tag, content) {
    if (logToConsole) {
      if (!content) {
        console.log(tag)
      } else {
        console.log(tag, content)
      }
    } else if (!content) {
      logger.verbose(`TAG: ${tag}`)
    } else {
      logger.verbose(`TAG: ${tag}`)
      logger.verbose(content)
    }
  }
}

export {
  consoleLoggerWrap,
  logger
}
