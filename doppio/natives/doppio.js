'use strict';
var Doppio = require('../doppiojvm');
var logging = Doppio.Debug.Logging;
var util = Doppio.VM.Util;
var NodeCrypto = require('crypto');
var doppio_Debug = function () {
    function doppio_Debug() {
    }
    doppio_Debug['SetLogLevel(Ldoppio/Debug$LogLevel;)V'] = function (thread, loglevel) {
        logging.log_level = loglevel['doppio/Debug$LogLevel/level'];
    };
    doppio_Debug['GetLogLevel()Ldoppio/Debug$LogLevel;'] = function (thread) {
        var ll_cls = thread.getBsCl().getInitializedClass(thread, 'Ldoppio/Debug$LogLevel;').getConstructor(thread);
        switch (logging.log_level) {
        case 10:
            return ll_cls['doppio/Debug$LogLevel/VTRACE'];
        case 9:
            return ll_cls['doppio/Debug$LogLevel/TRACE'];
        case 5:
            return ll_cls['doppio/Debug$LogLevel/DEBUG'];
        default:
            return ll_cls['doppio/Debug$LogLevel/ERROR'];
        }
    };
    return doppio_Debug;
}();
var doppio_JavaScript = function () {
    function doppio_JavaScript() {
    }
    doppio_JavaScript['eval(Ljava/lang/String;)Ljava/lang/String;'] = function (thread, to_eval) {
        try {
            var rv = eval(to_eval.toString());
            if (rv != null) {
                return util.initString(thread.getBsCl(), '' + rv);
            } else {
                return null;
            }
        } catch (e) {
            thread.throwNewException('Ljava/lang/Exception;', 'Error evaluating string: ' + e);
        }
    };
    return doppio_JavaScript;
}();
var doppio_security_BrowserPRNG = function () {
    function doppio_security_BrowserPRNG() {
    }
    doppio_security_BrowserPRNG['isAvailable()Z'] = function (thread) {
        var crypto = doppio_security_BrowserPRNG.crypto;
        return !!(crypto && crypto.getRandomValues);
    };
    doppio_security_BrowserPRNG['engineSetSeed([B)V'] = function (thread, javaThis, seed) {
        thread.throwNewException('Ljava/security/ProviderException;', 'engineSetSeed() failed.');
    };
    doppio_security_BrowserPRNG['engineNextBytes([B)V'] = function (thread, javaThis, bytes) {
        var crypto = doppio_security_BrowserPRNG.crypto;
        crypto.getRandomValues(bytes.array);
    };
    doppio_security_BrowserPRNG['engineGenerateSeed(I)[B'] = function (thread, javaThis, numBytes) {
        var crypto = doppio_security_BrowserPRNG.crypto;
        var bytes = util.newArrayFromClass(thread, thread.getBsCl().getInitializedClass(thread, '[B'), numBytes);
        crypto.getRandomValues(bytes.array);
        return bytes;
    };
    doppio_security_BrowserPRNG.crypto = typeof crypto !== 'undefined' ? crypto : typeof msCrypto !== 'undefined' ? msCrypto : null;
    return doppio_security_BrowserPRNG;
}();
var doppio_security_NodePRNG = function () {
    function doppio_security_NodePRNG() {
    }
    doppio_security_NodePRNG['isAvailable()Z'] = function (thread) {
        return !util.are_in_browser();
    };
    doppio_security_NodePRNG['engineSetSeed([B)V'] = function (thread, javaThis, seed) {
        thread.throwNewException('Ljava/security/ProviderException;', 'engineSetSeed() failed.');
    };
    doppio_security_NodePRNG['engineNextBytes([B)V'] = function (thread, javaThis, bytes) {
        var array = bytes.array;
        var len = array.length;
        var data = NodeCrypto.randomBytes(len);
        for (var i = 0; i < len; i++) {
            array[i] = data.readInt8(i);
        }
    };
    doppio_security_NodePRNG['engineGenerateSeed(I)[B'] = function (thread, javaThis, numBytes) {
        var data = NodeCrypto.randomBytes(numBytes);
        var array = util.buff2i8(data);
        return util.newArrayFromDataWithClass(thread, thread.getBsCl().getInitializedClass(thread, '[B'), array);
    };
    return doppio_security_NodePRNG;
}();
registerNatives({
    'doppio/Debug': doppio_Debug,
    'doppio/JavaScript': doppio_JavaScript,
    'doppio/security/BrowserPRNG': doppio_security_BrowserPRNG,
    'doppio/security/NodePRNG': doppio_security_NodePRNG
});
//# sourceMappingURL=doppio.js.map