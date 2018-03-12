var express = require('express');
var path = require('path');
var favicon = require('serve-favicon');
var logger = require('morgan');
var cookieParser = require('cookie-parser');
var bodyParser = require('body-parser');

var index = require('./routes');

var app = express();

// view engine setup
app.set('views', __dirname);
app.set('view engine', 'hbs');

// uncomment after placing your favicon in /public
//app.use(favicon(path.join(__dirname, 'public', 'favicon.ico')));
app.use(logger('dev'));
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: false }));
app.use(cookieParser());
console.log(process.env.LOGNAME);
let root;
if(process.env.LOGNAME === "ubuntu"){
    root = path.resolve(".");
    console.log(root);
} else {
    root = path.resolve(".");
    console.log("root", root);
}

// app.use(express.static(path.join(__dirname, 'public')));
app.use("/vendor", express.static(path.join(root, 'vendor')));
app.use("/peers", express.static(path.join(root, 'peers')));
app.use("/peer1", express.static(path.join(root, 'peer1')));
app.use("/peer2", express.static(path.join(root, 'peer2')));

app.use('/', index);

// catch 404 and forward to error handler
app.use(function(req, res, next) {
    var err = new Error('Not Found');
    err.status = 404;
    next(err);
});

// error handler
app.use(function(err, req, res, next) {
    // set locals, only providing error in development
    res.locals.message = err.message;
    res.locals.error = req.app.get('env') === 'development' ? err : {};

    // render the error page
    res.status(err.status || 500);
    res.render('error');
});

module.exports = app;
