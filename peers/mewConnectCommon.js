

class MewConnectCommon{
    constructor(uiCommunicatorFunc, loggingFunc){
        this.uiCommunicatorFunc = uiCommunicatorFunc || function (arg1, arg2) {
        };
        this.logger = loggingFunc || function (arg1, arg2) {
        };
        this.middleware = [];
    }


    use(func) {
        this.middleware.push(func);
    }

    useDataHandlers(input, fn) {
        var fns = this.middleware.slice(0);
        if (!fns.length) return fn(null);

        function run(i) {
            fns[i](input, function (err) {
                // upon error, short-circuit
                if (err) return fn(err);

                // if no middleware left, summon callback
                if (!fns[i + 1]) return fn(null);

                // go on to next
                run(i + 1);
            });
        }

        run(0);
    }

    applyDatahandlers(data) {
        let next = function (args) {
            return args;
        }; // function that runs after all middleware
        this.useDataHandlers(data, next);
    }

    /*
    * allows external function to listen for lifecycle events
    */
    uiCommunicator(event, data) {
        return data ? this.uiCommunicatorFunc(event, data) : this.uiCommunicatorFunc(event);
    }


    // getWebRtcLibrary(){
    //     return
    // }
}