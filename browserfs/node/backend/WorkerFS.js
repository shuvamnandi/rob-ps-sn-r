"use strict";
var __extends = (this && this.__extends) || function (d, b) {
    for (var p in b) if (b.hasOwnProperty(p)) d[p] = b[p];
    function __() { this.constructor = d; }
    d.prototype = b === null ? Object.create(b) : (__.prototype = b.prototype, new __());
};
var file_system = require('../core/file_system');
var api_error_1 = require('../core/api_error');
var file_flag = require('../core/file_flag');
var util_1 = require('../core/util');
var file = require('../core/file');
var node_fs_stats_1 = require('../core/node_fs_stats');
var preload_file = require('../generic/preload_file');
var global = require('../core/global');
var fs = require('../core/node_fs');
var SpecialArgType;
(function (SpecialArgType) {
    SpecialArgType[SpecialArgType["CB"] = 0] = "CB";
    SpecialArgType[SpecialArgType["FD"] = 1] = "FD";
    SpecialArgType[SpecialArgType["API_ERROR"] = 2] = "API_ERROR";
    SpecialArgType[SpecialArgType["STATS"] = 3] = "STATS";
    SpecialArgType[SpecialArgType["PROBE"] = 4] = "PROBE";
    SpecialArgType[SpecialArgType["FILEFLAG"] = 5] = "FILEFLAG";
    SpecialArgType[SpecialArgType["BUFFER"] = 6] = "BUFFER";
    SpecialArgType[SpecialArgType["ERROR"] = 7] = "ERROR";
})(SpecialArgType || (SpecialArgType = {}));
var CallbackArgumentConverter = (function () {
    function CallbackArgumentConverter() {
        this._callbacks = {};
        this._nextId = 0;
    }
    CallbackArgumentConverter.prototype.toRemoteArg = function (cb) {
        var id = this._nextId++;
        this._callbacks[id] = cb;
        return {
            type: SpecialArgType.CB,
            id: id
        };
    };
    CallbackArgumentConverter.prototype.toLocalArg = function (id) {
        var cb = this._callbacks[id];
        delete this._callbacks[id];
        return cb;
    };
    return CallbackArgumentConverter;
}());
var FileDescriptorArgumentConverter = (function () {
    function FileDescriptorArgumentConverter() {
        this._fileDescriptors = {};
        this._nextId = 0;
    }
    FileDescriptorArgumentConverter.prototype.toRemoteArg = function (fd, p, flag, cb) {
        var id = this._nextId++, data, stat, argsLeft = 2;
        this._fileDescriptors[id] = fd;
        fd.stat(function (err, stats) {
            if (err) {
                cb(err);
            }
            else {
                stat = bufferToTransferrableObject(stats.toBuffer());
                if (flag.isReadable()) {
                    fd.read(new Buffer(stats.size), 0, stats.size, 0, function (err, bytesRead, buff) {
                        if (err) {
                            cb(err);
                        }
                        else {
                            data = bufferToTransferrableObject(buff);
                            cb(null, {
                                type: SpecialArgType.FD,
                                id: id,
                                data: data,
                                stat: stat,
                                path: p,
                                flag: flag.getFlagString()
                            });
                        }
                    });
                }
                else {
                    cb(null, {
                        type: SpecialArgType.FD,
                        id: id,
                        data: new ArrayBuffer(0),
                        stat: stat,
                        path: p,
                        flag: flag.getFlagString()
                    });
                }
            }
        });
    };
    FileDescriptorArgumentConverter.prototype._applyFdChanges = function (remoteFd, cb) {
        var fd = this._fileDescriptors[remoteFd.id], data = transferrableObjectToBuffer(remoteFd.data), remoteStats = node_fs_stats_1["default"].fromBuffer(transferrableObjectToBuffer(remoteFd.stat));
        var flag = file_flag.FileFlag.getFileFlag(remoteFd.flag);
        if (flag.isWriteable()) {
            fd.write(data, 0, data.length, flag.isAppendable() ? fd.getPos() : 0, function (e) {
                function applyStatChanges() {
                    fd.stat(function (e, stats) {
                        if (e) {
                            cb(e);
                        }
                        else {
                            if (stats.mode !== remoteStats.mode) {
                                fd.chmod(remoteStats.mode, function (e) {
                                    cb(e, fd);
                                });
                            }
                            else {
                                cb(e, fd);
                            }
                        }
                    });
                }
                if (e) {
                    cb(e);
                }
                else {
                    if (!flag.isAppendable()) {
                        fd.truncate(data.length, function () {
                            applyStatChanges();
                        });
                    }
                    else {
                        applyStatChanges();
                    }
                }
            });
        }
        else {
            cb(null, fd);
        }
    };
    FileDescriptorArgumentConverter.prototype.applyFdAPIRequest = function (request, cb) {
        var _this = this;
        var fdArg = request.args[0];
        this._applyFdChanges(fdArg, function (err, fd) {
            if (err) {
                cb(err);
            }
            else {
                fd[request.method](function (e) {
                    if (request.method === 'close') {
                        delete _this._fileDescriptors[fdArg.id];
                    }
                    cb(e);
                });
            }
        });
    };
    return FileDescriptorArgumentConverter;
}());
function apiErrorLocal2Remote(e) {
    return {
        type: SpecialArgType.API_ERROR,
        errorData: bufferToTransferrableObject(e.writeToBuffer())
    };
}
function apiErrorRemote2Local(e) {
    return api_error_1.ApiError.fromBuffer(transferrableObjectToBuffer(e.errorData));
}
function errorLocal2Remote(e) {
    return {
        type: SpecialArgType.ERROR,
        name: e.name,
        message: e.message,
        stack: e.stack
    };
}
function errorRemote2Local(e) {
    var cnstr = global[e.name];
    if (typeof (cnstr) !== 'function') {
        cnstr = Error;
    }
    var err = new cnstr(e.message);
    err.stack = e.stack;
    return err;
}
function statsLocal2Remote(stats) {
    return {
        type: SpecialArgType.STATS,
        statsData: bufferToTransferrableObject(stats.toBuffer())
    };
}
function statsRemote2Local(stats) {
    return node_fs_stats_1["default"].fromBuffer(transferrableObjectToBuffer(stats.statsData));
}
function fileFlagLocal2Remote(flag) {
    return {
        type: SpecialArgType.FILEFLAG,
        flagStr: flag.getFlagString()
    };
}
function fileFlagRemote2Local(remoteFlag) {
    return file_flag.FileFlag.getFileFlag(remoteFlag.flagStr);
}
function bufferToTransferrableObject(buff) {
    return util_1.buffer2ArrayBuffer(buff);
}
function transferrableObjectToBuffer(buff) {
    return util_1.arrayBuffer2Buffer(buff);
}
function bufferLocal2Remote(buff) {
    return {
        type: SpecialArgType.BUFFER,
        data: bufferToTransferrableObject(buff)
    };
}
function bufferRemote2Local(buffArg) {
    return transferrableObjectToBuffer(buffArg.data);
}
function isAPIRequest(data) {
    return data != null && typeof data === 'object' && data.hasOwnProperty('browserfsMessage') && data['browserfsMessage'];
}
function isAPIResponse(data) {
    return data != null && typeof data === 'object' && data.hasOwnProperty('browserfsMessage') && data['browserfsMessage'];
}
var WorkerFile = (function (_super) {
    __extends(WorkerFile, _super);
    function WorkerFile(_fs, _path, _flag, _stat, remoteFdId, contents) {
        _super.call(this, _fs, _path, _flag, _stat, contents);
        this._remoteFdId = remoteFdId;
    }
    WorkerFile.prototype.getRemoteFdId = function () {
        return this._remoteFdId;
    };
    WorkerFile.prototype.toRemoteArg = function () {
        return {
            type: SpecialArgType.FD,
            id: this._remoteFdId,
            data: bufferToTransferrableObject(this.getBuffer()),
            stat: bufferToTransferrableObject(this.getStats().toBuffer()),
            path: this.getPath(),
            flag: this.getFlag().getFlagString()
        };
    };
    WorkerFile.prototype._syncClose = function (type, cb) {
        var _this = this;
        if (this.isDirty()) {
            this._fs.syncClose(type, this, function (e) {
                if (!e) {
                    _this.resetDirty();
                }
                cb(e);
            });
        }
        else {
            cb();
        }
    };
    WorkerFile.prototype.sync = function (cb) {
        this._syncClose('sync', cb);
    };
    WorkerFile.prototype.close = function (cb) {
        this._syncClose('close', cb);
    };
    return WorkerFile;
}(preload_file.PreloadFile));
var WorkerFS = (function (_super) {
    __extends(WorkerFS, _super);
    function WorkerFS(worker) {
        var _this = this;
        _super.call(this);
        this._callbackConverter = new CallbackArgumentConverter();
        this._isInitialized = false;
        this._isReadOnly = false;
        this._supportLinks = false;
        this._supportProps = false;
        this._outstandingRequests = {};
        this._worker = worker;
        this._worker.addEventListener('message', function (e) {
            var resp = e.data;
            if (isAPIResponse(resp)) {
                var i, args = resp.args, fixedArgs = new Array(args.length);
                for (i = 0; i < fixedArgs.length; i++) {
                    fixedArgs[i] = _this._argRemote2Local(args[i]);
                }
                _this._callbackConverter.toLocalArg(resp.cbId).apply(null, fixedArgs);
            }
        });
    }
    WorkerFS.isAvailable = function () {
        return typeof (importScripts) !== 'undefined' || typeof (Worker) !== 'undefined';
    };
    WorkerFS.prototype.getName = function () {
        return 'WorkerFS';
    };
    WorkerFS.prototype._argRemote2Local = function (arg) {
        if (arg == null) {
            return arg;
        }
        switch (typeof arg) {
            case 'object':
                if (arg['type'] != null && typeof arg['type'] === 'number') {
                    var specialArg = arg;
                    switch (specialArg.type) {
                        case SpecialArgType.API_ERROR:
                            return apiErrorRemote2Local(specialArg);
                        case SpecialArgType.FD:
                            var fdArg = specialArg;
                            return new WorkerFile(this, fdArg.path, file_flag.FileFlag.getFileFlag(fdArg.flag), node_fs_stats_1["default"].fromBuffer(transferrableObjectToBuffer(fdArg.stat)), fdArg.id, transferrableObjectToBuffer(fdArg.data));
                        case SpecialArgType.STATS:
                            return statsRemote2Local(specialArg);
                        case SpecialArgType.FILEFLAG:
                            return fileFlagRemote2Local(specialArg);
                        case SpecialArgType.BUFFER:
                            return bufferRemote2Local(specialArg);
                        case SpecialArgType.ERROR:
                            return errorRemote2Local(specialArg);
                        default:
                            return arg;
                    }
                }
                else {
                    return arg;
                }
            default:
                return arg;
        }
    };
    WorkerFS.prototype._argLocal2Remote = function (arg) {
        if (arg == null) {
            return arg;
        }
        switch (typeof arg) {
            case "object":
                if (arg instanceof node_fs_stats_1["default"]) {
                    return statsLocal2Remote(arg);
                }
                else if (arg instanceof api_error_1.ApiError) {
                    return apiErrorLocal2Remote(arg);
                }
                else if (arg instanceof WorkerFile) {
                    return arg.toRemoteArg();
                }
                else if (arg instanceof file_flag.FileFlag) {
                    return fileFlagLocal2Remote(arg);
                }
                else if (arg instanceof Buffer) {
                    return bufferLocal2Remote(arg);
                }
                else if (arg instanceof Error) {
                    return errorLocal2Remote(arg);
                }
                else {
                    return "Unknown argument";
                }
            case "function":
                return this._callbackConverter.toRemoteArg(arg);
            default:
                return arg;
        }
    };
    WorkerFS.prototype.initialize = function (cb) {
        var _this = this;
        if (!this._isInitialized) {
            var message = {
                browserfsMessage: true,
                method: 'probe',
                args: [this._argLocal2Remote(new Buffer(0)), this._callbackConverter.toRemoteArg(function (probeResponse) {
                        _this._isInitialized = true;
                        _this._isReadOnly = probeResponse.isReadOnly;
                        _this._supportLinks = probeResponse.supportsLinks;
                        _this._supportProps = probeResponse.supportsProps;
                        cb();
                    })]
            };
            this._worker.postMessage(message);
        }
        else {
            cb();
        }
    };
    WorkerFS.prototype.isReadOnly = function () { return this._isReadOnly; };
    WorkerFS.prototype.supportsSynch = function () { return false; };
    WorkerFS.prototype.supportsLinks = function () { return this._supportLinks; };
    WorkerFS.prototype.supportsProps = function () { return this._supportProps; };
    WorkerFS.prototype._rpc = function (methodName, args) {
        var message = {
            browserfsMessage: true,
            method: methodName,
            args: null
        }, fixedArgs = new Array(args.length), i;
        for (i = 0; i < args.length; i++) {
            fixedArgs[i] = this._argLocal2Remote(args[i]);
        }
        message.args = fixedArgs;
        this._worker.postMessage(message);
    };
    WorkerFS.prototype.rename = function (oldPath, newPath, cb) {
        this._rpc('rename', arguments);
    };
    WorkerFS.prototype.stat = function (p, isLstat, cb) {
        this._rpc('stat', arguments);
    };
    WorkerFS.prototype.open = function (p, flag, mode, cb) {
        this._rpc('open', arguments);
    };
    WorkerFS.prototype.unlink = function (p, cb) {
        this._rpc('unlink', arguments);
    };
    WorkerFS.prototype.rmdir = function (p, cb) {
        this._rpc('rmdir', arguments);
    };
    WorkerFS.prototype.mkdir = function (p, mode, cb) {
        this._rpc('mkdir', arguments);
    };
    WorkerFS.prototype.readdir = function (p, cb) {
        this._rpc('readdir', arguments);
    };
    WorkerFS.prototype.exists = function (p, cb) {
        this._rpc('exists', arguments);
    };
    WorkerFS.prototype.realpath = function (p, cache, cb) {
        this._rpc('realpath', arguments);
    };
    WorkerFS.prototype.truncate = function (p, len, cb) {
        this._rpc('truncate', arguments);
    };
    WorkerFS.prototype.readFile = function (fname, encoding, flag, cb) {
        this._rpc('readFile', arguments);
    };
    WorkerFS.prototype.writeFile = function (fname, data, encoding, flag, mode, cb) {
        this._rpc('writeFile', arguments);
    };
    WorkerFS.prototype.appendFile = function (fname, data, encoding, flag, mode, cb) {
        this._rpc('appendFile', arguments);
    };
    WorkerFS.prototype.chmod = function (p, isLchmod, mode, cb) {
        this._rpc('chmod', arguments);
    };
    WorkerFS.prototype.chown = function (p, isLchown, uid, gid, cb) {
        this._rpc('chown', arguments);
    };
    WorkerFS.prototype.utimes = function (p, atime, mtime, cb) {
        this._rpc('utimes', arguments);
    };
    WorkerFS.prototype.link = function (srcpath, dstpath, cb) {
        this._rpc('link', arguments);
    };
    WorkerFS.prototype.symlink = function (srcpath, dstpath, type, cb) {
        this._rpc('symlink', arguments);
    };
    WorkerFS.prototype.readlink = function (p, cb) {
        this._rpc('readlink', arguments);
    };
    WorkerFS.prototype.syncClose = function (method, fd, cb) {
        this._worker.postMessage({
            browserfsMessage: true,
            method: method,
            args: [fd.toRemoteArg(), this._callbackConverter.toRemoteArg(cb)]
        });
    };
    WorkerFS.attachRemoteListener = function (worker) {
        var fdConverter = new FileDescriptorArgumentConverter();
        function argLocal2Remote(arg, requestArgs, cb) {
            switch (typeof arg) {
                case 'object':
                    if (arg instanceof node_fs_stats_1["default"]) {
                        cb(null, statsLocal2Remote(arg));
                    }
                    else if (arg instanceof api_error_1.ApiError) {
                        cb(null, apiErrorLocal2Remote(arg));
                    }
                    else if (arg instanceof file.BaseFile) {
                        cb(null, fdConverter.toRemoteArg(arg, requestArgs[0], requestArgs[1], cb));
                    }
                    else if (arg instanceof file_flag.FileFlag) {
                        cb(null, fileFlagLocal2Remote(arg));
                    }
                    else if (arg instanceof Buffer) {
                        cb(null, bufferLocal2Remote(arg));
                    }
                    else if (arg instanceof Error) {
                        cb(null, errorLocal2Remote(arg));
                    }
                    else {
                        cb(null, arg);
                    }
                    break;
                default:
                    cb(null, arg);
                    break;
            }
        }
        function argRemote2Local(arg, fixedRequestArgs) {
            if (arg == null) {
                return arg;
            }
            switch (typeof arg) {
                case 'object':
                    if (typeof arg['type'] === 'number') {
                        var specialArg = arg;
                        switch (specialArg.type) {
                            case SpecialArgType.CB:
                                var cbId = arg.id;
                                return function () {
                                    var i, fixedArgs = new Array(arguments.length), message, countdown = arguments.length;
                                    function abortAndSendError(err) {
                                        if (countdown > 0) {
                                            countdown = -1;
                                            message = {
                                                browserfsMessage: true,
                                                cbId: cbId,
                                                args: [apiErrorLocal2Remote(err)]
                                            };
                                            worker.postMessage(message);
                                        }
                                    }
                                    for (i = 0; i < arguments.length; i++) {
                                        (function (i, arg) {
                                            argLocal2Remote(arg, fixedRequestArgs, function (err, fixedArg) {
                                                fixedArgs[i] = fixedArg;
                                                if (err) {
                                                    abortAndSendError(err);
                                                }
                                                else if (--countdown === 0) {
                                                    message = {
                                                        browserfsMessage: true,
                                                        cbId: cbId,
                                                        args: fixedArgs
                                                    };
                                                    worker.postMessage(message);
                                                }
                                            });
                                        })(i, arguments[i]);
                                    }
                                    if (arguments.length === 0) {
                                        message = {
                                            browserfsMessage: true,
                                            cbId: cbId,
                                            args: fixedArgs
                                        };
                                        worker.postMessage(message);
                                    }
                                };
                            case SpecialArgType.API_ERROR:
                                return apiErrorRemote2Local(specialArg);
                            case SpecialArgType.STATS:
                                return statsRemote2Local(specialArg);
                            case SpecialArgType.FILEFLAG:
                                return fileFlagRemote2Local(specialArg);
                            case SpecialArgType.BUFFER:
                                return bufferRemote2Local(specialArg);
                            case SpecialArgType.ERROR:
                                return errorRemote2Local(specialArg);
                            default:
                                return arg;
                        }
                    }
                    else {
                        return arg;
                    }
                default:
                    return arg;
            }
        }
        worker.addEventListener('message', function (e) {
            var request = e.data;
            if (isAPIRequest(request)) {
                var args = request.args, fixedArgs = new Array(args.length), i;
                switch (request.method) {
                    case 'close':
                    case 'sync':
                        (function () {
                            var remoteCb = args[1];
                            fdConverter.applyFdAPIRequest(request, function (err) {
                                var response = {
                                    browserfsMessage: true,
                                    cbId: remoteCb.id,
                                    args: err ? [apiErrorLocal2Remote(err)] : []
                                };
                                worker.postMessage(response);
                            });
                        })();
                        break;
                    case 'probe':
                        (function () {
                            var rootFs = fs.getRootFS(), remoteCb = args[1], probeResponse = {
                                type: SpecialArgType.PROBE,
                                isReadOnly: rootFs.isReadOnly(),
                                supportsLinks: rootFs.supportsLinks(),
                                supportsProps: rootFs.supportsProps()
                            }, response = {
                                browserfsMessage: true,
                                cbId: remoteCb.id,
                                args: [probeResponse]
                            };
                            worker.postMessage(response);
                        })();
                        break;
                    default:
                        for (i = 0; i < args.length; i++) {
                            fixedArgs[i] = argRemote2Local(args[i], fixedArgs);
                        }
                        var rootFS = fs.getRootFS();
                        rootFS[request.method].apply(rootFS, fixedArgs);
                        break;
                }
            }
        });
    };
    return WorkerFS;
}(file_system.BaseFileSystem));
exports.__esModule = true;
exports["default"] = WorkerFS;
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiV29ya2VyRlMuanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyIuLi8uLi8uLi9zcmMvYmFja2VuZC9Xb3JrZXJGUy50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiOzs7Ozs7QUFBQSxJQUFPLFdBQVcsV0FBVyxxQkFBcUIsQ0FBQyxDQUFDO0FBQ3BELDBCQUF1QixtQkFBbUIsQ0FBQyxDQUFBO0FBQzNDLElBQU8sU0FBUyxXQUFXLG1CQUFtQixDQUFDLENBQUM7QUFDaEQscUJBQXFELGNBQWMsQ0FBQyxDQUFBO0FBQ3BFLElBQU8sSUFBSSxXQUFXLGNBQWMsQ0FBQyxDQUFDO0FBQ3RDLDhCQUF5Qyx1QkFBdUIsQ0FBQyxDQUFBO0FBQ2pFLElBQU8sWUFBWSxXQUFXLHlCQUF5QixDQUFDLENBQUM7QUFDekQsSUFBTyxNQUFNLFdBQVcsZ0JBQWdCLENBQUMsQ0FBQztBQUMxQyxJQUFPLEVBQUUsV0FBVyxpQkFBaUIsQ0FBQyxDQUFDO0FBTXZDLElBQUssY0FpQko7QUFqQkQsV0FBSyxjQUFjO0lBRWpCLCtDQUFFLENBQUE7SUFFRiwrQ0FBRSxDQUFBO0lBRUYsNkRBQVMsQ0FBQTtJQUVULHFEQUFLLENBQUE7SUFFTCxxREFBSyxDQUFBO0lBRUwsMkRBQVEsQ0FBQTtJQUVSLHVEQUFNLENBQUE7SUFFTixxREFBSyxDQUFBO0FBQ1AsQ0FBQyxFQWpCSSxjQUFjLEtBQWQsY0FBYyxRQWlCbEI7QUFxQkQ7SUFBQTtRQUNVLGVBQVUsR0FBK0IsRUFBRSxDQUFDO1FBQzVDLFlBQU8sR0FBVyxDQUFDLENBQUM7SUFnQjlCLENBQUM7SUFkUSwrQ0FBVyxHQUFsQixVQUFtQixFQUFZO1FBQzdCLElBQUksRUFBRSxHQUFHLElBQUksQ0FBQyxPQUFPLEVBQUUsQ0FBQztRQUN4QixJQUFJLENBQUMsVUFBVSxDQUFDLEVBQUUsQ0FBQyxHQUFHLEVBQUUsQ0FBQztRQUN6QixNQUFNLENBQUM7WUFDTCxJQUFJLEVBQUUsY0FBYyxDQUFDLEVBQUU7WUFDdkIsRUFBRSxFQUFFLEVBQUU7U0FDUCxDQUFDO0lBQ0osQ0FBQztJQUVNLDhDQUFVLEdBQWpCLFVBQWtCLEVBQVU7UUFDMUIsSUFBSSxFQUFFLEdBQUcsSUFBSSxDQUFDLFVBQVUsQ0FBQyxFQUFFLENBQUMsQ0FBQztRQUM3QixPQUFPLElBQUksQ0FBQyxVQUFVLENBQUMsRUFBRSxDQUFDLENBQUM7UUFDM0IsTUFBTSxDQUFDLEVBQUUsQ0FBQztJQUNaLENBQUM7SUFDSCxnQ0FBQztBQUFELENBQUMsQUFsQkQsSUFrQkM7QUFlRDtJQUFBO1FBQ1UscUJBQWdCLEdBQWdDLEVBQUUsQ0FBQztRQUNuRCxZQUFPLEdBQVcsQ0FBQyxDQUFDO0lBK0c5QixDQUFDO0lBN0dRLHFEQUFXLEdBQWxCLFVBQW1CLEVBQWEsRUFBRSxDQUFTLEVBQUUsSUFBd0IsRUFBRSxFQUEwRDtRQUMvSCxJQUFJLEVBQUUsR0FBRyxJQUFJLENBQUMsT0FBTyxFQUFFLEVBQ3JCLElBQWlCLEVBQ2pCLElBQWlCLEVBQ2pCLFFBQVEsR0FBVyxDQUFDLENBQUM7UUFDdkIsSUFBSSxDQUFDLGdCQUFnQixDQUFDLEVBQUUsQ0FBQyxHQUFHLEVBQUUsQ0FBQztRQUcvQixFQUFFLENBQUMsSUFBSSxDQUFDLFVBQUMsR0FBRyxFQUFFLEtBQUs7WUFDakIsRUFBRSxDQUFDLENBQUMsR0FBRyxDQUFDLENBQUMsQ0FBQztnQkFDUixFQUFFLENBQUMsR0FBRyxDQUFDLENBQUM7WUFDVixDQUFDO1lBQUMsSUFBSSxDQUFDLENBQUM7Z0JBQ04sSUFBSSxHQUFHLDJCQUEyQixDQUFDLEtBQUssQ0FBQyxRQUFRLEVBQUUsQ0FBQyxDQUFDO2dCQUVyRCxFQUFFLENBQUMsQ0FBQyxJQUFJLENBQUMsVUFBVSxFQUFFLENBQUMsQ0FBQyxDQUFDO29CQUN0QixFQUFFLENBQUMsSUFBSSxDQUFDLElBQUksTUFBTSxDQUFDLEtBQUssQ0FBQyxJQUFJLENBQUMsRUFBRSxDQUFDLEVBQUUsS0FBSyxDQUFDLElBQUksRUFBRSxDQUFDLEVBQUUsVUFBQyxHQUFHLEVBQUUsU0FBUyxFQUFFLElBQUk7d0JBQ3JFLEVBQUUsQ0FBQyxDQUFDLEdBQUcsQ0FBQyxDQUFDLENBQUM7NEJBQ1IsRUFBRSxDQUFDLEdBQUcsQ0FBQyxDQUFDO3dCQUNWLENBQUM7d0JBQUMsSUFBSSxDQUFDLENBQUM7NEJBQ04sSUFBSSxHQUFHLDJCQUEyQixDQUFDLElBQUksQ0FBQyxDQUFDOzRCQUN6QyxFQUFFLENBQUMsSUFBSSxFQUFFO2dDQUNQLElBQUksRUFBRSxjQUFjLENBQUMsRUFBRTtnQ0FDdkIsRUFBRSxFQUFFLEVBQUU7Z0NBQ04sSUFBSSxFQUFFLElBQUk7Z0NBQ1YsSUFBSSxFQUFFLElBQUk7Z0NBQ1YsSUFBSSxFQUFFLENBQUM7Z0NBQ1AsSUFBSSxFQUFFLElBQUksQ0FBQyxhQUFhLEVBQUU7NkJBQzNCLENBQUMsQ0FBQzt3QkFDTCxDQUFDO29CQUNILENBQUMsQ0FBQyxDQUFDO2dCQUNMLENBQUM7Z0JBQUMsSUFBSSxDQUFDLENBQUM7b0JBR04sRUFBRSxDQUFDLElBQUksRUFBRTt3QkFDUCxJQUFJLEVBQUUsY0FBYyxDQUFDLEVBQUU7d0JBQ3ZCLEVBQUUsRUFBRSxFQUFFO3dCQUNOLElBQUksRUFBRSxJQUFJLFdBQVcsQ0FBQyxDQUFDLENBQUM7d0JBQ3hCLElBQUksRUFBRSxJQUFJO3dCQUNWLElBQUksRUFBRSxDQUFDO3dCQUNQLElBQUksRUFBRSxJQUFJLENBQUMsYUFBYSxFQUFFO3FCQUMzQixDQUFDLENBQUM7Z0JBQ0wsQ0FBQztZQUNILENBQUM7UUFDSCxDQUFDLENBQUMsQ0FBQztJQUNMLENBQUM7SUFFTyx5REFBZSxHQUF2QixVQUF3QixRQUFpQyxFQUFFLEVBQTJDO1FBQ3BHLElBQUksRUFBRSxHQUFHLElBQUksQ0FBQyxnQkFBZ0IsQ0FBQyxRQUFRLENBQUMsRUFBRSxDQUFDLEVBQ3pDLElBQUksR0FBRywyQkFBMkIsQ0FBQyxRQUFRLENBQUMsSUFBSSxDQUFDLEVBQ2pELFdBQVcsR0FBRywwQkFBSyxDQUFDLFVBQVUsQ0FBQywyQkFBMkIsQ0FBQyxRQUFRLENBQUMsSUFBSSxDQUFDLENBQUMsQ0FBQztRQUc3RSxJQUFJLElBQUksR0FBRyxTQUFTLENBQUMsUUFBUSxDQUFDLFdBQVcsQ0FBQyxRQUFRLENBQUMsSUFBSSxDQUFDLENBQUM7UUFDekQsRUFBRSxDQUFDLENBQUMsSUFBSSxDQUFDLFdBQVcsRUFBRSxDQUFDLENBQUMsQ0FBQztZQUd2QixFQUFFLENBQUMsS0FBSyxDQUFDLElBQUksRUFBRSxDQUFDLEVBQUUsSUFBSSxDQUFDLE1BQU0sRUFBRSxJQUFJLENBQUMsWUFBWSxFQUFFLEdBQUcsRUFBRSxDQUFDLE1BQU0sRUFBRSxHQUFHLENBQUMsRUFBRSxVQUFDLENBQUM7Z0JBQ3RFO29CQUVFLEVBQUUsQ0FBQyxJQUFJLENBQUMsVUFBQyxDQUFDLEVBQUUsS0FBTTt3QkFDaEIsRUFBRSxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQzs0QkFDTixFQUFFLENBQUMsQ0FBQyxDQUFDLENBQUM7d0JBQ1IsQ0FBQzt3QkFBQyxJQUFJLENBQUMsQ0FBQzs0QkFDTixFQUFFLENBQUMsQ0FBQyxLQUFLLENBQUMsSUFBSSxLQUFLLFdBQVcsQ0FBQyxJQUFJLENBQUMsQ0FBQyxDQUFDO2dDQUNwQyxFQUFFLENBQUMsS0FBSyxDQUFDLFdBQVcsQ0FBQyxJQUFJLEVBQUUsVUFBQyxDQUFNO29DQUNoQyxFQUFFLENBQUMsQ0FBQyxFQUFFLEVBQUUsQ0FBQyxDQUFDO2dDQUNaLENBQUMsQ0FBQyxDQUFDOzRCQUNMLENBQUM7NEJBQUMsSUFBSSxDQUFDLENBQUM7Z0NBQ04sRUFBRSxDQUFDLENBQUMsRUFBRSxFQUFFLENBQUMsQ0FBQzs0QkFDWixDQUFDO3dCQUNILENBQUM7b0JBQ0gsQ0FBQyxDQUFDLENBQUM7Z0JBQ0wsQ0FBQztnQkFDRCxFQUFFLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDO29CQUNOLEVBQUUsQ0FBQyxDQUFDLENBQUMsQ0FBQztnQkFDUixDQUFDO2dCQUFDLElBQUksQ0FBQyxDQUFDO29CQUlOLEVBQUUsQ0FBQyxDQUFDLENBQUMsSUFBSSxDQUFDLFlBQVksRUFBRSxDQUFDLENBQUMsQ0FBQzt3QkFDekIsRUFBRSxDQUFDLFFBQVEsQ0FBQyxJQUFJLENBQUMsTUFBTSxFQUFFOzRCQUN2QixnQkFBZ0IsRUFBRSxDQUFDO3dCQUNyQixDQUFDLENBQUMsQ0FBQTtvQkFDSixDQUFDO29CQUFDLElBQUksQ0FBQyxDQUFDO3dCQUNOLGdCQUFnQixFQUFFLENBQUM7b0JBQ3JCLENBQUM7Z0JBQ0gsQ0FBQztZQUNILENBQUMsQ0FBQyxDQUFDO1FBQ0wsQ0FBQztRQUFDLElBQUksQ0FBQyxDQUFDO1lBQ04sRUFBRSxDQUFDLElBQUksRUFBRSxFQUFFLENBQUMsQ0FBQztRQUNmLENBQUM7SUFDSCxDQUFDO0lBRU0sMkRBQWlCLEdBQXhCLFVBQXlCLE9BQW9CLEVBQUUsRUFBNEI7UUFBM0UsaUJBZUM7UUFkQyxJQUFJLEtBQUssR0FBNkIsT0FBTyxDQUFDLElBQUksQ0FBQyxDQUFDLENBQUMsQ0FBQztRQUN0RCxJQUFJLENBQUMsZUFBZSxDQUFDLEtBQUssRUFBRSxVQUFDLEdBQUcsRUFBRSxFQUFHO1lBQ25DLEVBQUUsQ0FBQyxDQUFDLEdBQUcsQ0FBQyxDQUFDLENBQUM7Z0JBQ1IsRUFBRSxDQUFDLEdBQUcsQ0FBQyxDQUFDO1lBQ1YsQ0FBQztZQUFDLElBQUksQ0FBQyxDQUFDO2dCQUVDLEVBQUcsQ0FBQyxPQUFPLENBQUMsTUFBTSxDQUFDLENBQUMsVUFBQyxDQUFZO29CQUN0QyxFQUFFLENBQUMsQ0FBQyxPQUFPLENBQUMsTUFBTSxLQUFLLE9BQU8sQ0FBQyxDQUFDLENBQUM7d0JBQy9CLE9BQU8sS0FBSSxDQUFDLGdCQUFnQixDQUFDLEtBQUssQ0FBQyxFQUFFLENBQUMsQ0FBQztvQkFDekMsQ0FBQztvQkFDRCxFQUFFLENBQUMsQ0FBQyxDQUFDLENBQUM7Z0JBQ1IsQ0FBQyxDQUFDLENBQUM7WUFDTCxDQUFDO1FBQ0gsQ0FBQyxDQUFDLENBQUM7SUFDTCxDQUFDO0lBQ0gsc0NBQUM7QUFBRCxDQUFDLEFBakhELElBaUhDO0FBT0QsOEJBQThCLENBQVc7SUFDdkMsTUFBTSxDQUFDO1FBQ0wsSUFBSSxFQUFFLGNBQWMsQ0FBQyxTQUFTO1FBQzlCLFNBQVMsRUFBRSwyQkFBMkIsQ0FBQyxDQUFDLENBQUMsYUFBYSxFQUFFLENBQUM7S0FDMUQsQ0FBQztBQUNKLENBQUM7QUFFRCw4QkFBOEIsQ0FBb0I7SUFDaEQsTUFBTSxDQUFDLG9CQUFRLENBQUMsVUFBVSxDQUFDLDJCQUEyQixDQUFDLENBQUMsQ0FBQyxTQUFTLENBQUMsQ0FBQyxDQUFDO0FBQ3ZFLENBQUM7QUFXRCwyQkFBMkIsQ0FBUTtJQUNqQyxNQUFNLENBQUM7UUFDTCxJQUFJLEVBQUUsY0FBYyxDQUFDLEtBQUs7UUFDMUIsSUFBSSxFQUFFLENBQUMsQ0FBQyxJQUFJO1FBQ1osT0FBTyxFQUFFLENBQUMsQ0FBQyxPQUFPO1FBQ2xCLEtBQUssRUFBRSxDQUFDLENBQUMsS0FBSztLQUNmLENBQUM7QUFDSixDQUFDO0FBRUQsMkJBQTJCLENBQWlCO0lBQzFDLElBQUksS0FBSyxHQUVMLE1BQU0sQ0FBQyxDQUFDLENBQUMsSUFBSSxDQUFDLENBQUM7SUFDbkIsRUFBRSxDQUFDLENBQUMsT0FBTSxDQUFDLEtBQUssQ0FBQyxLQUFLLFVBQVUsQ0FBQyxDQUFDLENBQUM7UUFDakMsS0FBSyxHQUFHLEtBQUssQ0FBQztJQUNoQixDQUFDO0lBQ0QsSUFBSSxHQUFHLEdBQUcsSUFBSSxLQUFLLENBQUMsQ0FBQyxDQUFDLE9BQU8sQ0FBQyxDQUFDO0lBQy9CLEdBQUcsQ0FBQyxLQUFLLEdBQUcsQ0FBQyxDQUFDLEtBQUssQ0FBQztJQUNwQixNQUFNLENBQUMsR0FBRyxDQUFDO0FBQ2IsQ0FBQztBQU9ELDJCQUEyQixLQUFZO0lBQ3JDLE1BQU0sQ0FBQztRQUNMLElBQUksRUFBRSxjQUFjLENBQUMsS0FBSztRQUMxQixTQUFTLEVBQUUsMkJBQTJCLENBQUMsS0FBSyxDQUFDLFFBQVEsRUFBRSxDQUFDO0tBQ3pELENBQUM7QUFDSixDQUFDO0FBRUQsMkJBQTJCLEtBQXFCO0lBQzlDLE1BQU0sQ0FBQywwQkFBSyxDQUFDLFVBQVUsQ0FBQywyQkFBMkIsQ0FBQyxLQUFLLENBQUMsU0FBUyxDQUFDLENBQUMsQ0FBQztBQUN4RSxDQUFDO0FBTUQsOEJBQThCLElBQXdCO0lBQ3BELE1BQU0sQ0FBQztRQUNMLElBQUksRUFBRSxjQUFjLENBQUMsUUFBUTtRQUM3QixPQUFPLEVBQUUsSUFBSSxDQUFDLGFBQWEsRUFBRTtLQUM5QixDQUFDO0FBQ0osQ0FBQztBQUVELDhCQUE4QixVQUE2QjtJQUN6RCxNQUFNLENBQUMsU0FBUyxDQUFDLFFBQVEsQ0FBQyxXQUFXLENBQUMsVUFBVSxDQUFDLE9BQU8sQ0FBQyxDQUFDO0FBQzVELENBQUM7QUFNRCxxQ0FBcUMsSUFBZ0I7SUFDbkQsTUFBTSxDQUFDLHlCQUFrQixDQUFDLElBQUksQ0FBQyxDQUFDO0FBQ2xDLENBQUM7QUFFRCxxQ0FBcUMsSUFBaUI7SUFDcEQsTUFBTSxDQUFDLHlCQUFrQixDQUFDLElBQUksQ0FBQyxDQUFDO0FBQ2xDLENBQUM7QUFFRCw0QkFBNEIsSUFBWTtJQUN0QyxNQUFNLENBQUM7UUFDTCxJQUFJLEVBQUUsY0FBYyxDQUFDLE1BQU07UUFDM0IsSUFBSSxFQUFFLDJCQUEyQixDQUFDLElBQUksQ0FBQztLQUN4QyxDQUFDO0FBQ0osQ0FBQztBQUVELDRCQUE0QixPQUF3QjtJQUNsRCxNQUFNLENBQUMsMkJBQTJCLENBQUMsT0FBTyxDQUFDLElBQUksQ0FBQyxDQUFDO0FBQ25ELENBQUM7QUFPRCxzQkFBc0IsSUFBUztJQUM3QixNQUFNLENBQUMsSUFBSSxJQUFJLElBQUksSUFBSSxPQUFPLElBQUksS0FBSyxRQUFRLElBQUksSUFBSSxDQUFDLGNBQWMsQ0FBQyxrQkFBa0IsQ0FBQyxJQUFJLElBQUksQ0FBQyxrQkFBa0IsQ0FBQyxDQUFDO0FBQ3pILENBQUM7QUFPRCx1QkFBdUIsSUFBUztJQUM5QixNQUFNLENBQUMsSUFBSSxJQUFJLElBQUksSUFBSSxPQUFPLElBQUksS0FBSyxRQUFRLElBQUksSUFBSSxDQUFDLGNBQWMsQ0FBQyxrQkFBa0IsQ0FBQyxJQUFJLElBQUksQ0FBQyxrQkFBa0IsQ0FBQyxDQUFDO0FBQ3pILENBQUM7QUFLRDtJQUF5Qiw4QkFBa0M7SUFHekQsb0JBQVksR0FBYSxFQUFFLEtBQWEsRUFBRSxLQUF5QixFQUFFLEtBQVksRUFBRSxVQUFrQixFQUFFLFFBQXFCO1FBQzFILGtCQUFNLEdBQUcsRUFBRSxLQUFLLEVBQUUsS0FBSyxFQUFFLEtBQUssRUFBRSxRQUFRLENBQUMsQ0FBQztRQUMxQyxJQUFJLENBQUMsV0FBVyxHQUFHLFVBQVUsQ0FBQztJQUNoQyxDQUFDO0lBRU0sa0NBQWEsR0FBcEI7UUFDRSxNQUFNLENBQUMsSUFBSSxDQUFDLFdBQVcsQ0FBQztJQUMxQixDQUFDO0lBRU0sZ0NBQVcsR0FBbEI7UUFDRSxNQUFNLENBQTJCO1lBQy9CLElBQUksRUFBRSxjQUFjLENBQUMsRUFBRTtZQUN2QixFQUFFLEVBQUUsSUFBSSxDQUFDLFdBQVc7WUFDcEIsSUFBSSxFQUFFLDJCQUEyQixDQUFDLElBQUksQ0FBQyxTQUFTLEVBQUUsQ0FBQztZQUNuRCxJQUFJLEVBQUUsMkJBQTJCLENBQUMsSUFBSSxDQUFDLFFBQVEsRUFBRSxDQUFDLFFBQVEsRUFBRSxDQUFDO1lBQzdELElBQUksRUFBRSxJQUFJLENBQUMsT0FBTyxFQUFFO1lBQ3BCLElBQUksRUFBRSxJQUFJLENBQUMsT0FBTyxFQUFFLENBQUMsYUFBYSxFQUFFO1NBQ3JDLENBQUM7SUFDSixDQUFDO0lBRU8sK0JBQVUsR0FBbEIsVUFBbUIsSUFBWSxFQUFFLEVBQTBCO1FBQTNELGlCQVdDO1FBVkMsRUFBRSxDQUFDLENBQUMsSUFBSSxDQUFDLE9BQU8sRUFBRSxDQUFDLENBQUMsQ0FBQztZQUNQLElBQUksQ0FBQyxHQUFJLENBQUMsU0FBUyxDQUFDLElBQUksRUFBRSxJQUFJLEVBQUUsVUFBQyxDQUFZO2dCQUN2RCxFQUFFLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUM7b0JBQ1AsS0FBSSxDQUFDLFVBQVUsRUFBRSxDQUFDO2dCQUNwQixDQUFDO2dCQUNELEVBQUUsQ0FBQyxDQUFDLENBQUMsQ0FBQztZQUNSLENBQUMsQ0FBQyxDQUFDO1FBQ0wsQ0FBQztRQUFDLElBQUksQ0FBQyxDQUFDO1lBQ04sRUFBRSxFQUFFLENBQUM7UUFDUCxDQUFDO0lBQ0gsQ0FBQztJQUVNLHlCQUFJLEdBQVgsVUFBWSxFQUEwQjtRQUNwQyxJQUFJLENBQUMsVUFBVSxDQUFDLE1BQU0sRUFBRSxFQUFFLENBQUMsQ0FBQztJQUM5QixDQUFDO0lBRU0sMEJBQUssR0FBWixVQUFhLEVBQTBCO1FBQ3JDLElBQUksQ0FBQyxVQUFVLENBQUMsT0FBTyxFQUFFLEVBQUUsQ0FBQyxDQUFDO0lBQy9CLENBQUM7SUFDSCxpQkFBQztBQUFELENBQUMsQUEzQ0QsQ0FBeUIsWUFBWSxDQUFDLFdBQVcsR0EyQ2hEO0FBeUJEO0lBQXNDLDRCQUEwQjtJQWtCOUQsa0JBQVksTUFBYztRQWxCNUIsaUJBMlhDO1FBeFdHLGlCQUFPLENBQUM7UUFqQkYsdUJBQWtCLEdBQUcsSUFBSSx5QkFBeUIsRUFBRSxDQUFDO1FBRXJELG1CQUFjLEdBQVksS0FBSyxDQUFDO1FBQ2hDLGdCQUFXLEdBQVksS0FBSyxDQUFDO1FBQzdCLGtCQUFhLEdBQVksS0FBSyxDQUFDO1FBQy9CLGtCQUFhLEdBQVksS0FBSyxDQUFDO1FBSy9CLHlCQUFvQixHQUFpQyxFQUFFLENBQUM7UUFROUQsSUFBSSxDQUFDLE9BQU8sR0FBRyxNQUFNLENBQUM7UUFDdEIsSUFBSSxDQUFDLE9BQU8sQ0FBQyxnQkFBZ0IsQ0FBQyxTQUFTLEVBQUMsVUFBQyxDQUFlO1lBQ3RELElBQUksSUFBSSxHQUFXLENBQUMsQ0FBQyxJQUFJLENBQUM7WUFDMUIsRUFBRSxDQUFDLENBQUMsYUFBYSxDQUFDLElBQUksQ0FBQyxDQUFDLENBQUMsQ0FBQztnQkFDeEIsSUFBSSxDQUFTLEVBQUUsSUFBSSxHQUFHLElBQUksQ0FBQyxJQUFJLEVBQUUsU0FBUyxHQUFHLElBQUksS0FBSyxDQUFDLElBQUksQ0FBQyxNQUFNLENBQUMsQ0FBQztnQkFFcEUsR0FBRyxDQUFDLENBQUMsQ0FBQyxHQUFHLENBQUMsRUFBRSxDQUFDLEdBQUcsU0FBUyxDQUFDLE1BQU0sRUFBRSxDQUFDLEVBQUUsRUFBRSxDQUFDO29CQUN0QyxTQUFTLENBQUMsQ0FBQyxDQUFDLEdBQUcsS0FBSSxDQUFDLGdCQUFnQixDQUFDLElBQUksQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDO2dCQUNoRCxDQUFDO2dCQUNELEtBQUksQ0FBQyxrQkFBa0IsQ0FBQyxVQUFVLENBQUMsSUFBSSxDQUFDLElBQUksQ0FBQyxDQUFDLEtBQUssQ0FBQyxJQUFJLEVBQUUsU0FBUyxDQUFDLENBQUM7WUFDdkUsQ0FBQztRQUNILENBQUMsQ0FBQyxDQUFDO0lBQ0wsQ0FBQztJQUVhLG9CQUFXLEdBQXpCO1FBQ0UsTUFBTSxDQUFDLE9BQU0sQ0FBQyxhQUFhLENBQUMsS0FBSyxXQUFXLElBQUksT0FBTSxDQUFDLE1BQU0sQ0FBQyxLQUFLLFdBQVcsQ0FBQztJQUNqRixDQUFDO0lBRU0sMEJBQU8sR0FBZDtRQUNFLE1BQU0sQ0FBQyxVQUFVLENBQUM7SUFDcEIsQ0FBQztJQUVPLG1DQUFnQixHQUF4QixVQUF5QixHQUFRO1FBQy9CLEVBQUUsQ0FBQyxDQUFDLEdBQUcsSUFBSSxJQUFJLENBQUMsQ0FBQyxDQUFDO1lBQ2hCLE1BQU0sQ0FBQyxHQUFHLENBQUM7UUFDYixDQUFDO1FBQ0QsTUFBTSxDQUFDLENBQUMsT0FBTyxHQUFHLENBQUMsQ0FBQyxDQUFDO1lBQ25CLEtBQUssUUFBUTtnQkFDWCxFQUFFLENBQUMsQ0FBQyxHQUFHLENBQUMsTUFBTSxDQUFDLElBQUksSUFBSSxJQUFJLE9BQU8sR0FBRyxDQUFDLE1BQU0sQ0FBQyxLQUFLLFFBQVEsQ0FBQyxDQUFDLENBQUM7b0JBQzNELElBQUksVUFBVSxHQUFzQixHQUFHLENBQUM7b0JBQ3hDLE1BQU0sQ0FBQyxDQUFDLFVBQVUsQ0FBQyxJQUFJLENBQUMsQ0FBQyxDQUFDO3dCQUN4QixLQUFLLGNBQWMsQ0FBQyxTQUFTOzRCQUMzQixNQUFNLENBQUMsb0JBQW9CLENBQXFCLFVBQVUsQ0FBQyxDQUFDO3dCQUM5RCxLQUFLLGNBQWMsQ0FBQyxFQUFFOzRCQUNwQixJQUFJLEtBQUssR0FBNkIsVUFBVSxDQUFDOzRCQUNqRCxNQUFNLENBQUMsSUFBSSxVQUFVLENBQUMsSUFBSSxFQUFFLEtBQUssQ0FBQyxJQUFJLEVBQUUsU0FBUyxDQUFDLFFBQVEsQ0FBQyxXQUFXLENBQUMsS0FBSyxDQUFDLElBQUksQ0FBQyxFQUFFLDBCQUFLLENBQUMsVUFBVSxDQUFDLDJCQUEyQixDQUFDLEtBQUssQ0FBQyxJQUFJLENBQUMsQ0FBQyxFQUFFLEtBQUssQ0FBQyxFQUFFLEVBQUUsMkJBQTJCLENBQUMsS0FBSyxDQUFDLElBQUksQ0FBQyxDQUFDLENBQUM7d0JBQ3BNLEtBQUssY0FBYyxDQUFDLEtBQUs7NEJBQ3ZCLE1BQU0sQ0FBQyxpQkFBaUIsQ0FBa0IsVUFBVSxDQUFDLENBQUM7d0JBQ3hELEtBQUssY0FBYyxDQUFDLFFBQVE7NEJBQzFCLE1BQU0sQ0FBQyxvQkFBb0IsQ0FBcUIsVUFBVSxDQUFDLENBQUM7d0JBQzlELEtBQUssY0FBYyxDQUFDLE1BQU07NEJBQ3hCLE1BQU0sQ0FBQyxrQkFBa0IsQ0FBbUIsVUFBVSxDQUFDLENBQUM7d0JBQzFELEtBQUssY0FBYyxDQUFDLEtBQUs7NEJBQ3ZCLE1BQU0sQ0FBQyxpQkFBaUIsQ0FBa0IsVUFBVSxDQUFDLENBQUM7d0JBQ3hEOzRCQUNFLE1BQU0sQ0FBQyxHQUFHLENBQUM7b0JBQ2YsQ0FBQztnQkFDSCxDQUFDO2dCQUFDLElBQUksQ0FBQyxDQUFDO29CQUNOLE1BQU0sQ0FBQyxHQUFHLENBQUM7Z0JBQ2IsQ0FBQztZQUNIO2dCQUNFLE1BQU0sQ0FBQyxHQUFHLENBQUM7UUFDZixDQUFDO0lBQ0gsQ0FBQztJQUtNLG1DQUFnQixHQUF2QixVQUF3QixHQUFRO1FBQzlCLEVBQUUsQ0FBQyxDQUFDLEdBQUcsSUFBSSxJQUFJLENBQUMsQ0FBQyxDQUFDO1lBQ2hCLE1BQU0sQ0FBQyxHQUFHLENBQUM7UUFDYixDQUFDO1FBQ0QsTUFBTSxDQUFDLENBQUMsT0FBTyxHQUFHLENBQUMsQ0FBQyxDQUFDO1lBQ25CLEtBQUssUUFBUTtnQkFDWCxFQUFFLENBQUMsQ0FBQyxHQUFHLFlBQVksMEJBQUssQ0FBQyxDQUFDLENBQUM7b0JBQ3pCLE1BQU0sQ0FBQyxpQkFBaUIsQ0FBQyxHQUFHLENBQUMsQ0FBQztnQkFDaEMsQ0FBQztnQkFBQyxJQUFJLENBQUMsRUFBRSxDQUFDLENBQUMsR0FBRyxZQUFZLG9CQUFRLENBQUMsQ0FBQyxDQUFDO29CQUNuQyxNQUFNLENBQUMsb0JBQW9CLENBQUMsR0FBRyxDQUFDLENBQUM7Z0JBQ25DLENBQUM7Z0JBQUMsSUFBSSxDQUFDLEVBQUUsQ0FBQyxDQUFDLEdBQUcsWUFBWSxVQUFVLENBQUMsQ0FBQyxDQUFDO29CQUNyQyxNQUFNLENBQWUsR0FBSSxDQUFDLFdBQVcsRUFBRSxDQUFDO2dCQUMxQyxDQUFDO2dCQUFDLElBQUksQ0FBQyxFQUFFLENBQUMsQ0FBQyxHQUFHLFlBQVksU0FBUyxDQUFDLFFBQVEsQ0FBQyxDQUFDLENBQUM7b0JBQzdDLE1BQU0sQ0FBQyxvQkFBb0IsQ0FBQyxHQUFHLENBQUMsQ0FBQztnQkFDbkMsQ0FBQztnQkFBQyxJQUFJLENBQUMsRUFBRSxDQUFDLENBQUMsR0FBRyxZQUFZLE1BQU0sQ0FBQyxDQUFDLENBQUM7b0JBQ2pDLE1BQU0sQ0FBQyxrQkFBa0IsQ0FBQyxHQUFHLENBQUMsQ0FBQztnQkFDakMsQ0FBQztnQkFBQyxJQUFJLENBQUMsRUFBRSxDQUFDLENBQUMsR0FBRyxZQUFZLEtBQUssQ0FBQyxDQUFDLENBQUM7b0JBQ2hDLE1BQU0sQ0FBQyxpQkFBaUIsQ0FBQyxHQUFHLENBQUMsQ0FBQztnQkFDaEMsQ0FBQztnQkFBQyxJQUFJLENBQUMsQ0FBQztvQkFDTixNQUFNLENBQUMsa0JBQWtCLENBQUM7Z0JBQzVCLENBQUM7WUFDSCxLQUFLLFVBQVU7Z0JBQ2IsTUFBTSxDQUFDLElBQUksQ0FBQyxrQkFBa0IsQ0FBQyxXQUFXLENBQUMsR0FBRyxDQUFDLENBQUM7WUFDbEQ7Z0JBQ0UsTUFBTSxDQUFDLEdBQUcsQ0FBQztRQUNmLENBQUM7SUFDSCxDQUFDO0lBS00sNkJBQVUsR0FBakIsVUFBa0IsRUFBYztRQUFoQyxpQkFpQkM7UUFoQkMsRUFBRSxDQUFDLENBQUMsQ0FBQyxJQUFJLENBQUMsY0FBYyxDQUFDLENBQUMsQ0FBQztZQUN6QixJQUFJLE9BQU8sR0FBZ0I7Z0JBQ3pCLGdCQUFnQixFQUFFLElBQUk7Z0JBQ3RCLE1BQU0sRUFBRSxPQUFPO2dCQUNmLElBQUksRUFBRSxDQUFDLElBQUksQ0FBQyxnQkFBZ0IsQ0FBQyxJQUFJLE1BQU0sQ0FBQyxDQUFDLENBQUMsQ0FBQyxFQUFFLElBQUksQ0FBQyxrQkFBa0IsQ0FBQyxXQUFXLENBQUMsVUFBQyxhQUE2Qjt3QkFDN0csS0FBSSxDQUFDLGNBQWMsR0FBRyxJQUFJLENBQUM7d0JBQzNCLEtBQUksQ0FBQyxXQUFXLEdBQUcsYUFBYSxDQUFDLFVBQVUsQ0FBQzt3QkFDNUMsS0FBSSxDQUFDLGFBQWEsR0FBRyxhQUFhLENBQUMsYUFBYSxDQUFDO3dCQUNqRCxLQUFJLENBQUMsYUFBYSxHQUFHLGFBQWEsQ0FBQyxhQUFhLENBQUM7d0JBQ2pELEVBQUUsRUFBRSxDQUFDO29CQUNQLENBQUMsQ0FBQyxDQUFDO2FBQ0osQ0FBQztZQUNGLElBQUksQ0FBQyxPQUFPLENBQUMsV0FBVyxDQUFDLE9BQU8sQ0FBQyxDQUFDO1FBQ3BDLENBQUM7UUFBQyxJQUFJLENBQUMsQ0FBQztZQUNOLEVBQUUsRUFBRSxDQUFDO1FBQ1AsQ0FBQztJQUNILENBQUM7SUFFTSw2QkFBVSxHQUFqQixjQUErQixNQUFNLENBQUMsSUFBSSxDQUFDLFdBQVcsQ0FBQyxDQUFDLENBQUM7SUFDbEQsZ0NBQWEsR0FBcEIsY0FBa0MsTUFBTSxDQUFDLEtBQUssQ0FBQyxDQUFDLENBQUM7SUFDMUMsZ0NBQWEsR0FBcEIsY0FBa0MsTUFBTSxDQUFDLElBQUksQ0FBQyxhQUFhLENBQUMsQ0FBQyxDQUFDO0lBQ3ZELGdDQUFhLEdBQXBCLGNBQWtDLE1BQU0sQ0FBQyxJQUFJLENBQUMsYUFBYSxDQUFDLENBQUMsQ0FBQztJQUV0RCx1QkFBSSxHQUFaLFVBQWEsVUFBa0IsRUFBRSxJQUFnQjtRQUMvQyxJQUFJLE9BQU8sR0FBZ0I7WUFDekIsZ0JBQWdCLEVBQUUsSUFBSTtZQUN0QixNQUFNLEVBQUUsVUFBVTtZQUNsQixJQUFJLEVBQUUsSUFBSTtTQUNYLEVBQUUsU0FBUyxHQUFHLElBQUksS0FBSyxDQUFDLElBQUksQ0FBQyxNQUFNLENBQUMsRUFBRSxDQUFTLENBQUM7UUFDakQsR0FBRyxDQUFDLENBQUMsQ0FBQyxHQUFHLENBQUMsRUFBRSxDQUFDLEdBQUcsSUFBSSxDQUFDLE1BQU0sRUFBRSxDQUFDLEVBQUUsRUFBRSxDQUFDO1lBQ2pDLFNBQVMsQ0FBQyxDQUFDLENBQUMsR0FBRyxJQUFJLENBQUMsZ0JBQWdCLENBQUMsSUFBSSxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUM7UUFDaEQsQ0FBQztRQUNELE9BQU8sQ0FBQyxJQUFJLEdBQUcsU0FBUyxDQUFDO1FBQ3pCLElBQUksQ0FBQyxPQUFPLENBQUMsV0FBVyxDQUFDLE9BQU8sQ0FBQyxDQUFDO0lBQ3BDLENBQUM7SUFFTSx5QkFBTSxHQUFiLFVBQWMsT0FBZSxFQUFFLE9BQWUsRUFBRSxFQUE0QjtRQUMxRSxJQUFJLENBQUMsSUFBSSxDQUFDLFFBQVEsRUFBRSxTQUFTLENBQUMsQ0FBQztJQUNqQyxDQUFDO0lBQ00sdUJBQUksR0FBWCxVQUFZLENBQVMsRUFBRSxPQUFnQixFQUFFLEVBQXlDO1FBQ2hGLElBQUksQ0FBQyxJQUFJLENBQUMsTUFBTSxFQUFFLFNBQVMsQ0FBQyxDQUFDO0lBQy9CLENBQUM7SUFDTSx1QkFBSSxHQUFYLFVBQVksQ0FBUyxFQUFFLElBQXdCLEVBQUUsSUFBWSxFQUFFLEVBQTBDO1FBQ3ZHLElBQUksQ0FBQyxJQUFJLENBQUMsTUFBTSxFQUFFLFNBQVMsQ0FBQyxDQUFDO0lBQy9CLENBQUM7SUFDTSx5QkFBTSxHQUFiLFVBQWMsQ0FBUyxFQUFFLEVBQVk7UUFDbkMsSUFBSSxDQUFDLElBQUksQ0FBQyxRQUFRLEVBQUUsU0FBUyxDQUFDLENBQUM7SUFDakMsQ0FBQztJQUNNLHdCQUFLLEdBQVosVUFBYSxDQUFTLEVBQUUsRUFBWTtRQUNsQyxJQUFJLENBQUMsSUFBSSxDQUFDLE9BQU8sRUFBRSxTQUFTLENBQUMsQ0FBQztJQUNoQyxDQUFDO0lBQ00sd0JBQUssR0FBWixVQUFhLENBQVMsRUFBRSxJQUFZLEVBQUUsRUFBWTtRQUNoRCxJQUFJLENBQUMsSUFBSSxDQUFDLE9BQU8sRUFBRSxTQUFTLENBQUMsQ0FBQztJQUNoQyxDQUFDO0lBQ00sMEJBQU8sR0FBZCxVQUFlLENBQVMsRUFBRSxFQUE2QztRQUNyRSxJQUFJLENBQUMsSUFBSSxDQUFDLFNBQVMsRUFBRSxTQUFTLENBQUMsQ0FBQztJQUNsQyxDQUFDO0lBQ00seUJBQU0sR0FBYixVQUFjLENBQVMsRUFBRSxFQUE2QjtRQUNwRCxJQUFJLENBQUMsSUFBSSxDQUFDLFFBQVEsRUFBRSxTQUFTLENBQUMsQ0FBQztJQUNqQyxDQUFDO0lBQ00sMkJBQVEsR0FBZixVQUFnQixDQUFTLEVBQUUsS0FBaUMsRUFBRSxFQUFpRDtRQUM3RyxJQUFJLENBQUMsSUFBSSxDQUFDLFVBQVUsRUFBRSxTQUFTLENBQUMsQ0FBQztJQUNuQyxDQUFDO0lBQ00sMkJBQVEsR0FBZixVQUFnQixDQUFTLEVBQUUsR0FBVyxFQUFFLEVBQVk7UUFDbEQsSUFBSSxDQUFDLElBQUksQ0FBQyxVQUFVLEVBQUUsU0FBUyxDQUFDLENBQUM7SUFDbkMsQ0FBQztJQUNNLDJCQUFRLEdBQWYsVUFBZ0IsS0FBYSxFQUFFLFFBQWdCLEVBQUUsSUFBd0IsRUFBRSxFQUF1QztRQUNoSCxJQUFJLENBQUMsSUFBSSxDQUFDLFVBQVUsRUFBRSxTQUFTLENBQUMsQ0FBQztJQUNuQyxDQUFDO0lBQ00sNEJBQVMsR0FBaEIsVUFBaUIsS0FBYSxFQUFFLElBQVMsRUFBRSxRQUFnQixFQUFFLElBQXdCLEVBQUUsSUFBWSxFQUFFLEVBQTJCO1FBQzlILElBQUksQ0FBQyxJQUFJLENBQUMsV0FBVyxFQUFFLFNBQVMsQ0FBQyxDQUFDO0lBQ3BDLENBQUM7SUFDTSw2QkFBVSxHQUFqQixVQUFrQixLQUFhLEVBQUUsSUFBUyxFQUFFLFFBQWdCLEVBQUUsSUFBd0IsRUFBRSxJQUFZLEVBQUUsRUFBMkI7UUFDL0gsSUFBSSxDQUFDLElBQUksQ0FBQyxZQUFZLEVBQUUsU0FBUyxDQUFDLENBQUM7SUFDckMsQ0FBQztJQUNNLHdCQUFLLEdBQVosVUFBYSxDQUFTLEVBQUUsUUFBaUIsRUFBRSxJQUFZLEVBQUUsRUFBWTtRQUNuRSxJQUFJLENBQUMsSUFBSSxDQUFDLE9BQU8sRUFBRSxTQUFTLENBQUMsQ0FBQztJQUNoQyxDQUFDO0lBQ00sd0JBQUssR0FBWixVQUFhLENBQVMsRUFBRSxRQUFpQixFQUFFLEdBQVcsRUFBRSxHQUFXLEVBQUUsRUFBWTtRQUMvRSxJQUFJLENBQUMsSUFBSSxDQUFDLE9BQU8sRUFBRSxTQUFTLENBQUMsQ0FBQztJQUNoQyxDQUFDO0lBQ00seUJBQU0sR0FBYixVQUFjLENBQVMsRUFBRSxLQUFXLEVBQUUsS0FBVyxFQUFFLEVBQVk7UUFDN0QsSUFBSSxDQUFDLElBQUksQ0FBQyxRQUFRLEVBQUUsU0FBUyxDQUFDLENBQUM7SUFDakMsQ0FBQztJQUNNLHVCQUFJLEdBQVgsVUFBWSxPQUFlLEVBQUUsT0FBZSxFQUFFLEVBQVk7UUFDeEQsSUFBSSxDQUFDLElBQUksQ0FBQyxNQUFNLEVBQUUsU0FBUyxDQUFDLENBQUM7SUFDL0IsQ0FBQztJQUNNLDBCQUFPLEdBQWQsVUFBZSxPQUFlLEVBQUUsT0FBZSxFQUFFLElBQVksRUFBRSxFQUFZO1FBQ3pFLElBQUksQ0FBQyxJQUFJLENBQUMsU0FBUyxFQUFFLFNBQVMsQ0FBQyxDQUFDO0lBQ2xDLENBQUM7SUFDTSwyQkFBUSxHQUFmLFVBQWdCLENBQVMsRUFBRSxFQUFZO1FBQ3JDLElBQUksQ0FBQyxJQUFJLENBQUMsVUFBVSxFQUFFLFNBQVMsQ0FBQyxDQUFDO0lBQ25DLENBQUM7SUFFTSw0QkFBUyxHQUFoQixVQUFpQixNQUFjLEVBQUUsRUFBYSxFQUFFLEVBQXlCO1FBQ3ZFLElBQUksQ0FBQyxPQUFPLENBQUMsV0FBVyxDQUFlO1lBQ3JDLGdCQUFnQixFQUFFLElBQUk7WUFDdEIsTUFBTSxFQUFFLE1BQU07WUFDZCxJQUFJLEVBQUUsQ0FBZSxFQUFHLENBQUMsV0FBVyxFQUFFLEVBQUUsSUFBSSxDQUFDLGtCQUFrQixDQUFDLFdBQVcsQ0FBQyxFQUFFLENBQUMsQ0FBQztTQUNqRixDQUFDLENBQUM7SUFDTCxDQUFDO0lBS2EsNkJBQW9CLEdBQWxDLFVBQW1DLE1BQWM7UUFDL0MsSUFBSSxXQUFXLEdBQUcsSUFBSSwrQkFBK0IsRUFBRSxDQUFDO1FBRXhELHlCQUF5QixHQUFRLEVBQUUsV0FBa0IsRUFBRSxFQUFzQztZQUMzRixNQUFNLENBQUMsQ0FBQyxPQUFPLEdBQUcsQ0FBQyxDQUFDLENBQUM7Z0JBQ25CLEtBQUssUUFBUTtvQkFDWCxFQUFFLENBQUMsQ0FBQyxHQUFHLFlBQVksMEJBQUssQ0FBQyxDQUFDLENBQUM7d0JBQ3pCLEVBQUUsQ0FBQyxJQUFJLEVBQUUsaUJBQWlCLENBQUMsR0FBRyxDQUFDLENBQUMsQ0FBQztvQkFDbkMsQ0FBQztvQkFBQyxJQUFJLENBQUMsRUFBRSxDQUFDLENBQUMsR0FBRyxZQUFZLG9CQUFRLENBQUMsQ0FBQyxDQUFDO3dCQUNuQyxFQUFFLENBQUMsSUFBSSxFQUFFLG9CQUFvQixDQUFDLEdBQUcsQ0FBQyxDQUFDLENBQUM7b0JBQ3RDLENBQUM7b0JBQUMsSUFBSSxDQUFDLEVBQUUsQ0FBQyxDQUFDLEdBQUcsWUFBWSxJQUFJLENBQUMsUUFBUSxDQUFDLENBQUMsQ0FBQzt3QkFFeEMsRUFBRSxDQUFDLElBQUksRUFBRSxXQUFXLENBQUMsV0FBVyxDQUFDLEdBQUcsRUFBRSxXQUFXLENBQUMsQ0FBQyxDQUFDLEVBQUUsV0FBVyxDQUFDLENBQUMsQ0FBQyxFQUFFLEVBQUUsQ0FBQyxDQUFDLENBQUM7b0JBQzdFLENBQUM7b0JBQUMsSUFBSSxDQUFDLEVBQUUsQ0FBQyxDQUFDLEdBQUcsWUFBWSxTQUFTLENBQUMsUUFBUSxDQUFDLENBQUMsQ0FBQzt3QkFDN0MsRUFBRSxDQUFDLElBQUksRUFBRSxvQkFBb0IsQ0FBQyxHQUFHLENBQUMsQ0FBQyxDQUFDO29CQUN0QyxDQUFDO29CQUFDLElBQUksQ0FBQyxFQUFFLENBQUMsQ0FBQyxHQUFHLFlBQVksTUFBTSxDQUFDLENBQUMsQ0FBQzt3QkFDakMsRUFBRSxDQUFDLElBQUksRUFBRSxrQkFBa0IsQ0FBQyxHQUFHLENBQUMsQ0FBQyxDQUFDO29CQUNwQyxDQUFDO29CQUFDLElBQUksQ0FBQyxFQUFFLENBQUMsQ0FBQyxHQUFHLFlBQVksS0FBSyxDQUFDLENBQUMsQ0FBQzt3QkFDaEMsRUFBRSxDQUFDLElBQUksRUFBRSxpQkFBaUIsQ0FBQyxHQUFHLENBQUMsQ0FBQyxDQUFDO29CQUNuQyxDQUFDO29CQUFDLElBQUksQ0FBQyxDQUFDO3dCQUNOLEVBQUUsQ0FBQyxJQUFJLEVBQUUsR0FBRyxDQUFDLENBQUM7b0JBQ2hCLENBQUM7b0JBQ0QsS0FBSyxDQUFDO2dCQUNSO29CQUNFLEVBQUUsQ0FBQyxJQUFJLEVBQUUsR0FBRyxDQUFDLENBQUM7b0JBQ2QsS0FBSyxDQUFDO1lBQ1YsQ0FBQztRQUNILENBQUM7UUFFRCx5QkFBeUIsR0FBUSxFQUFFLGdCQUF1QjtZQUN4RCxFQUFFLENBQUMsQ0FBQyxHQUFHLElBQUksSUFBSSxDQUFDLENBQUMsQ0FBQztnQkFDaEIsTUFBTSxDQUFDLEdBQUcsQ0FBQztZQUNiLENBQUM7WUFDRCxNQUFNLENBQUMsQ0FBQyxPQUFPLEdBQUcsQ0FBQyxDQUFDLENBQUM7Z0JBQ25CLEtBQUssUUFBUTtvQkFDWCxFQUFFLENBQUMsQ0FBQyxPQUFPLEdBQUcsQ0FBQyxNQUFNLENBQUMsS0FBSyxRQUFRLENBQUMsQ0FBQyxDQUFDO3dCQUNwQyxJQUFJLFVBQVUsR0FBc0IsR0FBRyxDQUFDO3dCQUN4QyxNQUFNLENBQUMsQ0FBQyxVQUFVLENBQUMsSUFBSSxDQUFDLENBQUMsQ0FBQzs0QkFDeEIsS0FBSyxjQUFjLENBQUMsRUFBRTtnQ0FDcEIsSUFBSSxJQUFJLEdBQXdCLEdBQUksQ0FBQyxFQUFFLENBQUM7Z0NBQ3hDLE1BQU0sQ0FBQztvQ0FDTCxJQUFJLENBQVMsRUFBRSxTQUFTLEdBQUcsSUFBSSxLQUFLLENBQUMsU0FBUyxDQUFDLE1BQU0sQ0FBQyxFQUNwRCxPQUFxQixFQUNyQixTQUFTLEdBQUcsU0FBUyxDQUFDLE1BQU0sQ0FBQztvQ0FFL0IsMkJBQTJCLEdBQWE7d0NBQ3RDLEVBQUUsQ0FBQyxDQUFDLFNBQVMsR0FBRyxDQUFDLENBQUMsQ0FBQyxDQUFDOzRDQUNsQixTQUFTLEdBQUcsQ0FBQyxDQUFDLENBQUM7NENBQ2YsT0FBTyxHQUFHO2dEQUNSLGdCQUFnQixFQUFFLElBQUk7Z0RBQ3RCLElBQUksRUFBRSxJQUFJO2dEQUNWLElBQUksRUFBRSxDQUFDLG9CQUFvQixDQUFDLEdBQUcsQ0FBQyxDQUFDOzZDQUNsQyxDQUFDOzRDQUNGLE1BQU0sQ0FBQyxXQUFXLENBQUMsT0FBTyxDQUFDLENBQUM7d0NBQzlCLENBQUM7b0NBQ0gsQ0FBQztvQ0FHRCxHQUFHLENBQUMsQ0FBQyxDQUFDLEdBQUcsQ0FBQyxFQUFFLENBQUMsR0FBRyxTQUFTLENBQUMsTUFBTSxFQUFFLENBQUMsRUFBRSxFQUFFLENBQUM7d0NBRXRDLENBQUMsVUFBQyxDQUFTLEVBQUUsR0FBUTs0Q0FDbkIsZUFBZSxDQUFDLEdBQUcsRUFBRSxnQkFBZ0IsRUFBRSxVQUFDLEdBQUcsRUFBRSxRQUFTO2dEQUNwRCxTQUFTLENBQUMsQ0FBQyxDQUFDLEdBQUcsUUFBUSxDQUFDO2dEQUN4QixFQUFFLENBQUMsQ0FBQyxHQUFHLENBQUMsQ0FBQyxDQUFDO29EQUNSLGlCQUFpQixDQUFDLEdBQUcsQ0FBQyxDQUFDO2dEQUN6QixDQUFDO2dEQUFDLElBQUksQ0FBQyxFQUFFLENBQUMsQ0FBQyxFQUFFLFNBQVMsS0FBSyxDQUFDLENBQUMsQ0FBQyxDQUFDO29EQUM3QixPQUFPLEdBQUc7d0RBQ1IsZ0JBQWdCLEVBQUUsSUFBSTt3REFDdEIsSUFBSSxFQUFFLElBQUk7d0RBQ1YsSUFBSSxFQUFFLFNBQVM7cURBQ2hCLENBQUM7b0RBQ0YsTUFBTSxDQUFDLFdBQVcsQ0FBQyxPQUFPLENBQUMsQ0FBQztnREFDOUIsQ0FBQzs0Q0FDSCxDQUFDLENBQUMsQ0FBQzt3Q0FDTCxDQUFDLENBQUMsQ0FBQyxDQUFDLEVBQUUsU0FBUyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUM7b0NBQ3RCLENBQUM7b0NBRUQsRUFBRSxDQUFDLENBQUMsU0FBUyxDQUFDLE1BQU0sS0FBSyxDQUFDLENBQUMsQ0FBQyxDQUFDO3dDQUMzQixPQUFPLEdBQUc7NENBQ1IsZ0JBQWdCLEVBQUUsSUFBSTs0Q0FDdEIsSUFBSSxFQUFFLElBQUk7NENBQ1YsSUFBSSxFQUFFLFNBQVM7eUNBQ2hCLENBQUM7d0NBQ0YsTUFBTSxDQUFDLFdBQVcsQ0FBQyxPQUFPLENBQUMsQ0FBQztvQ0FDOUIsQ0FBQztnQ0FFSCxDQUFDLENBQUM7NEJBQ0osS0FBSyxjQUFjLENBQUMsU0FBUztnQ0FDM0IsTUFBTSxDQUFDLG9CQUFvQixDQUFxQixVQUFVLENBQUMsQ0FBQzs0QkFDOUQsS0FBSyxjQUFjLENBQUMsS0FBSztnQ0FDdkIsTUFBTSxDQUFDLGlCQUFpQixDQUFrQixVQUFVLENBQUMsQ0FBQzs0QkFDeEQsS0FBSyxjQUFjLENBQUMsUUFBUTtnQ0FDMUIsTUFBTSxDQUFDLG9CQUFvQixDQUFxQixVQUFVLENBQUMsQ0FBQzs0QkFDOUQsS0FBSyxjQUFjLENBQUMsTUFBTTtnQ0FDeEIsTUFBTSxDQUFDLGtCQUFrQixDQUFtQixVQUFVLENBQUMsQ0FBQzs0QkFDMUQsS0FBSyxjQUFjLENBQUMsS0FBSztnQ0FDdkIsTUFBTSxDQUFDLGlCQUFpQixDQUFrQixVQUFVLENBQUMsQ0FBQzs0QkFDeEQ7Z0NBRUUsTUFBTSxDQUFDLEdBQUcsQ0FBQzt3QkFDZixDQUFDO29CQUNILENBQUM7b0JBQUMsSUFBSSxDQUFDLENBQUM7d0JBQ04sTUFBTSxDQUFDLEdBQUcsQ0FBQztvQkFDYixDQUFDO2dCQUNIO29CQUNFLE1BQU0sQ0FBQyxHQUFHLENBQUM7WUFDZixDQUFDO1FBQ0gsQ0FBQztRQUVELE1BQU0sQ0FBQyxnQkFBZ0IsQ0FBQyxTQUFTLEVBQUMsVUFBQyxDQUFlO1lBQ2hELElBQUksT0FBTyxHQUFXLENBQUMsQ0FBQyxJQUFJLENBQUM7WUFDN0IsRUFBRSxDQUFDLENBQUMsWUFBWSxDQUFDLE9BQU8sQ0FBQyxDQUFDLENBQUMsQ0FBQztnQkFDMUIsSUFBSSxJQUFJLEdBQUcsT0FBTyxDQUFDLElBQUksRUFDckIsU0FBUyxHQUFHLElBQUksS0FBSyxDQUFNLElBQUksQ0FBQyxNQUFNLENBQUMsRUFDdkMsQ0FBUyxDQUFDO2dCQUVaLE1BQU0sQ0FBQyxDQUFDLE9BQU8sQ0FBQyxNQUFNLENBQUMsQ0FBQyxDQUFDO29CQUN2QixLQUFLLE9BQU8sQ0FBQztvQkFDYixLQUFLLE1BQU07d0JBQ1QsQ0FBQzs0QkFFQyxJQUFJLFFBQVEsR0FBdUIsSUFBSSxDQUFDLENBQUMsQ0FBQyxDQUFDOzRCQUMzQyxXQUFXLENBQUMsaUJBQWlCLENBQUMsT0FBTyxFQUFFLFVBQUMsR0FBYztnQ0FFcEQsSUFBSSxRQUFRLEdBQWlCO29DQUMzQixnQkFBZ0IsRUFBRSxJQUFJO29DQUN0QixJQUFJLEVBQUUsUUFBUSxDQUFDLEVBQUU7b0NBQ2pCLElBQUksRUFBRSxHQUFHLEdBQUcsQ0FBQyxvQkFBb0IsQ0FBQyxHQUFHLENBQUMsQ0FBQyxHQUFHLEVBQUU7aUNBQzdDLENBQUM7Z0NBQ0YsTUFBTSxDQUFDLFdBQVcsQ0FBQyxRQUFRLENBQUMsQ0FBQzs0QkFDL0IsQ0FBQyxDQUFDLENBQUM7d0JBQ0wsQ0FBQyxDQUFDLEVBQUUsQ0FBQzt3QkFDTCxLQUFLLENBQUM7b0JBQ1IsS0FBSyxPQUFPO3dCQUNWLENBQUM7NEJBQ0MsSUFBSSxNQUFNLEdBQTRCLEVBQUUsQ0FBQyxTQUFTLEVBQUUsRUFDbEQsUUFBUSxHQUF1QixJQUFJLENBQUMsQ0FBQyxDQUFDLEVBQ3RDLGFBQWEsR0FBbUI7Z0NBQzlCLElBQUksRUFBRSxjQUFjLENBQUMsS0FBSztnQ0FDMUIsVUFBVSxFQUFFLE1BQU0sQ0FBQyxVQUFVLEVBQUU7Z0NBQy9CLGFBQWEsRUFBRSxNQUFNLENBQUMsYUFBYSxFQUFFO2dDQUNyQyxhQUFhLEVBQUUsTUFBTSxDQUFDLGFBQWEsRUFBRTs2QkFDdEMsRUFDRCxRQUFRLEdBQWlCO2dDQUN2QixnQkFBZ0IsRUFBRSxJQUFJO2dDQUN0QixJQUFJLEVBQUUsUUFBUSxDQUFDLEVBQUU7Z0NBQ2pCLElBQUksRUFBRSxDQUFDLGFBQWEsQ0FBQzs2QkFDdEIsQ0FBQzs0QkFFSixNQUFNLENBQUMsV0FBVyxDQUFDLFFBQVEsQ0FBQyxDQUFDO3dCQUMvQixDQUFDLENBQUMsRUFBRSxDQUFDO3dCQUNMLEtBQUssQ0FBQztvQkFDUjt3QkFFRSxHQUFHLENBQUMsQ0FBQyxDQUFDLEdBQUcsQ0FBQyxFQUFFLENBQUMsR0FBRyxJQUFJLENBQUMsTUFBTSxFQUFFLENBQUMsRUFBRSxFQUFFLENBQUM7NEJBQ2pDLFNBQVMsQ0FBQyxDQUFDLENBQUMsR0FBRyxlQUFlLENBQUMsSUFBSSxDQUFDLENBQUMsQ0FBQyxFQUFFLFNBQVMsQ0FBQyxDQUFDO3dCQUNyRCxDQUFDO3dCQUNELElBQUksTUFBTSxHQUFHLEVBQUUsQ0FBQyxTQUFTLEVBQUUsQ0FBQzt3QkFDaEIsTUFBTSxDQUFDLE9BQU8sQ0FBQyxNQUFNLENBQUUsQ0FBQyxLQUFLLENBQUMsTUFBTSxFQUFFLFNBQVMsQ0FBQyxDQUFDO3dCQUM3RCxLQUFLLENBQUM7Z0JBQ1YsQ0FBQztZQUNILENBQUM7UUFDSCxDQUFDLENBQUMsQ0FBQztJQUNMLENBQUM7SUFDSCxlQUFDO0FBQUQsQ0FBQyxBQTNYRCxDQUFzQyxXQUFXLENBQUMsY0FBYyxHQTJYL0Q7QUEzWEQ7NkJBMlhDLENBQUEiLCJzb3VyY2VzQ29udGVudCI6WyJpbXBvcnQgZmlsZV9zeXN0ZW0gPSByZXF1aXJlKCcuLi9jb3JlL2ZpbGVfc3lzdGVtJyk7XG5pbXBvcnQge0FwaUVycm9yfSBmcm9tICcuLi9jb3JlL2FwaV9lcnJvcic7XG5pbXBvcnQgZmlsZV9mbGFnID0gcmVxdWlyZSgnLi4vY29yZS9maWxlX2ZsYWcnKTtcbmltcG9ydCB7YnVmZmVyMkFycmF5QnVmZmVyLCBhcnJheUJ1ZmZlcjJCdWZmZXJ9IGZyb20gJy4uL2NvcmUvdXRpbCc7XG5pbXBvcnQgZmlsZSA9IHJlcXVpcmUoJy4uL2NvcmUvZmlsZScpO1xuaW1wb3J0IHtkZWZhdWx0IGFzIFN0YXRzLCBGaWxlVHlwZX0gZnJvbSAnLi4vY29yZS9ub2RlX2ZzX3N0YXRzJztcbmltcG9ydCBwcmVsb2FkX2ZpbGUgPSByZXF1aXJlKCcuLi9nZW5lcmljL3ByZWxvYWRfZmlsZScpO1xuaW1wb3J0IGdsb2JhbCA9IHJlcXVpcmUoJy4uL2NvcmUvZ2xvYmFsJyk7XG5pbXBvcnQgZnMgPSByZXF1aXJlKCcuLi9jb3JlL25vZGVfZnMnKTtcblxuaW50ZXJmYWNlIElCcm93c2VyRlNNZXNzYWdlIHtcbiAgYnJvd3NlcmZzTWVzc2FnZTogYm9vbGVhbjtcbn1cblxuZW51bSBTcGVjaWFsQXJnVHlwZSB7XG4gIC8vIENhbGxiYWNrXG4gIENCLFxuICAvLyBGaWxlIGRlc2NyaXB0b3JcbiAgRkQsXG4gIC8vIEFQSSBlcnJvclxuICBBUElfRVJST1IsXG4gIC8vIFN0YXRzIG9iamVjdFxuICBTVEFUUyxcbiAgLy8gSW5pdGlhbCBwcm9iZSBmb3IgZmlsZSBzeXN0ZW0gaW5mb3JtYXRpb24uXG4gIFBST0JFLFxuICAvLyBGaWxlRmxhZyBvYmplY3QuXG4gIEZJTEVGTEFHLFxuICAvLyBCdWZmZXIgb2JqZWN0LlxuICBCVUZGRVIsXG4gIC8vIEdlbmVyaWMgRXJyb3Igb2JqZWN0LlxuICBFUlJPUlxufVxuXG5pbnRlcmZhY2UgSVNwZWNpYWxBcmd1bWVudCB7XG4gIHR5cGU6IFNwZWNpYWxBcmdUeXBlO1xufVxuXG5pbnRlcmZhY2UgSVByb2JlUmVzcG9uc2UgZXh0ZW5kcyBJU3BlY2lhbEFyZ3VtZW50IHtcbiAgaXNSZWFkT25seTogYm9vbGVhbjtcbiAgc3VwcG9ydHNMaW5rczogYm9vbGVhbjtcbiAgc3VwcG9ydHNQcm9wczogYm9vbGVhbjtcbn1cblxuaW50ZXJmYWNlIElDYWxsYmFja0FyZ3VtZW50IGV4dGVuZHMgSVNwZWNpYWxBcmd1bWVudCB7XG4gIC8vIFRoZSBjYWxsYmFjayBJRC5cbiAgaWQ6IG51bWJlcjtcbn1cblxuLyoqXG4gKiBDb252ZXJ0cyBjYWxsYmFjayBhcmd1bWVudHMgaW50byBJQ2FsbGJhY2tBcmd1bWVudCBvYmplY3RzLCBhbmQgYmFja1xuICogYWdhaW4uXG4gKi9cbmNsYXNzIENhbGxiYWNrQXJndW1lbnRDb252ZXJ0ZXIge1xuICBwcml2YXRlIF9jYWxsYmFja3M6IHsgW2lkOiBudW1iZXJdOiBGdW5jdGlvbiB9ID0ge307XG4gIHByaXZhdGUgX25leHRJZDogbnVtYmVyID0gMDtcblxuICBwdWJsaWMgdG9SZW1vdGVBcmcoY2I6IEZ1bmN0aW9uKTogSUNhbGxiYWNrQXJndW1lbnQge1xuICAgIHZhciBpZCA9IHRoaXMuX25leHRJZCsrO1xuICAgIHRoaXMuX2NhbGxiYWNrc1tpZF0gPSBjYjtcbiAgICByZXR1cm4ge1xuICAgICAgdHlwZTogU3BlY2lhbEFyZ1R5cGUuQ0IsXG4gICAgICBpZDogaWRcbiAgICB9O1xuICB9XG5cbiAgcHVibGljIHRvTG9jYWxBcmcoaWQ6IG51bWJlcik6IEZ1bmN0aW9uIHtcbiAgICB2YXIgY2IgPSB0aGlzLl9jYWxsYmFja3NbaWRdO1xuICAgIGRlbGV0ZSB0aGlzLl9jYWxsYmFja3NbaWRdO1xuICAgIHJldHVybiBjYjtcbiAgfVxufVxuXG5pbnRlcmZhY2UgSUZpbGVEZXNjcmlwdG9yQXJndW1lbnQgZXh0ZW5kcyBJU3BlY2lhbEFyZ3VtZW50IHtcbiAgLy8gVGhlIGZpbGUgZGVzY3JpcHRvcidzIGlkIG9uIHRoZSByZW1vdGUgc2lkZS5cbiAgaWQ6IG51bWJlcjtcbiAgLy8gVGhlIGVudGlyZSBmaWxlJ3MgZGF0YSwgYXMgYW4gYXJyYXkgYnVmZmVyLlxuICBkYXRhOiBBcnJheUJ1ZmZlcjtcbiAgLy8gVGhlIGZpbGUncyBzdGF0IG9iamVjdCwgYXMgYW4gYXJyYXkgYnVmZmVyLlxuICBzdGF0OiBBcnJheUJ1ZmZlcjtcbiAgLy8gVGhlIHBhdGggdG8gdGhlIGZpbGUuXG4gIHBhdGg6IHN0cmluZztcbiAgLy8gVGhlIGZsYWcgb2YgdGhlIG9wZW4gZmlsZSBkZXNjcmlwdG9yLlxuICBmbGFnOiBzdHJpbmc7XG59XG5cbmNsYXNzIEZpbGVEZXNjcmlwdG9yQXJndW1lbnRDb252ZXJ0ZXIge1xuICBwcml2YXRlIF9maWxlRGVzY3JpcHRvcnM6IHsgW2lkOiBudW1iZXJdOiBmaWxlLkZpbGUgfSA9IHt9O1xuICBwcml2YXRlIF9uZXh0SWQ6IG51bWJlciA9IDA7XG5cbiAgcHVibGljIHRvUmVtb3RlQXJnKGZkOiBmaWxlLkZpbGUsIHA6IHN0cmluZywgZmxhZzogZmlsZV9mbGFnLkZpbGVGbGFnLCBjYjogKGVycjogQXBpRXJyb3IsIGFyZz86IElGaWxlRGVzY3JpcHRvckFyZ3VtZW50KSA9PiB2b2lkKTogdm9pZCB7XG4gICAgdmFyIGlkID0gdGhpcy5fbmV4dElkKyssXG4gICAgICBkYXRhOiBBcnJheUJ1ZmZlcixcbiAgICAgIHN0YXQ6IEFycmF5QnVmZmVyLFxuICAgICAgYXJnc0xlZnQ6IG51bWJlciA9IDI7XG4gICAgdGhpcy5fZmlsZURlc2NyaXB0b3JzW2lkXSA9IGZkO1xuXG4gICAgLy8gRXh0cmFjdCBuZWVkZWQgaW5mb3JtYXRpb24gYXN5bmNocm9ub3VzbHkuXG4gICAgZmQuc3RhdCgoZXJyLCBzdGF0cykgPT4ge1xuICAgICAgaWYgKGVycikge1xuICAgICAgICBjYihlcnIpO1xuICAgICAgfSBlbHNlIHtcbiAgICAgICAgc3RhdCA9IGJ1ZmZlclRvVHJhbnNmZXJyYWJsZU9iamVjdChzdGF0cy50b0J1ZmZlcigpKTtcbiAgICAgICAgLy8gSWYgaXQncyBhIHJlYWRhYmxlIGZsYWcsIHdlIG5lZWQgdG8gZ3JhYiBjb250ZW50cy5cbiAgICAgICAgaWYgKGZsYWcuaXNSZWFkYWJsZSgpKSB7XG4gICAgICAgICAgZmQucmVhZChuZXcgQnVmZmVyKHN0YXRzLnNpemUpLCAwLCBzdGF0cy5zaXplLCAwLCAoZXJyLCBieXRlc1JlYWQsIGJ1ZmYpID0+IHtcbiAgICAgICAgICAgIGlmIChlcnIpIHtcbiAgICAgICAgICAgICAgY2IoZXJyKTtcbiAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgIGRhdGEgPSBidWZmZXJUb1RyYW5zZmVycmFibGVPYmplY3QoYnVmZik7XG4gICAgICAgICAgICAgIGNiKG51bGwsIHtcbiAgICAgICAgICAgICAgICB0eXBlOiBTcGVjaWFsQXJnVHlwZS5GRCxcbiAgICAgICAgICAgICAgICBpZDogaWQsXG4gICAgICAgICAgICAgICAgZGF0YTogZGF0YSxcbiAgICAgICAgICAgICAgICBzdGF0OiBzdGF0LFxuICAgICAgICAgICAgICAgIHBhdGg6IHAsXG4gICAgICAgICAgICAgICAgZmxhZzogZmxhZy5nZXRGbGFnU3RyaW5nKClcbiAgICAgICAgICAgICAgfSk7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgfSk7XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgLy8gRmlsZSBpcyBub3QgcmVhZGFibGUsIHdoaWNoIG1lYW5zIHdyaXRpbmcgdG8gaXQgd2lsbCBhcHBlbmQgb3JcbiAgICAgICAgICAvLyB0cnVuY2F0ZS9yZXBsYWNlIGV4aXN0aW5nIGNvbnRlbnRzLiBSZXR1cm4gYW4gZW1wdHkgYXJyYXlidWZmZXIuXG4gICAgICAgICAgY2IobnVsbCwge1xuICAgICAgICAgICAgdHlwZTogU3BlY2lhbEFyZ1R5cGUuRkQsXG4gICAgICAgICAgICBpZDogaWQsXG4gICAgICAgICAgICBkYXRhOiBuZXcgQXJyYXlCdWZmZXIoMCksXG4gICAgICAgICAgICBzdGF0OiBzdGF0LFxuICAgICAgICAgICAgcGF0aDogcCxcbiAgICAgICAgICAgIGZsYWc6IGZsYWcuZ2V0RmxhZ1N0cmluZygpXG4gICAgICAgICAgfSk7XG4gICAgICAgIH1cbiAgICAgIH1cbiAgICB9KTtcbiAgfVxuXG4gIHByaXZhdGUgX2FwcGx5RmRDaGFuZ2VzKHJlbW90ZUZkOiBJRmlsZURlc2NyaXB0b3JBcmd1bWVudCwgY2I6IChlcnI6IEFwaUVycm9yLCBmZD86IGZpbGUuRmlsZSkgPT4gdm9pZCk6IHZvaWQge1xuICAgIHZhciBmZCA9IHRoaXMuX2ZpbGVEZXNjcmlwdG9yc1tyZW1vdGVGZC5pZF0sXG4gICAgICBkYXRhID0gdHJhbnNmZXJyYWJsZU9iamVjdFRvQnVmZmVyKHJlbW90ZUZkLmRhdGEpLFxuICAgICAgcmVtb3RlU3RhdHMgPSBTdGF0cy5mcm9tQnVmZmVyKHRyYW5zZmVycmFibGVPYmplY3RUb0J1ZmZlcihyZW1vdGVGZC5zdGF0KSk7XG5cbiAgICAvLyBXcml0ZSBkYXRhIGlmIHRoZSBmaWxlIGlzIHdyaXRhYmxlLlxuICAgIHZhciBmbGFnID0gZmlsZV9mbGFnLkZpbGVGbGFnLmdldEZpbGVGbGFnKHJlbW90ZUZkLmZsYWcpO1xuICAgIGlmIChmbGFnLmlzV3JpdGVhYmxlKCkpIHtcbiAgICAgIC8vIEFwcGVuZGFibGU6IFdyaXRlIHRvIGVuZCBvZiBmaWxlLlxuICAgICAgLy8gV3JpdGVhYmxlOiBSZXBsYWNlIGVudGlyZSBjb250ZW50cyBvZiBmaWxlLlxuICAgICAgZmQud3JpdGUoZGF0YSwgMCwgZGF0YS5sZW5ndGgsIGZsYWcuaXNBcHBlbmRhYmxlKCkgPyBmZC5nZXRQb3MoKSA6IDAsIChlKSA9PiB7XG4gICAgICAgIGZ1bmN0aW9uIGFwcGx5U3RhdENoYW5nZXMoKSB7XG4gICAgICAgICAgLy8gQ2hlY2sgaWYgbW9kZSBjaGFuZ2VkLlxuICAgICAgICAgIGZkLnN0YXQoKGUsIHN0YXRzPykgPT4ge1xuICAgICAgICAgICAgaWYgKGUpIHtcbiAgICAgICAgICAgICAgY2IoZSk7XG4gICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICBpZiAoc3RhdHMubW9kZSAhPT0gcmVtb3RlU3RhdHMubW9kZSkge1xuICAgICAgICAgICAgICAgIGZkLmNobW9kKHJlbW90ZVN0YXRzLm1vZGUsIChlOiBhbnkpID0+IHtcbiAgICAgICAgICAgICAgICAgIGNiKGUsIGZkKTtcbiAgICAgICAgICAgICAgICB9KTtcbiAgICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICBjYihlLCBmZCk7XG4gICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH1cbiAgICAgICAgICB9KTtcbiAgICAgICAgfVxuICAgICAgICBpZiAoZSkge1xuICAgICAgICAgIGNiKGUpO1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgIC8vIElmIHdyaXRlYWJsZSAmIG5vdCBhcHBlbmRhYmxlLCB3ZSBuZWVkIHRvIGVuc3VyZSBmaWxlIGNvbnRlbnRzIGFyZVxuICAgICAgICAgIC8vIGlkZW50aWNhbCB0byB0aG9zZSBmcm9tIHRoZSByZW1vdGUgRkQuIFRodXMsIHdlIHRydW5jYXRlIHRvIHRoZVxuICAgICAgICAgIC8vIGxlbmd0aCBvZiB0aGUgcmVtb3RlIGZpbGUuXG4gICAgICAgICAgaWYgKCFmbGFnLmlzQXBwZW5kYWJsZSgpKSB7XG4gICAgICAgICAgICBmZC50cnVuY2F0ZShkYXRhLmxlbmd0aCwgKCkgPT4ge1xuICAgICAgICAgICAgICBhcHBseVN0YXRDaGFuZ2VzKCk7XG4gICAgICAgICAgICB9KVxuICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICBhcHBseVN0YXRDaGFuZ2VzKCk7XG4gICAgICAgICAgfVxuICAgICAgICB9XG4gICAgICB9KTtcbiAgICB9IGVsc2Uge1xuICAgICAgY2IobnVsbCwgZmQpO1xuICAgIH1cbiAgfVxuXG4gIHB1YmxpYyBhcHBseUZkQVBJUmVxdWVzdChyZXF1ZXN0OiBJQVBJUmVxdWVzdCwgY2I6IChlcnI/OiBBcGlFcnJvcikgPT4gdm9pZCk6IHZvaWQge1xuICAgIHZhciBmZEFyZyA9IDxJRmlsZURlc2NyaXB0b3JBcmd1bWVudD4gcmVxdWVzdC5hcmdzWzBdO1xuICAgIHRoaXMuX2FwcGx5RmRDaGFuZ2VzKGZkQXJnLCAoZXJyLCBmZD8pID0+IHtcbiAgICAgIGlmIChlcnIpIHtcbiAgICAgICAgY2IoZXJyKTtcbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIC8vIEFwcGx5IG1ldGhvZCBvbiBub3ctY2hhbmdlZCBmaWxlIGRlc2NyaXB0b3IuXG4gICAgICAgICg8YW55PiBmZClbcmVxdWVzdC5tZXRob2RdKChlPzogQXBpRXJyb3IpID0+IHtcbiAgICAgICAgICBpZiAocmVxdWVzdC5tZXRob2QgPT09ICdjbG9zZScpIHtcbiAgICAgICAgICAgIGRlbGV0ZSB0aGlzLl9maWxlRGVzY3JpcHRvcnNbZmRBcmcuaWRdO1xuICAgICAgICAgIH1cbiAgICAgICAgICBjYihlKTtcbiAgICAgICAgfSk7XG4gICAgICB9XG4gICAgfSk7XG4gIH1cbn1cblxuaW50ZXJmYWNlIElBUElFcnJvckFyZ3VtZW50IGV4dGVuZHMgSVNwZWNpYWxBcmd1bWVudCB7XG4gIC8vIFRoZSBlcnJvciBvYmplY3QsIGFzIGFuIGFycmF5IGJ1ZmZlci5cbiAgZXJyb3JEYXRhOiBBcnJheUJ1ZmZlcjtcbn1cblxuZnVuY3Rpb24gYXBpRXJyb3JMb2NhbDJSZW1vdGUoZTogQXBpRXJyb3IpOiBJQVBJRXJyb3JBcmd1bWVudCB7XG4gIHJldHVybiB7XG4gICAgdHlwZTogU3BlY2lhbEFyZ1R5cGUuQVBJX0VSUk9SLFxuICAgIGVycm9yRGF0YTogYnVmZmVyVG9UcmFuc2ZlcnJhYmxlT2JqZWN0KGUud3JpdGVUb0J1ZmZlcigpKVxuICB9O1xufVxuXG5mdW5jdGlvbiBhcGlFcnJvclJlbW90ZTJMb2NhbChlOiBJQVBJRXJyb3JBcmd1bWVudCk6IEFwaUVycm9yIHtcbiAgcmV0dXJuIEFwaUVycm9yLmZyb21CdWZmZXIodHJhbnNmZXJyYWJsZU9iamVjdFRvQnVmZmVyKGUuZXJyb3JEYXRhKSk7XG59XG5cbmludGVyZmFjZSBJRXJyb3JBcmd1bWVudCBleHRlbmRzIElTcGVjaWFsQXJndW1lbnQge1xuICAvLyBUaGUgbmFtZSBvZiB0aGUgZXJyb3IgKGUuZy4gJ1R5cGVFcnJvcicpLlxuICBuYW1lOiBzdHJpbmc7XG4gIC8vIFRoZSBtZXNzYWdlIGFzc29jaWF0ZWQgd2l0aCB0aGUgZXJyb3IuXG4gIG1lc3NhZ2U6IHN0cmluZztcbiAgLy8gVGhlIHN0YWNrIGFzc29jaWF0ZWQgd2l0aCB0aGUgZXJyb3IuXG4gIHN0YWNrOiBzdHJpbmc7XG59XG5cbmZ1bmN0aW9uIGVycm9yTG9jYWwyUmVtb3RlKGU6IEVycm9yKTogSUVycm9yQXJndW1lbnQge1xuICByZXR1cm4ge1xuICAgIHR5cGU6IFNwZWNpYWxBcmdUeXBlLkVSUk9SLFxuICAgIG5hbWU6IGUubmFtZSxcbiAgICBtZXNzYWdlOiBlLm1lc3NhZ2UsXG4gICAgc3RhY2s6IGUuc3RhY2tcbiAgfTtcbn1cblxuZnVuY3Rpb24gZXJyb3JSZW1vdGUyTG9jYWwoZTogSUVycm9yQXJndW1lbnQpOiBFcnJvciB7XG4gIHZhciBjbnN0cjoge1xuICAgIG5ldyAobXNnOiBzdHJpbmcpOiBFcnJvcjtcbiAgfSA9IGdsb2JhbFtlLm5hbWVdO1xuICBpZiAodHlwZW9mKGNuc3RyKSAhPT0gJ2Z1bmN0aW9uJykge1xuICAgIGNuc3RyID0gRXJyb3I7XG4gIH1cbiAgdmFyIGVyciA9IG5ldyBjbnN0cihlLm1lc3NhZ2UpO1xuICBlcnIuc3RhY2sgPSBlLnN0YWNrO1xuICByZXR1cm4gZXJyO1xufVxuXG5pbnRlcmZhY2UgSVN0YXRzQXJndW1lbnQgZXh0ZW5kcyBJU3BlY2lhbEFyZ3VtZW50IHtcbiAgLy8gVGhlIHN0YXRzIG9iamVjdCBhcyBhbiBhcnJheSBidWZmZXIuXG4gIHN0YXRzRGF0YTogQXJyYXlCdWZmZXI7XG59XG5cbmZ1bmN0aW9uIHN0YXRzTG9jYWwyUmVtb3RlKHN0YXRzOiBTdGF0cyk6IElTdGF0c0FyZ3VtZW50IHtcbiAgcmV0dXJuIHtcbiAgICB0eXBlOiBTcGVjaWFsQXJnVHlwZS5TVEFUUyxcbiAgICBzdGF0c0RhdGE6IGJ1ZmZlclRvVHJhbnNmZXJyYWJsZU9iamVjdChzdGF0cy50b0J1ZmZlcigpKVxuICB9O1xufVxuXG5mdW5jdGlvbiBzdGF0c1JlbW90ZTJMb2NhbChzdGF0czogSVN0YXRzQXJndW1lbnQpOiBTdGF0cyB7XG4gIHJldHVybiBTdGF0cy5mcm9tQnVmZmVyKHRyYW5zZmVycmFibGVPYmplY3RUb0J1ZmZlcihzdGF0cy5zdGF0c0RhdGEpKTtcbn1cblxuaW50ZXJmYWNlIElGaWxlRmxhZ0FyZ3VtZW50IGV4dGVuZHMgSVNwZWNpYWxBcmd1bWVudCB7XG4gIGZsYWdTdHI6IHN0cmluZztcbn1cblxuZnVuY3Rpb24gZmlsZUZsYWdMb2NhbDJSZW1vdGUoZmxhZzogZmlsZV9mbGFnLkZpbGVGbGFnKTogSUZpbGVGbGFnQXJndW1lbnQge1xuICByZXR1cm4ge1xuICAgIHR5cGU6IFNwZWNpYWxBcmdUeXBlLkZJTEVGTEFHLFxuICAgIGZsYWdTdHI6IGZsYWcuZ2V0RmxhZ1N0cmluZygpXG4gIH07XG59XG5cbmZ1bmN0aW9uIGZpbGVGbGFnUmVtb3RlMkxvY2FsKHJlbW90ZUZsYWc6IElGaWxlRmxhZ0FyZ3VtZW50KTogZmlsZV9mbGFnLkZpbGVGbGFnIHtcbiAgcmV0dXJuIGZpbGVfZmxhZy5GaWxlRmxhZy5nZXRGaWxlRmxhZyhyZW1vdGVGbGFnLmZsYWdTdHIpO1xufVxuXG5pbnRlcmZhY2UgSUJ1ZmZlckFyZ3VtZW50IGV4dGVuZHMgSVNwZWNpYWxBcmd1bWVudCB7XG4gIGRhdGE6IEFycmF5QnVmZmVyO1xufVxuXG5mdW5jdGlvbiBidWZmZXJUb1RyYW5zZmVycmFibGVPYmplY3QoYnVmZjogTm9kZUJ1ZmZlcik6IEFycmF5QnVmZmVyIHtcbiAgcmV0dXJuIGJ1ZmZlcjJBcnJheUJ1ZmZlcihidWZmKTtcbn1cblxuZnVuY3Rpb24gdHJhbnNmZXJyYWJsZU9iamVjdFRvQnVmZmVyKGJ1ZmY6IEFycmF5QnVmZmVyKTogQnVmZmVyIHtcbiAgcmV0dXJuIGFycmF5QnVmZmVyMkJ1ZmZlcihidWZmKTtcbn1cblxuZnVuY3Rpb24gYnVmZmVyTG9jYWwyUmVtb3RlKGJ1ZmY6IEJ1ZmZlcik6IElCdWZmZXJBcmd1bWVudCB7XG4gIHJldHVybiB7XG4gICAgdHlwZTogU3BlY2lhbEFyZ1R5cGUuQlVGRkVSLFxuICAgIGRhdGE6IGJ1ZmZlclRvVHJhbnNmZXJyYWJsZU9iamVjdChidWZmKVxuICB9O1xufVxuXG5mdW5jdGlvbiBidWZmZXJSZW1vdGUyTG9jYWwoYnVmZkFyZzogSUJ1ZmZlckFyZ3VtZW50KTogQnVmZmVyIHtcbiAgcmV0dXJuIHRyYW5zZmVycmFibGVPYmplY3RUb0J1ZmZlcihidWZmQXJnLmRhdGEpO1xufVxuXG5pbnRlcmZhY2UgSUFQSVJlcXVlc3QgZXh0ZW5kcyBJQnJvd3NlckZTTWVzc2FnZSB7XG4gIG1ldGhvZDogc3RyaW5nO1xuICBhcmdzOiBBcnJheTxudW1iZXIgfCBzdHJpbmcgfCBJU3BlY2lhbEFyZ3VtZW50Pjtcbn1cblxuZnVuY3Rpb24gaXNBUElSZXF1ZXN0KGRhdGE6IGFueSk6IGRhdGEgaXMgSUFQSVJlcXVlc3Qge1xuICByZXR1cm4gZGF0YSAhPSBudWxsICYmIHR5cGVvZiBkYXRhID09PSAnb2JqZWN0JyAmJiBkYXRhLmhhc093blByb3BlcnR5KCdicm93c2VyZnNNZXNzYWdlJykgJiYgZGF0YVsnYnJvd3NlcmZzTWVzc2FnZSddO1xufVxuXG5pbnRlcmZhY2UgSUFQSVJlc3BvbnNlIGV4dGVuZHMgSUJyb3dzZXJGU01lc3NhZ2Uge1xuICBjYklkOiBudW1iZXI7XG4gIGFyZ3M6IEFycmF5PG51bWJlciB8IHN0cmluZyB8IElTcGVjaWFsQXJndW1lbnQ+O1xufVxuXG5mdW5jdGlvbiBpc0FQSVJlc3BvbnNlKGRhdGE6IGFueSk6IGRhdGEgaXMgSUFQSVJlc3BvbnNlIHtcbiAgcmV0dXJuIGRhdGEgIT0gbnVsbCAmJiB0eXBlb2YgZGF0YSA9PT0gJ29iamVjdCcgJiYgZGF0YS5oYXNPd25Qcm9wZXJ0eSgnYnJvd3NlcmZzTWVzc2FnZScpICYmIGRhdGFbJ2Jyb3dzZXJmc01lc3NhZ2UnXTtcbn1cblxuLyoqXG4gKiBSZXByZXNlbnRzIGEgcmVtb3RlIGZpbGUgaW4gYSBkaWZmZXJlbnQgd29ya2VyL3RocmVhZC5cbiAqL1xuY2xhc3MgV29ya2VyRmlsZSBleHRlbmRzIHByZWxvYWRfZmlsZS5QcmVsb2FkRmlsZTxXb3JrZXJGUz4ge1xuICBwcml2YXRlIF9yZW1vdGVGZElkOiBudW1iZXI7XG5cbiAgY29uc3RydWN0b3IoX2ZzOiBXb3JrZXJGUywgX3BhdGg6IHN0cmluZywgX2ZsYWc6IGZpbGVfZmxhZy5GaWxlRmxhZywgX3N0YXQ6IFN0YXRzLCByZW1vdGVGZElkOiBudW1iZXIsIGNvbnRlbnRzPzogTm9kZUJ1ZmZlcikge1xuICAgIHN1cGVyKF9mcywgX3BhdGgsIF9mbGFnLCBfc3RhdCwgY29udGVudHMpO1xuICAgIHRoaXMuX3JlbW90ZUZkSWQgPSByZW1vdGVGZElkO1xuICB9XG5cbiAgcHVibGljIGdldFJlbW90ZUZkSWQoKSB7XG4gICAgcmV0dXJuIHRoaXMuX3JlbW90ZUZkSWQ7XG4gIH1cblxuICBwdWJsaWMgdG9SZW1vdGVBcmcoKTogSUZpbGVEZXNjcmlwdG9yQXJndW1lbnQge1xuICAgIHJldHVybiA8SUZpbGVEZXNjcmlwdG9yQXJndW1lbnQ+IHtcbiAgICAgIHR5cGU6IFNwZWNpYWxBcmdUeXBlLkZELFxuICAgICAgaWQ6IHRoaXMuX3JlbW90ZUZkSWQsXG4gICAgICBkYXRhOiBidWZmZXJUb1RyYW5zZmVycmFibGVPYmplY3QodGhpcy5nZXRCdWZmZXIoKSksXG4gICAgICBzdGF0OiBidWZmZXJUb1RyYW5zZmVycmFibGVPYmplY3QodGhpcy5nZXRTdGF0cygpLnRvQnVmZmVyKCkpLFxuICAgICAgcGF0aDogdGhpcy5nZXRQYXRoKCksXG4gICAgICBmbGFnOiB0aGlzLmdldEZsYWcoKS5nZXRGbGFnU3RyaW5nKClcbiAgICB9O1xuICB9XG5cbiAgcHJpdmF0ZSBfc3luY0Nsb3NlKHR5cGU6IHN0cmluZywgY2I6IChlPzogQXBpRXJyb3IpID0+IHZvaWQpOiB2b2lkIHtcbiAgICBpZiAodGhpcy5pc0RpcnR5KCkpIHtcbiAgICAgICg8V29ya2VyRlM+IHRoaXMuX2ZzKS5zeW5jQ2xvc2UodHlwZSwgdGhpcywgKGU/OiBBcGlFcnJvcikgPT4ge1xuICAgICAgICBpZiAoIWUpIHtcbiAgICAgICAgICB0aGlzLnJlc2V0RGlydHkoKTtcbiAgICAgICAgfVxuICAgICAgICBjYihlKTtcbiAgICAgIH0pO1xuICAgIH0gZWxzZSB7XG4gICAgICBjYigpO1xuICAgIH1cbiAgfVxuXG4gIHB1YmxpYyBzeW5jKGNiOiAoZT86IEFwaUVycm9yKSA9PiB2b2lkKTogdm9pZCB7XG4gICAgdGhpcy5fc3luY0Nsb3NlKCdzeW5jJywgY2IpO1xuICB9XG5cbiAgcHVibGljIGNsb3NlKGNiOiAoZT86IEFwaUVycm9yKSA9PiB2b2lkKTogdm9pZCB7XG4gICAgdGhpcy5fc3luY0Nsb3NlKCdjbG9zZScsIGNiKTtcbiAgfVxufVxuXG4vKipcbiAqIFdvcmtlckZTIGxldHMgeW91IGFjY2VzcyBhIEJyb3dzZXJGUyBpbnN0YW5jZSB0aGF0IGlzIHJ1bm5pbmcgaW4gYSBkaWZmZXJlbnRcbiAqIEphdmFTY3JpcHQgY29udGV4dCAoZS5nLiBhY2Nlc3MgQnJvd3NlckZTIGluIG9uZSBvZiB5b3VyIFdlYldvcmtlcnMsIG9yXG4gKiBhY2Nlc3MgQnJvd3NlckZTIHJ1bm5pbmcgb24gdGhlIG1haW4gcGFnZSBmcm9tIGEgV2ViV29ya2VyKS5cbiAqXG4gKiBGb3IgZXhhbXBsZSwgdG8gaGF2ZSBhIFdlYldvcmtlciBhY2Nlc3MgZmlsZXMgaW4gdGhlIG1haW4gYnJvd3NlciB0aHJlYWQsXG4gKiBkbyB0aGUgZm9sbG93aW5nOlxuICpcbiAqIE1BSU4gQlJPV1NFUiBUSFJFQUQ6XG4gKiBgYGBcbiAqICAgLy8gTGlzdGVuIGZvciByZW1vdGUgZmlsZSBzeXN0ZW0gcmVxdWVzdHMuXG4gKiAgIEJyb3dzZXJGUy5GaWxlU3lzdGVtLldvcmtlckZTLmF0dGFjaFJlbW90ZUxpc3RlbmVyKHdlYldvcmtlck9iamVjdCk7XG4gKiBgYFxuICpcbiAqIFdFQldPUktFUiBUSFJFQUQ6XG4gKiBgYGBcbiAqICAgLy8gU2V0IHRoZSByZW1vdGUgZmlsZSBzeXN0ZW0gYXMgdGhlIHJvb3QgZmlsZSBzeXN0ZW0uXG4gKiAgIEJyb3dzZXJGUy5pbml0aWFsaXplKG5ldyBCcm93c2VyRlMuRmlsZVN5c3RlbS5Xb3JrZXJGUyhzZWxmKSk7XG4gKiBgYGBcbiAqXG4gKiBOb3RlIHRoYXQgc3luY2hyb25vdXMgb3BlcmF0aW9ucyBhcmUgbm90IHBlcm1pdHRlZCBvbiB0aGUgV29ya2VyRlMsIHJlZ2FyZGxlc3NcbiAqIG9mIHRoZSBjb25maWd1cmF0aW9uIG9wdGlvbiBvZiB0aGUgcmVtb3RlIEZTLlxuICovXG5leHBvcnQgZGVmYXVsdCBjbGFzcyBXb3JrZXJGUyBleHRlbmRzIGZpbGVfc3lzdGVtLkJhc2VGaWxlU3lzdGVtIGltcGxlbWVudHMgZmlsZV9zeXN0ZW0uRmlsZVN5c3RlbSB7XG4gIHByaXZhdGUgX3dvcmtlcjogV29ya2VyO1xuICBwcml2YXRlIF9jYWxsYmFja0NvbnZlcnRlciA9IG5ldyBDYWxsYmFja0FyZ3VtZW50Q29udmVydGVyKCk7XG5cbiAgcHJpdmF0ZSBfaXNJbml0aWFsaXplZDogYm9vbGVhbiA9IGZhbHNlO1xuICBwcml2YXRlIF9pc1JlYWRPbmx5OiBib29sZWFuID0gZmFsc2U7XG4gIHByaXZhdGUgX3N1cHBvcnRMaW5rczogYm9vbGVhbiA9IGZhbHNlO1xuICBwcml2YXRlIF9zdXBwb3J0UHJvcHM6IGJvb2xlYW4gPSBmYWxzZTtcblxuICAvKipcbiAgICogU3RvcmVzIG91dHN0YW5kaW5nIEFQSSByZXF1ZXN0cyB0byB0aGUgcmVtb3RlIEJyb3dzZXJGUyBpbnN0YW5jZS5cbiAgICovXG4gIHByaXZhdGUgX291dHN0YW5kaW5nUmVxdWVzdHM6IHsgW2lkOiBudW1iZXJdOiAoKSA9PiB2b2lkIH0gPSB7fTtcblxuICAvKipcbiAgICogQ29uc3RydWN0cyBhIG5ldyBXb3JrZXJGUyBpbnN0YW5jZSB0aGF0IGNvbm5lY3RzIHdpdGggQnJvd3NlckZTIHJ1bm5pbmcgb25cbiAgICogdGhlIHNwZWNpZmllZCB3b3JrZXIuXG4gICAqL1xuICBjb25zdHJ1Y3Rvcih3b3JrZXI6IFdvcmtlcikge1xuICAgIHN1cGVyKCk7XG4gICAgdGhpcy5fd29ya2VyID0gd29ya2VyO1xuICAgIHRoaXMuX3dvcmtlci5hZGRFdmVudExpc3RlbmVyKCdtZXNzYWdlJywoZTogTWVzc2FnZUV2ZW50KSA9PiB7XG4gICAgICB2YXIgcmVzcDogT2JqZWN0ID0gZS5kYXRhO1xuICAgICAgaWYgKGlzQVBJUmVzcG9uc2UocmVzcCkpIHtcbiAgICAgICAgdmFyIGk6IG51bWJlciwgYXJncyA9IHJlc3AuYXJncywgZml4ZWRBcmdzID0gbmV3IEFycmF5KGFyZ3MubGVuZ3RoKTtcbiAgICAgICAgLy8gRGlzcGF0Y2ggZXZlbnQgdG8gY29ycmVjdCBpZC5cbiAgICAgICAgZm9yIChpID0gMDsgaSA8IGZpeGVkQXJncy5sZW5ndGg7IGkrKykge1xuICAgICAgICAgIGZpeGVkQXJnc1tpXSA9IHRoaXMuX2FyZ1JlbW90ZTJMb2NhbChhcmdzW2ldKTtcbiAgICAgICAgfVxuICAgICAgICB0aGlzLl9jYWxsYmFja0NvbnZlcnRlci50b0xvY2FsQXJnKHJlc3AuY2JJZCkuYXBwbHkobnVsbCwgZml4ZWRBcmdzKTtcbiAgICAgIH1cbiAgICB9KTtcbiAgfVxuXG4gIHB1YmxpYyBzdGF0aWMgaXNBdmFpbGFibGUoKTogYm9vbGVhbiB7XG4gICAgcmV0dXJuIHR5cGVvZihpbXBvcnRTY3JpcHRzKSAhPT0gJ3VuZGVmaW5lZCcgfHwgdHlwZW9mKFdvcmtlcikgIT09ICd1bmRlZmluZWQnO1xuICB9XG5cbiAgcHVibGljIGdldE5hbWUoKTogc3RyaW5nIHtcbiAgICByZXR1cm4gJ1dvcmtlckZTJztcbiAgfVxuXG4gIHByaXZhdGUgX2FyZ1JlbW90ZTJMb2NhbChhcmc6IGFueSk6IGFueSB7XG4gICAgaWYgKGFyZyA9PSBudWxsKSB7XG4gICAgICByZXR1cm4gYXJnO1xuICAgIH1cbiAgICBzd2l0Y2ggKHR5cGVvZiBhcmcpIHtcbiAgICAgIGNhc2UgJ29iamVjdCc6XG4gICAgICAgIGlmIChhcmdbJ3R5cGUnXSAhPSBudWxsICYmIHR5cGVvZiBhcmdbJ3R5cGUnXSA9PT0gJ251bWJlcicpIHtcbiAgICAgICAgICB2YXIgc3BlY2lhbEFyZyA9IDxJU3BlY2lhbEFyZ3VtZW50PiBhcmc7XG4gICAgICAgICAgc3dpdGNoIChzcGVjaWFsQXJnLnR5cGUpIHtcbiAgICAgICAgICAgIGNhc2UgU3BlY2lhbEFyZ1R5cGUuQVBJX0VSUk9SOlxuICAgICAgICAgICAgICByZXR1cm4gYXBpRXJyb3JSZW1vdGUyTG9jYWwoPElBUElFcnJvckFyZ3VtZW50PiBzcGVjaWFsQXJnKTtcbiAgICAgICAgICAgIGNhc2UgU3BlY2lhbEFyZ1R5cGUuRkQ6XG4gICAgICAgICAgICAgIHZhciBmZEFyZyA9IDxJRmlsZURlc2NyaXB0b3JBcmd1bWVudD4gc3BlY2lhbEFyZztcbiAgICAgICAgICAgICAgcmV0dXJuIG5ldyBXb3JrZXJGaWxlKHRoaXMsIGZkQXJnLnBhdGgsIGZpbGVfZmxhZy5GaWxlRmxhZy5nZXRGaWxlRmxhZyhmZEFyZy5mbGFnKSwgU3RhdHMuZnJvbUJ1ZmZlcih0cmFuc2ZlcnJhYmxlT2JqZWN0VG9CdWZmZXIoZmRBcmcuc3RhdCkpLCBmZEFyZy5pZCwgdHJhbnNmZXJyYWJsZU9iamVjdFRvQnVmZmVyKGZkQXJnLmRhdGEpKTtcbiAgICAgICAgICAgIGNhc2UgU3BlY2lhbEFyZ1R5cGUuU1RBVFM6XG4gICAgICAgICAgICAgIHJldHVybiBzdGF0c1JlbW90ZTJMb2NhbCg8SVN0YXRzQXJndW1lbnQ+IHNwZWNpYWxBcmcpO1xuICAgICAgICAgICAgY2FzZSBTcGVjaWFsQXJnVHlwZS5GSUxFRkxBRzpcbiAgICAgICAgICAgICAgcmV0dXJuIGZpbGVGbGFnUmVtb3RlMkxvY2FsKDxJRmlsZUZsYWdBcmd1bWVudD4gc3BlY2lhbEFyZyk7XG4gICAgICAgICAgICBjYXNlIFNwZWNpYWxBcmdUeXBlLkJVRkZFUjpcbiAgICAgICAgICAgICAgcmV0dXJuIGJ1ZmZlclJlbW90ZTJMb2NhbCg8SUJ1ZmZlckFyZ3VtZW50PiBzcGVjaWFsQXJnKTtcbiAgICAgICAgICAgIGNhc2UgU3BlY2lhbEFyZ1R5cGUuRVJST1I6XG4gICAgICAgICAgICAgIHJldHVybiBlcnJvclJlbW90ZTJMb2NhbCg8SUVycm9yQXJndW1lbnQ+IHNwZWNpYWxBcmcpO1xuICAgICAgICAgICAgZGVmYXVsdDpcbiAgICAgICAgICAgICAgcmV0dXJuIGFyZztcbiAgICAgICAgICB9XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgcmV0dXJuIGFyZztcbiAgICAgICAgfVxuICAgICAgZGVmYXVsdDpcbiAgICAgICAgcmV0dXJuIGFyZztcbiAgICB9XG4gIH1cblxuICAvKipcbiAgICogQ29udmVydHMgYSBsb2NhbCBhcmd1bWVudCBpbnRvIGEgcmVtb3RlIGFyZ3VtZW50LiBQdWJsaWMgc28gV29ya2VyRmlsZSBvYmplY3RzIGNhbiBjYWxsIGl0LlxuICAgKi9cbiAgcHVibGljIF9hcmdMb2NhbDJSZW1vdGUoYXJnOiBhbnkpOiBhbnkge1xuICAgIGlmIChhcmcgPT0gbnVsbCkge1xuICAgICAgcmV0dXJuIGFyZztcbiAgICB9XG4gICAgc3dpdGNoICh0eXBlb2YgYXJnKSB7XG4gICAgICBjYXNlIFwib2JqZWN0XCI6XG4gICAgICAgIGlmIChhcmcgaW5zdGFuY2VvZiBTdGF0cykge1xuICAgICAgICAgIHJldHVybiBzdGF0c0xvY2FsMlJlbW90ZShhcmcpO1xuICAgICAgICB9IGVsc2UgaWYgKGFyZyBpbnN0YW5jZW9mIEFwaUVycm9yKSB7XG4gICAgICAgICAgcmV0dXJuIGFwaUVycm9yTG9jYWwyUmVtb3RlKGFyZyk7XG4gICAgICAgIH0gZWxzZSBpZiAoYXJnIGluc3RhbmNlb2YgV29ya2VyRmlsZSkge1xuICAgICAgICAgIHJldHVybiAoPFdvcmtlckZpbGU+IGFyZykudG9SZW1vdGVBcmcoKTtcbiAgICAgICAgfSBlbHNlIGlmIChhcmcgaW5zdGFuY2VvZiBmaWxlX2ZsYWcuRmlsZUZsYWcpIHtcbiAgICAgICAgICByZXR1cm4gZmlsZUZsYWdMb2NhbDJSZW1vdGUoYXJnKTtcbiAgICAgICAgfSBlbHNlIGlmIChhcmcgaW5zdGFuY2VvZiBCdWZmZXIpIHtcbiAgICAgICAgICByZXR1cm4gYnVmZmVyTG9jYWwyUmVtb3RlKGFyZyk7XG4gICAgICAgIH0gZWxzZSBpZiAoYXJnIGluc3RhbmNlb2YgRXJyb3IpIHtcbiAgICAgICAgICByZXR1cm4gZXJyb3JMb2NhbDJSZW1vdGUoYXJnKTtcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICByZXR1cm4gXCJVbmtub3duIGFyZ3VtZW50XCI7XG4gICAgICAgIH1cbiAgICAgIGNhc2UgXCJmdW5jdGlvblwiOlxuICAgICAgICByZXR1cm4gdGhpcy5fY2FsbGJhY2tDb252ZXJ0ZXIudG9SZW1vdGVBcmcoYXJnKTtcbiAgICAgIGRlZmF1bHQ6XG4gICAgICAgIHJldHVybiBhcmc7XG4gICAgfVxuICB9XG5cbiAgLyoqXG4gICAqIENhbGxlZCBvbmNlIGJvdGggbG9jYWwgYW5kIHJlbW90ZSBzaWRlcyBhcmUgc2V0IHVwLlxuICAgKi9cbiAgcHVibGljIGluaXRpYWxpemUoY2I6ICgpID0+IHZvaWQpOiB2b2lkIHtcbiAgICBpZiAoIXRoaXMuX2lzSW5pdGlhbGl6ZWQpIHtcbiAgICAgIHZhciBtZXNzYWdlOiBJQVBJUmVxdWVzdCA9IHtcbiAgICAgICAgYnJvd3NlcmZzTWVzc2FnZTogdHJ1ZSxcbiAgICAgICAgbWV0aG9kOiAncHJvYmUnLFxuICAgICAgICBhcmdzOiBbdGhpcy5fYXJnTG9jYWwyUmVtb3RlKG5ldyBCdWZmZXIoMCkpLCB0aGlzLl9jYWxsYmFja0NvbnZlcnRlci50b1JlbW90ZUFyZygocHJvYmVSZXNwb25zZTogSVByb2JlUmVzcG9uc2UpID0+IHtcbiAgICAgICAgICB0aGlzLl9pc0luaXRpYWxpemVkID0gdHJ1ZTtcbiAgICAgICAgICB0aGlzLl9pc1JlYWRPbmx5ID0gcHJvYmVSZXNwb25zZS5pc1JlYWRPbmx5O1xuICAgICAgICAgIHRoaXMuX3N1cHBvcnRMaW5rcyA9IHByb2JlUmVzcG9uc2Uuc3VwcG9ydHNMaW5rcztcbiAgICAgICAgICB0aGlzLl9zdXBwb3J0UHJvcHMgPSBwcm9iZVJlc3BvbnNlLnN1cHBvcnRzUHJvcHM7XG4gICAgICAgICAgY2IoKTtcbiAgICAgICAgfSldXG4gICAgICB9O1xuICAgICAgdGhpcy5fd29ya2VyLnBvc3RNZXNzYWdlKG1lc3NhZ2UpO1xuICAgIH0gZWxzZSB7XG4gICAgICBjYigpO1xuICAgIH1cbiAgfVxuXG4gIHB1YmxpYyBpc1JlYWRPbmx5KCk6IGJvb2xlYW4geyByZXR1cm4gdGhpcy5faXNSZWFkT25seTsgfVxuICBwdWJsaWMgc3VwcG9ydHNTeW5jaCgpOiBib29sZWFuIHsgcmV0dXJuIGZhbHNlOyB9XG4gIHB1YmxpYyBzdXBwb3J0c0xpbmtzKCk6IGJvb2xlYW4geyByZXR1cm4gdGhpcy5fc3VwcG9ydExpbmtzOyB9XG4gIHB1YmxpYyBzdXBwb3J0c1Byb3BzKCk6IGJvb2xlYW4geyByZXR1cm4gdGhpcy5fc3VwcG9ydFByb3BzOyB9XG5cbiAgcHJpdmF0ZSBfcnBjKG1ldGhvZE5hbWU6IHN0cmluZywgYXJnczogSUFyZ3VtZW50cykge1xuICAgIHZhciBtZXNzYWdlOiBJQVBJUmVxdWVzdCA9IHtcbiAgICAgIGJyb3dzZXJmc01lc3NhZ2U6IHRydWUsXG4gICAgICBtZXRob2Q6IG1ldGhvZE5hbWUsXG4gICAgICBhcmdzOiBudWxsXG4gICAgfSwgZml4ZWRBcmdzID0gbmV3IEFycmF5KGFyZ3MubGVuZ3RoKSwgaTogbnVtYmVyO1xuICAgIGZvciAoaSA9IDA7IGkgPCBhcmdzLmxlbmd0aDsgaSsrKSB7XG4gICAgICBmaXhlZEFyZ3NbaV0gPSB0aGlzLl9hcmdMb2NhbDJSZW1vdGUoYXJnc1tpXSk7XG4gICAgfVxuICAgIG1lc3NhZ2UuYXJncyA9IGZpeGVkQXJncztcbiAgICB0aGlzLl93b3JrZXIucG9zdE1lc3NhZ2UobWVzc2FnZSk7XG4gIH1cblxuICBwdWJsaWMgcmVuYW1lKG9sZFBhdGg6IHN0cmluZywgbmV3UGF0aDogc3RyaW5nLCBjYjogKGVycj86IEFwaUVycm9yKSA9PiB2b2lkKTogdm9pZCB7XG4gICAgdGhpcy5fcnBjKCdyZW5hbWUnLCBhcmd1bWVudHMpO1xuICB9XG4gIHB1YmxpYyBzdGF0KHA6IHN0cmluZywgaXNMc3RhdDogYm9vbGVhbiwgY2I6IChlcnI6IEFwaUVycm9yLCBzdGF0PzogU3RhdHMpID0+IHZvaWQpOiB2b2lkIHtcbiAgICB0aGlzLl9ycGMoJ3N0YXQnLCBhcmd1bWVudHMpO1xuICB9XG4gIHB1YmxpYyBvcGVuKHA6IHN0cmluZywgZmxhZzogZmlsZV9mbGFnLkZpbGVGbGFnLCBtb2RlOiBudW1iZXIsIGNiOiAoZXJyOiBBcGlFcnJvciwgZmQ/OiBmaWxlLkZpbGUpID0+IGFueSk6IHZvaWQge1xuICAgIHRoaXMuX3JwYygnb3BlbicsIGFyZ3VtZW50cyk7XG4gIH1cbiAgcHVibGljIHVubGluayhwOiBzdHJpbmcsIGNiOiBGdW5jdGlvbik6IHZvaWQge1xuICAgIHRoaXMuX3JwYygndW5saW5rJywgYXJndW1lbnRzKTtcbiAgfVxuICBwdWJsaWMgcm1kaXIocDogc3RyaW5nLCBjYjogRnVuY3Rpb24pOiB2b2lkIHtcbiAgICB0aGlzLl9ycGMoJ3JtZGlyJywgYXJndW1lbnRzKTtcbiAgfVxuICBwdWJsaWMgbWtkaXIocDogc3RyaW5nLCBtb2RlOiBudW1iZXIsIGNiOiBGdW5jdGlvbik6IHZvaWQge1xuICAgIHRoaXMuX3JwYygnbWtkaXInLCBhcmd1bWVudHMpO1xuICB9XG4gIHB1YmxpYyByZWFkZGlyKHA6IHN0cmluZywgY2I6IChlcnI6IEFwaUVycm9yLCBmaWxlcz86IHN0cmluZ1tdKSA9PiB2b2lkKTogdm9pZCB7XG4gICAgdGhpcy5fcnBjKCdyZWFkZGlyJywgYXJndW1lbnRzKTtcbiAgfVxuICBwdWJsaWMgZXhpc3RzKHA6IHN0cmluZywgY2I6IChleGlzdHM6IGJvb2xlYW4pID0+IHZvaWQpOiB2b2lkIHtcbiAgICB0aGlzLl9ycGMoJ2V4aXN0cycsIGFyZ3VtZW50cyk7XG4gIH1cbiAgcHVibGljIHJlYWxwYXRoKHA6IHN0cmluZywgY2FjaGU6IHsgW3BhdGg6IHN0cmluZ106IHN0cmluZyB9LCBjYjogKGVycjogQXBpRXJyb3IsIHJlc29sdmVkUGF0aD86IHN0cmluZykgPT4gYW55KTogdm9pZCB7XG4gICAgdGhpcy5fcnBjKCdyZWFscGF0aCcsIGFyZ3VtZW50cyk7XG4gIH1cbiAgcHVibGljIHRydW5jYXRlKHA6IHN0cmluZywgbGVuOiBudW1iZXIsIGNiOiBGdW5jdGlvbik6IHZvaWQge1xuICAgIHRoaXMuX3JwYygndHJ1bmNhdGUnLCBhcmd1bWVudHMpO1xuICB9XG4gIHB1YmxpYyByZWFkRmlsZShmbmFtZTogc3RyaW5nLCBlbmNvZGluZzogc3RyaW5nLCBmbGFnOiBmaWxlX2ZsYWcuRmlsZUZsYWcsIGNiOiAoZXJyOiBBcGlFcnJvciwgZGF0YT86IGFueSkgPT4gdm9pZCk6IHZvaWQge1xuICAgIHRoaXMuX3JwYygncmVhZEZpbGUnLCBhcmd1bWVudHMpO1xuICB9XG4gIHB1YmxpYyB3cml0ZUZpbGUoZm5hbWU6IHN0cmluZywgZGF0YTogYW55LCBlbmNvZGluZzogc3RyaW5nLCBmbGFnOiBmaWxlX2ZsYWcuRmlsZUZsYWcsIG1vZGU6IG51bWJlciwgY2I6IChlcnI6IEFwaUVycm9yKSA9PiB2b2lkKTogdm9pZCB7XG4gICAgdGhpcy5fcnBjKCd3cml0ZUZpbGUnLCBhcmd1bWVudHMpO1xuICB9XG4gIHB1YmxpYyBhcHBlbmRGaWxlKGZuYW1lOiBzdHJpbmcsIGRhdGE6IGFueSwgZW5jb2Rpbmc6IHN0cmluZywgZmxhZzogZmlsZV9mbGFnLkZpbGVGbGFnLCBtb2RlOiBudW1iZXIsIGNiOiAoZXJyOiBBcGlFcnJvcikgPT4gdm9pZCk6IHZvaWQge1xuICAgIHRoaXMuX3JwYygnYXBwZW5kRmlsZScsIGFyZ3VtZW50cyk7XG4gIH1cbiAgcHVibGljIGNobW9kKHA6IHN0cmluZywgaXNMY2htb2Q6IGJvb2xlYW4sIG1vZGU6IG51bWJlciwgY2I6IEZ1bmN0aW9uKTogdm9pZCB7XG4gICAgdGhpcy5fcnBjKCdjaG1vZCcsIGFyZ3VtZW50cyk7XG4gIH1cbiAgcHVibGljIGNob3duKHA6IHN0cmluZywgaXNMY2hvd246IGJvb2xlYW4sIHVpZDogbnVtYmVyLCBnaWQ6IG51bWJlciwgY2I6IEZ1bmN0aW9uKTogdm9pZCB7XG4gICAgdGhpcy5fcnBjKCdjaG93bicsIGFyZ3VtZW50cyk7XG4gIH1cbiAgcHVibGljIHV0aW1lcyhwOiBzdHJpbmcsIGF0aW1lOiBEYXRlLCBtdGltZTogRGF0ZSwgY2I6IEZ1bmN0aW9uKTogdm9pZCB7XG4gICAgdGhpcy5fcnBjKCd1dGltZXMnLCBhcmd1bWVudHMpO1xuICB9XG4gIHB1YmxpYyBsaW5rKHNyY3BhdGg6IHN0cmluZywgZHN0cGF0aDogc3RyaW5nLCBjYjogRnVuY3Rpb24pOiB2b2lkIHtcbiAgICB0aGlzLl9ycGMoJ2xpbmsnLCBhcmd1bWVudHMpO1xuICB9XG4gIHB1YmxpYyBzeW1saW5rKHNyY3BhdGg6IHN0cmluZywgZHN0cGF0aDogc3RyaW5nLCB0eXBlOiBzdHJpbmcsIGNiOiBGdW5jdGlvbik6IHZvaWQge1xuICAgIHRoaXMuX3JwYygnc3ltbGluaycsIGFyZ3VtZW50cyk7XG4gIH1cbiAgcHVibGljIHJlYWRsaW5rKHA6IHN0cmluZywgY2I6IEZ1bmN0aW9uKTogdm9pZCB7XG4gICAgdGhpcy5fcnBjKCdyZWFkbGluaycsIGFyZ3VtZW50cyk7XG4gIH1cblxuICBwdWJsaWMgc3luY0Nsb3NlKG1ldGhvZDogc3RyaW5nLCBmZDogZmlsZS5GaWxlLCBjYjogKGU6IEFwaUVycm9yKSA9PiB2b2lkKTogdm9pZCB7XG4gICAgdGhpcy5fd29ya2VyLnBvc3RNZXNzYWdlKDxJQVBJUmVxdWVzdD4ge1xuICAgICAgYnJvd3NlcmZzTWVzc2FnZTogdHJ1ZSxcbiAgICAgIG1ldGhvZDogbWV0aG9kLFxuICAgICAgYXJnczogWyg8V29ya2VyRmlsZT4gZmQpLnRvUmVtb3RlQXJnKCksIHRoaXMuX2NhbGxiYWNrQ29udmVydGVyLnRvUmVtb3RlQXJnKGNiKV1cbiAgICB9KTtcbiAgfVxuXG4gIC8qKlxuICAgKiBBdHRhY2hlcyBhIGxpc3RlbmVyIHRvIHRoZSByZW1vdGUgd29ya2VyIGZvciBmaWxlIHN5c3RlbSByZXF1ZXN0cy5cbiAgICovXG4gIHB1YmxpYyBzdGF0aWMgYXR0YWNoUmVtb3RlTGlzdGVuZXIod29ya2VyOiBXb3JrZXIpIHtcbiAgICB2YXIgZmRDb252ZXJ0ZXIgPSBuZXcgRmlsZURlc2NyaXB0b3JBcmd1bWVudENvbnZlcnRlcigpO1xuXG4gICAgZnVuY3Rpb24gYXJnTG9jYWwyUmVtb3RlKGFyZzogYW55LCByZXF1ZXN0QXJnczogYW55W10sIGNiOiAoZXJyOiBBcGlFcnJvciwgYXJnPzogYW55KSA9PiB2b2lkKTogdm9pZCB7XG4gICAgICBzd2l0Y2ggKHR5cGVvZiBhcmcpIHtcbiAgICAgICAgY2FzZSAnb2JqZWN0JzpcbiAgICAgICAgICBpZiAoYXJnIGluc3RhbmNlb2YgU3RhdHMpIHtcbiAgICAgICAgICAgIGNiKG51bGwsIHN0YXRzTG9jYWwyUmVtb3RlKGFyZykpO1xuICAgICAgICAgIH0gZWxzZSBpZiAoYXJnIGluc3RhbmNlb2YgQXBpRXJyb3IpIHtcbiAgICAgICAgICAgIGNiKG51bGwsIGFwaUVycm9yTG9jYWwyUmVtb3RlKGFyZykpO1xuICAgICAgICAgIH0gZWxzZSBpZiAoYXJnIGluc3RhbmNlb2YgZmlsZS5CYXNlRmlsZSkge1xuICAgICAgICAgICAgLy8gUGFzcyBpbiBwIGFuZCBmbGFncyBmcm9tIG9yaWdpbmFsIHJlcXVlc3QuXG4gICAgICAgICAgICBjYihudWxsLCBmZENvbnZlcnRlci50b1JlbW90ZUFyZyhhcmcsIHJlcXVlc3RBcmdzWzBdLCByZXF1ZXN0QXJnc1sxXSwgY2IpKTtcbiAgICAgICAgICB9IGVsc2UgaWYgKGFyZyBpbnN0YW5jZW9mIGZpbGVfZmxhZy5GaWxlRmxhZykge1xuICAgICAgICAgICAgY2IobnVsbCwgZmlsZUZsYWdMb2NhbDJSZW1vdGUoYXJnKSk7XG4gICAgICAgICAgfSBlbHNlIGlmIChhcmcgaW5zdGFuY2VvZiBCdWZmZXIpIHtcbiAgICAgICAgICAgIGNiKG51bGwsIGJ1ZmZlckxvY2FsMlJlbW90ZShhcmcpKTtcbiAgICAgICAgICB9IGVsc2UgaWYgKGFyZyBpbnN0YW5jZW9mIEVycm9yKSB7XG4gICAgICAgICAgICBjYihudWxsLCBlcnJvckxvY2FsMlJlbW90ZShhcmcpKTtcbiAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgY2IobnVsbCwgYXJnKTtcbiAgICAgICAgICB9XG4gICAgICAgICAgYnJlYWs7XG4gICAgICAgIGRlZmF1bHQ6XG4gICAgICAgICAgY2IobnVsbCwgYXJnKTtcbiAgICAgICAgICBicmVhaztcbiAgICAgIH1cbiAgICB9XG5cbiAgICBmdW5jdGlvbiBhcmdSZW1vdGUyTG9jYWwoYXJnOiBhbnksIGZpeGVkUmVxdWVzdEFyZ3M6IGFueVtdKTogYW55IHtcbiAgICAgIGlmIChhcmcgPT0gbnVsbCkge1xuICAgICAgICByZXR1cm4gYXJnO1xuICAgICAgfVxuICAgICAgc3dpdGNoICh0eXBlb2YgYXJnKSB7XG4gICAgICAgIGNhc2UgJ29iamVjdCc6XG4gICAgICAgICAgaWYgKHR5cGVvZiBhcmdbJ3R5cGUnXSA9PT0gJ251bWJlcicpIHtcbiAgICAgICAgICAgIHZhciBzcGVjaWFsQXJnID0gPElTcGVjaWFsQXJndW1lbnQ+IGFyZztcbiAgICAgICAgICAgIHN3aXRjaCAoc3BlY2lhbEFyZy50eXBlKSB7XG4gICAgICAgICAgICAgIGNhc2UgU3BlY2lhbEFyZ1R5cGUuQ0I6XG4gICAgICAgICAgICAgICAgdmFyIGNiSWQgPSAoPElDYWxsYmFja0FyZ3VtZW50PiBhcmcpLmlkO1xuICAgICAgICAgICAgICAgIHJldHVybiBmdW5jdGlvbigpIHtcbiAgICAgICAgICAgICAgICAgIHZhciBpOiBudW1iZXIsIGZpeGVkQXJncyA9IG5ldyBBcnJheShhcmd1bWVudHMubGVuZ3RoKSxcbiAgICAgICAgICAgICAgICAgICAgbWVzc2FnZTogSUFQSVJlc3BvbnNlLFxuICAgICAgICAgICAgICAgICAgICBjb3VudGRvd24gPSBhcmd1bWVudHMubGVuZ3RoO1xuXG4gICAgICAgICAgICAgICAgICBmdW5jdGlvbiBhYm9ydEFuZFNlbmRFcnJvcihlcnI6IEFwaUVycm9yKSB7XG4gICAgICAgICAgICAgICAgICAgIGlmIChjb3VudGRvd24gPiAwKSB7XG4gICAgICAgICAgICAgICAgICAgICAgY291bnRkb3duID0gLTE7XG4gICAgICAgICAgICAgICAgICAgICAgbWVzc2FnZSA9IHtcbiAgICAgICAgICAgICAgICAgICAgICAgIGJyb3dzZXJmc01lc3NhZ2U6IHRydWUsXG4gICAgICAgICAgICAgICAgICAgICAgICBjYklkOiBjYklkLFxuICAgICAgICAgICAgICAgICAgICAgICAgYXJnczogW2FwaUVycm9yTG9jYWwyUmVtb3RlKGVycildXG4gICAgICAgICAgICAgICAgICAgICAgfTtcbiAgICAgICAgICAgICAgICAgICAgICB3b3JrZXIucG9zdE1lc3NhZ2UobWVzc2FnZSk7XG4gICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgIH1cblxuXG4gICAgICAgICAgICAgICAgICBmb3IgKGkgPSAwOyBpIDwgYXJndW1lbnRzLmxlbmd0aDsgaSsrKSB7XG4gICAgICAgICAgICAgICAgICAgIC8vIENhcHR1cmUgaSBhbmQgYXJndW1lbnQuXG4gICAgICAgICAgICAgICAgICAgICgoaTogbnVtYmVyLCBhcmc6IGFueSkgPT4ge1xuICAgICAgICAgICAgICAgICAgICAgIGFyZ0xvY2FsMlJlbW90ZShhcmcsIGZpeGVkUmVxdWVzdEFyZ3MsIChlcnIsIGZpeGVkQXJnPykgPT4ge1xuICAgICAgICAgICAgICAgICAgICAgICAgZml4ZWRBcmdzW2ldID0gZml4ZWRBcmc7XG4gICAgICAgICAgICAgICAgICAgICAgICBpZiAoZXJyKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgIGFib3J0QW5kU2VuZEVycm9yKGVycik7XG4gICAgICAgICAgICAgICAgICAgICAgICB9IGVsc2UgaWYgKC0tY291bnRkb3duID09PSAwKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgIG1lc3NhZ2UgPSB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgYnJvd3NlcmZzTWVzc2FnZTogdHJ1ZSxcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBjYklkOiBjYklkLFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIGFyZ3M6IGZpeGVkQXJnc1xuICAgICAgICAgICAgICAgICAgICAgICAgICB9O1xuICAgICAgICAgICAgICAgICAgICAgICAgICB3b3JrZXIucG9zdE1lc3NhZ2UobWVzc2FnZSk7XG4gICAgICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICAgICAgfSk7XG4gICAgICAgICAgICAgICAgICAgIH0pKGksIGFyZ3VtZW50c1tpXSk7XG4gICAgICAgICAgICAgICAgICB9XG5cbiAgICAgICAgICAgICAgICAgIGlmIChhcmd1bWVudHMubGVuZ3RoID09PSAwKSB7XG4gICAgICAgICAgICAgICAgICAgIG1lc3NhZ2UgPSB7XG4gICAgICAgICAgICAgICAgICAgICAgYnJvd3NlcmZzTWVzc2FnZTogdHJ1ZSxcbiAgICAgICAgICAgICAgICAgICAgICBjYklkOiBjYklkLFxuICAgICAgICAgICAgICAgICAgICAgIGFyZ3M6IGZpeGVkQXJnc1xuICAgICAgICAgICAgICAgICAgICB9O1xuICAgICAgICAgICAgICAgICAgICB3b3JrZXIucG9zdE1lc3NhZ2UobWVzc2FnZSk7XG4gICAgICAgICAgICAgICAgICB9XG5cbiAgICAgICAgICAgICAgICB9O1xuICAgICAgICAgICAgICBjYXNlIFNwZWNpYWxBcmdUeXBlLkFQSV9FUlJPUjpcbiAgICAgICAgICAgICAgICByZXR1cm4gYXBpRXJyb3JSZW1vdGUyTG9jYWwoPElBUElFcnJvckFyZ3VtZW50PiBzcGVjaWFsQXJnKTtcbiAgICAgICAgICAgICAgY2FzZSBTcGVjaWFsQXJnVHlwZS5TVEFUUzpcbiAgICAgICAgICAgICAgICByZXR1cm4gc3RhdHNSZW1vdGUyTG9jYWwoPElTdGF0c0FyZ3VtZW50PiBzcGVjaWFsQXJnKTtcbiAgICAgICAgICAgICAgY2FzZSBTcGVjaWFsQXJnVHlwZS5GSUxFRkxBRzpcbiAgICAgICAgICAgICAgICByZXR1cm4gZmlsZUZsYWdSZW1vdGUyTG9jYWwoPElGaWxlRmxhZ0FyZ3VtZW50PiBzcGVjaWFsQXJnKTtcbiAgICAgICAgICAgICAgY2FzZSBTcGVjaWFsQXJnVHlwZS5CVUZGRVI6XG4gICAgICAgICAgICAgICAgcmV0dXJuIGJ1ZmZlclJlbW90ZTJMb2NhbCg8SUJ1ZmZlckFyZ3VtZW50PiBzcGVjaWFsQXJnKTtcbiAgICAgICAgICAgICAgY2FzZSBTcGVjaWFsQXJnVHlwZS5FUlJPUjpcbiAgICAgICAgICAgICAgICByZXR1cm4gZXJyb3JSZW1vdGUyTG9jYWwoPElFcnJvckFyZ3VtZW50PiBzcGVjaWFsQXJnKTtcbiAgICAgICAgICAgICAgZGVmYXVsdDpcbiAgICAgICAgICAgICAgICAvLyBObyBpZGVhIHdoYXQgdGhpcyBpcy5cbiAgICAgICAgICAgICAgICByZXR1cm4gYXJnO1xuICAgICAgICAgICAgfVxuICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICByZXR1cm4gYXJnO1xuICAgICAgICAgIH1cbiAgICAgICAgZGVmYXVsdDpcbiAgICAgICAgICByZXR1cm4gYXJnO1xuICAgICAgfVxuICAgIH1cblxuICAgIHdvcmtlci5hZGRFdmVudExpc3RlbmVyKCdtZXNzYWdlJywoZTogTWVzc2FnZUV2ZW50KSA9PiB7XG4gICAgICB2YXIgcmVxdWVzdDogT2JqZWN0ID0gZS5kYXRhO1xuICAgICAgaWYgKGlzQVBJUmVxdWVzdChyZXF1ZXN0KSkge1xuICAgICAgICB2YXIgYXJncyA9IHJlcXVlc3QuYXJncyxcbiAgICAgICAgICBmaXhlZEFyZ3MgPSBuZXcgQXJyYXk8YW55PihhcmdzLmxlbmd0aCksXG4gICAgICAgICAgaTogbnVtYmVyO1xuXG4gICAgICAgIHN3aXRjaCAocmVxdWVzdC5tZXRob2QpIHtcbiAgICAgICAgICBjYXNlICdjbG9zZSc6XG4gICAgICAgICAgY2FzZSAnc3luYyc6XG4gICAgICAgICAgICAoKCkgPT4ge1xuICAgICAgICAgICAgICAvLyBGaWxlIGRlc2NyaXB0b3ItcmVsYXRpdmUgbWV0aG9kcy5cbiAgICAgICAgICAgICAgdmFyIHJlbW90ZUNiID0gPElDYWxsYmFja0FyZ3VtZW50PiBhcmdzWzFdO1xuICAgICAgICAgICAgICBmZENvbnZlcnRlci5hcHBseUZkQVBJUmVxdWVzdChyZXF1ZXN0LCAoZXJyPzogQXBpRXJyb3IpID0+IHtcbiAgICAgICAgICAgICAgICAvLyBTZW5kIHJlc3BvbnNlLlxuICAgICAgICAgICAgICAgIHZhciByZXNwb25zZTogSUFQSVJlc3BvbnNlID0ge1xuICAgICAgICAgICAgICAgICAgYnJvd3NlcmZzTWVzc2FnZTogdHJ1ZSxcbiAgICAgICAgICAgICAgICAgIGNiSWQ6IHJlbW90ZUNiLmlkLFxuICAgICAgICAgICAgICAgICAgYXJnczogZXJyID8gW2FwaUVycm9yTG9jYWwyUmVtb3RlKGVycildIDogW11cbiAgICAgICAgICAgICAgICB9O1xuICAgICAgICAgICAgICAgIHdvcmtlci5wb3N0TWVzc2FnZShyZXNwb25zZSk7XG4gICAgICAgICAgICAgIH0pO1xuICAgICAgICAgICAgfSkoKTtcbiAgICAgICAgICAgIGJyZWFrO1xuICAgICAgICAgIGNhc2UgJ3Byb2JlJzpcbiAgICAgICAgICAgICgoKSA9PiB7XG4gICAgICAgICAgICAgIHZhciByb290RnMgPSA8ZmlsZV9zeXN0ZW0uRmlsZVN5c3RlbT4gZnMuZ2V0Um9vdEZTKCksXG4gICAgICAgICAgICAgICAgcmVtb3RlQ2IgPSA8SUNhbGxiYWNrQXJndW1lbnQ+IGFyZ3NbMV0sXG4gICAgICAgICAgICAgICAgcHJvYmVSZXNwb25zZTogSVByb2JlUmVzcG9uc2UgPSB7XG4gICAgICAgICAgICAgICAgICB0eXBlOiBTcGVjaWFsQXJnVHlwZS5QUk9CRSxcbiAgICAgICAgICAgICAgICAgIGlzUmVhZE9ubHk6IHJvb3RGcy5pc1JlYWRPbmx5KCksXG4gICAgICAgICAgICAgICAgICBzdXBwb3J0c0xpbmtzOiByb290RnMuc3VwcG9ydHNMaW5rcygpLFxuICAgICAgICAgICAgICAgICAgc3VwcG9ydHNQcm9wczogcm9vdEZzLnN1cHBvcnRzUHJvcHMoKVxuICAgICAgICAgICAgICAgIH0sXG4gICAgICAgICAgICAgICAgcmVzcG9uc2U6IElBUElSZXNwb25zZSA9IHtcbiAgICAgICAgICAgICAgICAgIGJyb3dzZXJmc01lc3NhZ2U6IHRydWUsXG4gICAgICAgICAgICAgICAgICBjYklkOiByZW1vdGVDYi5pZCxcbiAgICAgICAgICAgICAgICAgIGFyZ3M6IFtwcm9iZVJlc3BvbnNlXVxuICAgICAgICAgICAgICAgIH07XG5cbiAgICAgICAgICAgICAgd29ya2VyLnBvc3RNZXNzYWdlKHJlc3BvbnNlKTtcbiAgICAgICAgICAgIH0pKCk7XG4gICAgICAgICAgICBicmVhaztcbiAgICAgICAgICBkZWZhdWx0OlxuICAgICAgICAgICAgLy8gRmlsZSBzeXN0ZW0gbWV0aG9kcy5cbiAgICAgICAgICAgIGZvciAoaSA9IDA7IGkgPCBhcmdzLmxlbmd0aDsgaSsrKSB7XG4gICAgICAgICAgICAgIGZpeGVkQXJnc1tpXSA9IGFyZ1JlbW90ZTJMb2NhbChhcmdzW2ldLCBmaXhlZEFyZ3MpO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgdmFyIHJvb3RGUyA9IGZzLmdldFJvb3RGUygpO1xuICAgICAgICAgICAgKDxGdW5jdGlvbj4gcm9vdEZTW3JlcXVlc3QubWV0aG9kXSkuYXBwbHkocm9vdEZTLCBmaXhlZEFyZ3MpO1xuICAgICAgICAgICAgYnJlYWs7XG4gICAgICAgIH1cbiAgICAgIH1cbiAgICB9KTtcbiAgfVxufVxuIl19