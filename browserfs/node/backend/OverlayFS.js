"use strict";
var __extends = (this && this.__extends) || function (d, b) {
    for (var p in b) if (b.hasOwnProperty(p)) d[p] = b[p];
    function __() { this.constructor = d; }
    d.prototype = b === null ? Object.create(b) : (__.prototype = b.prototype, new __());
};
var file_system_1 = require('../core/file_system');
var api_error_1 = require('../core/api_error');
var file_flag_1 = require('../core/file_flag');
var preload_file_1 = require('../generic/preload_file');
var locked_fs_1 = require('../generic/locked_fs');
var path = require('path');
var deletionLogPath = '/.deletedFiles.log';
function makeModeWritable(mode) {
    return 146 | mode;
}
function getFlag(f) {
    return file_flag_1.FileFlag.getFileFlag(f);
}
var OverlayFile = (function (_super) {
    __extends(OverlayFile, _super);
    function OverlayFile(fs, path, flag, stats, data) {
        _super.call(this, fs, path, flag, stats, data);
    }
    OverlayFile.prototype.sync = function (cb) {
        var _this = this;
        if (!this.isDirty()) {
            cb(null);
            return;
        }
        this._fs._syncAsync(this, function (err) {
            _this.resetDirty();
            cb(err);
        });
    };
    OverlayFile.prototype.syncSync = function () {
        if (this.isDirty()) {
            this._fs._syncSync(this);
            this.resetDirty();
        }
    };
    OverlayFile.prototype.close = function (cb) {
        this.sync(cb);
    };
    OverlayFile.prototype.closeSync = function () {
        this.syncSync();
    };
    return OverlayFile;
}(preload_file_1.PreloadFile));
var UnlockedOverlayFS = (function (_super) {
    __extends(UnlockedOverlayFS, _super);
    function UnlockedOverlayFS(writable, readable) {
        _super.call(this);
        this._isInitialized = false;
        this._initializeCallbacks = [];
        this._deletedFiles = {};
        this._deleteLog = null;
        this._writable = writable;
        this._readable = readable;
        if (this._writable.isReadOnly()) {
            throw new api_error_1.ApiError(api_error_1.ErrorCode.EINVAL, "Writable file system must be writable.");
        }
    }
    UnlockedOverlayFS.prototype.checkInitialized = function () {
        if (!this._isInitialized) {
            throw new api_error_1.ApiError(api_error_1.ErrorCode.EPERM, "OverlayFS is not initialized. Please initialize OverlayFS using its initialize() method before using it.");
        }
    };
    UnlockedOverlayFS.prototype.checkInitAsync = function (cb) {
        if (!this._isInitialized) {
            cb(new api_error_1.ApiError(api_error_1.ErrorCode.EPERM, "OverlayFS is not initialized. Please initialize OverlayFS using its initialize() method before using it."));
            return false;
        }
        return true;
    };
    UnlockedOverlayFS.prototype.getOverlayedFileSystems = function () {
        return {
            readable: this._readable,
            writable: this._writable
        };
    };
    UnlockedOverlayFS.prototype.createParentDirectoriesAsync = function (p, cb) {
        var parent = path.dirname(p);
        var toCreate = [];
        var _this = this;
        this._writable.stat(parent, false, statDone);
        function statDone(err, stat) {
            if (err) {
                toCreate.push(parent);
                parent = path.dirname(parent);
                _this._writable.stat(parent, false, statDone);
            }
            else {
                createParents();
            }
        }
        function createParents() {
            if (!toCreate.length) {
                return cb();
            }
            var dir = toCreate.pop();
            _this._readable.stat(dir, false, function (err, stats) {
                if (!stats) {
                    return cb();
                }
                _this._writable.mkdir(dir, stats.mode, function (err) {
                    if (err) {
                        return cb(err);
                    }
                    createParents();
                });
            });
        }
    };
    UnlockedOverlayFS.prototype.createParentDirectories = function (p) {
        var _this = this;
        var parent = path.dirname(p), toCreate = [];
        while (!this._writable.existsSync(parent)) {
            toCreate.push(parent);
            parent = path.dirname(parent);
        }
        toCreate = toCreate.reverse();
        toCreate.forEach(function (p) {
            _this._writable.mkdirSync(p, _this.statSync(p, false).mode);
        });
    };
    UnlockedOverlayFS.isAvailable = function () {
        return true;
    };
    UnlockedOverlayFS.prototype._syncAsync = function (file, cb) {
        var _this = this;
        this.createParentDirectoriesAsync(file.getPath(), function (err) {
            if (err) {
                return cb(err);
            }
            _this._writable.writeFile(file.getPath(), file.getBuffer(), null, getFlag('w'), file.getStats().mode, cb);
        });
    };
    UnlockedOverlayFS.prototype._syncSync = function (file) {
        this.createParentDirectories(file.getPath());
        this._writable.writeFileSync(file.getPath(), file.getBuffer(), null, getFlag('w'), file.getStats().mode);
    };
    UnlockedOverlayFS.prototype.getName = function () {
        return "OverlayFS";
    };
    UnlockedOverlayFS.prototype.initialize = function (cb) {
        var _this = this;
        var callbackArray = this._initializeCallbacks;
        var end = function (e) {
            _this._isInitialized = !e;
            _this._initializeCallbacks = [];
            callbackArray.forEach((function (cb) { return cb(e); }));
        };
        if (this._isInitialized) {
            return cb();
        }
        callbackArray.push(cb);
        if (callbackArray.length !== 1) {
            return;
        }
        this._writable.readFile(deletionLogPath, 'utf8', getFlag('r'), function (err, data) {
            if (err) {
                if (err.errno !== api_error_1.ErrorCode.ENOENT) {
                    return end(err);
                }
            }
            else {
                data.split('\n').forEach(function (path) {
                    _this._deletedFiles[path.slice(1)] = path.slice(0, 1) === 'd';
                });
            }
            _this._writable.open(deletionLogPath, getFlag('a'), 420, function (err, fd) {
                if (!err) {
                    _this._deleteLog = fd;
                }
                end(err);
            });
        });
    };
    UnlockedOverlayFS.prototype.isReadOnly = function () { return false; };
    UnlockedOverlayFS.prototype.supportsSynch = function () { return this._readable.supportsSynch() && this._writable.supportsSynch(); };
    UnlockedOverlayFS.prototype.supportsLinks = function () { return false; };
    UnlockedOverlayFS.prototype.supportsProps = function () { return this._readable.supportsProps() && this._writable.supportsProps(); };
    UnlockedOverlayFS.prototype.deletePath = function (p) {
        this._deletedFiles[p] = true;
        var buff = new Buffer("d" + p + "\n");
        this._deleteLog.writeSync(buff, 0, buff.length, null);
        this._deleteLog.syncSync();
    };
    UnlockedOverlayFS.prototype.undeletePath = function (p) {
        if (this._deletedFiles[p]) {
            this._deletedFiles[p] = false;
            var buff = new Buffer("u" + p);
            this._deleteLog.writeSync(buff, 0, buff.length, null);
            this._deleteLog.syncSync();
        }
    };
    UnlockedOverlayFS.prototype.rename = function (oldPath, newPath, cb) {
        var _this = this;
        if (!this.checkInitAsync(cb))
            return;
        if (oldPath === newPath) {
            return cb();
        }
        this.stat(oldPath, false, function (oldErr, oldStats) {
            if (oldErr) {
                return cb(oldErr);
            }
            return _this.stat(newPath, false, function (newErr, newStats) {
                function copyDirContents(files) {
                    var file = files.shift();
                    if (!file) {
                        return cb();
                    }
                    var oldFile = path.resolve(oldPath, file);
                    var newFile = path.resolve(newPath, file);
                    this.rename(oldFile, newFile, function (err) {
                        if (err) {
                            return cb(err);
                        }
                        copyDirContents(files);
                    });
                }
                var mode = 511;
                if (oldStats.isDirectory()) {
                    if (newErr) {
                        if (newErr.errno !== api_error_1.ErrorCode.ENOENT) {
                            return cb(newErr);
                        }
                        return _this._writable.exists(oldPath, function (exists) {
                            if (exists) {
                                return _this._writable.rename(oldPath, newPath, cb);
                            }
                            _this._writable.mkdir(newPath, mode, function (mkdirErr) {
                                if (mkdirErr) {
                                    return cb(mkdirErr);
                                }
                                _this._readable.readdir(oldPath, function (err, files) {
                                    if (err) {
                                        return cb();
                                    }
                                    copyDirContents(files);
                                });
                            });
                        });
                    }
                    mode = newStats.mode;
                    if (!newStats.isDirectory()) {
                        return cb(api_error_1.ApiError.ENOTDIR(newPath));
                    }
                    _this.readdir(newPath, function (readdirErr, files) {
                        if (files && files.length) {
                            return cb(api_error_1.ApiError.ENOTEMPTY(newPath));
                        }
                        _this._readable.readdir(oldPath, function (err, files) {
                            if (err) {
                                return cb();
                            }
                            copyDirContents(files);
                        });
                    });
                }
                if (newStats && newStats.isDirectory()) {
                    return cb(api_error_1.ApiError.EISDIR(newPath));
                }
                _this.readFile(oldPath, null, getFlag('r'), function (err, data) {
                    if (err) {
                        return cb(err);
                    }
                    return _this.writeFile(newPath, data, null, getFlag('w'), oldStats.mode, function (err) {
                        if (err) {
                            return cb(err);
                        }
                        return _this.unlink(oldPath, cb);
                    });
                });
            });
        });
    };
    UnlockedOverlayFS.prototype.renameSync = function (oldPath, newPath) {
        var _this = this;
        this.checkInitialized();
        var oldStats = this.statSync(oldPath, false);
        if (oldStats.isDirectory()) {
            if (oldPath === newPath) {
                return;
            }
            var mode = 511;
            if (this.existsSync(newPath)) {
                var stats = this.statSync(newPath, false), mode = stats.mode;
                if (stats.isDirectory()) {
                    if (this.readdirSync(newPath).length > 0) {
                        throw api_error_1.ApiError.ENOTEMPTY(newPath);
                    }
                }
                else {
                    throw api_error_1.ApiError.ENOTDIR(newPath);
                }
            }
            if (this._writable.existsSync(oldPath)) {
                this._writable.renameSync(oldPath, newPath);
            }
            else if (!this._writable.existsSync(newPath)) {
                this._writable.mkdirSync(newPath, mode);
            }
            if (this._readable.existsSync(oldPath)) {
                this._readable.readdirSync(oldPath).forEach(function (name) {
                    _this.renameSync(path.resolve(oldPath, name), path.resolve(newPath, name));
                });
            }
        }
        else {
            if (this.existsSync(newPath) && this.statSync(newPath, false).isDirectory()) {
                throw api_error_1.ApiError.EISDIR(newPath);
            }
            this.writeFileSync(newPath, this.readFileSync(oldPath, null, getFlag('r')), null, getFlag('w'), oldStats.mode);
        }
        if (oldPath !== newPath && this.existsSync(oldPath)) {
            this.unlinkSync(oldPath);
        }
    };
    UnlockedOverlayFS.prototype.stat = function (p, isLstat, cb) {
        var _this = this;
        if (!this.checkInitAsync(cb))
            return;
        this._writable.stat(p, isLstat, function (err, stat) {
            if (err && err.errno === api_error_1.ErrorCode.ENOENT) {
                if (_this._deletedFiles[p]) {
                    cb(api_error_1.ApiError.ENOENT(p));
                }
                _this._readable.stat(p, isLstat, function (err, stat) {
                    if (stat) {
                        stat = stat.clone();
                        stat.mode = makeModeWritable(stat.mode);
                    }
                    cb(err, stat);
                });
            }
            else {
                cb(err, stat);
            }
        });
    };
    UnlockedOverlayFS.prototype.statSync = function (p, isLstat) {
        this.checkInitialized();
        try {
            return this._writable.statSync(p, isLstat);
        }
        catch (e) {
            if (this._deletedFiles[p]) {
                throw api_error_1.ApiError.ENOENT(p);
            }
            var oldStat = this._readable.statSync(p, isLstat).clone();
            oldStat.mode = makeModeWritable(oldStat.mode);
            return oldStat;
        }
    };
    UnlockedOverlayFS.prototype.open = function (p, flag, mode, cb) {
        var _this = this;
        if (!this.checkInitAsync(cb))
            return;
        this.stat(p, false, function (err, stats) {
            if (stats) {
                switch (flag.pathExistsAction()) {
                    case file_flag_1.ActionType.TRUNCATE_FILE:
                        return _this.createParentDirectoriesAsync(p, function (err) {
                            if (err) {
                                return cb(err);
                            }
                            _this._writable.open(p, flag, mode, cb);
                        });
                    case file_flag_1.ActionType.NOP:
                        return _this._writable.exists(p, function (exists) {
                            if (exists) {
                                _this._writable.open(p, flag, mode, cb);
                            }
                            else {
                                stats = stats.clone();
                                stats.mode = mode;
                                _this._readable.readFile(p, null, getFlag('r'), function (readFileErr, data) {
                                    if (readFileErr) {
                                        return cb(readFileErr);
                                    }
                                    if (stats.size === -1) {
                                        stats.size = data.length;
                                    }
                                    var f = new OverlayFile(_this, p, flag, stats, data);
                                    cb(null, f);
                                });
                            }
                        });
                    default:
                        return cb(api_error_1.ApiError.EEXIST(p));
                }
            }
            else {
                switch (flag.pathNotExistsAction()) {
                    case file_flag_1.ActionType.CREATE_FILE:
                        return _this.createParentDirectoriesAsync(p, function (err) {
                            if (err) {
                                return cb(err);
                            }
                            return _this._writable.open(p, flag, mode, cb);
                        });
                    default:
                        return cb(api_error_1.ApiError.ENOENT(p));
                }
            }
        });
    };
    UnlockedOverlayFS.prototype.openSync = function (p, flag, mode) {
        this.checkInitialized();
        if (this.existsSync(p)) {
            switch (flag.pathExistsAction()) {
                case file_flag_1.ActionType.TRUNCATE_FILE:
                    this.createParentDirectories(p);
                    return this._writable.openSync(p, flag, mode);
                case file_flag_1.ActionType.NOP:
                    if (this._writable.existsSync(p)) {
                        return this._writable.openSync(p, flag, mode);
                    }
                    else {
                        var stats = this._readable.statSync(p, false).clone();
                        stats.mode = mode;
                        return new OverlayFile(this, p, flag, stats, this._readable.readFileSync(p, null, getFlag('r')));
                    }
                default:
                    throw api_error_1.ApiError.EEXIST(p);
            }
        }
        else {
            switch (flag.pathNotExistsAction()) {
                case file_flag_1.ActionType.CREATE_FILE:
                    this.createParentDirectories(p);
                    return this._writable.openSync(p, flag, mode);
                default:
                    throw api_error_1.ApiError.ENOENT(p);
            }
        }
    };
    UnlockedOverlayFS.prototype.unlink = function (p, cb) {
        var _this = this;
        if (!this.checkInitAsync(cb))
            return;
        this.exists(p, function (exists) {
            if (!exists)
                return cb(api_error_1.ApiError.ENOENT(p));
            _this._writable.exists(p, function (writableExists) {
                if (writableExists) {
                    return _this._writable.unlink(p, function (err) {
                        if (err) {
                            return cb(err);
                        }
                        _this.exists(p, function (readableExists) {
                            if (readableExists) {
                                _this.deletePath(p);
                            }
                            cb(null);
                        });
                    });
                }
                else {
                    _this.deletePath(p);
                    cb(null);
                }
            });
        });
    };
    UnlockedOverlayFS.prototype.unlinkSync = function (p) {
        this.checkInitialized();
        if (this.existsSync(p)) {
            if (this._writable.existsSync(p)) {
                this._writable.unlinkSync(p);
            }
            if (this.existsSync(p)) {
                this.deletePath(p);
            }
        }
        else {
            throw api_error_1.ApiError.ENOENT(p);
        }
    };
    UnlockedOverlayFS.prototype.rmdir = function (p, cb) {
        var _this = this;
        if (!this.checkInitAsync(cb))
            return;
        var rmdirLower = function () {
            _this.readdir(p, function (err, files) {
                if (err) {
                    return cb(err);
                }
                if (files.length) {
                    return cb(api_error_1.ApiError.ENOTEMPTY(p));
                }
                _this.deletePath(p);
                cb(null);
            });
        };
        this.exists(p, function (exists) {
            if (!exists) {
                return cb(api_error_1.ApiError.ENOENT(p));
            }
            _this._writable.exists(p, function (writableExists) {
                if (writableExists) {
                    _this._writable.rmdir(p, function (err) {
                        if (err) {
                            return cb(err);
                        }
                        _this._readable.exists(p, function (readableExists) {
                            if (readableExists) {
                                rmdirLower();
                            }
                            else {
                                cb();
                            }
                        });
                    });
                }
                else {
                    rmdirLower();
                }
            });
        });
    };
    UnlockedOverlayFS.prototype.rmdirSync = function (p) {
        this.checkInitialized();
        if (this.existsSync(p)) {
            if (this._writable.existsSync(p)) {
                this._writable.rmdirSync(p);
            }
            if (this.existsSync(p)) {
                if (this.readdirSync(p).length > 0) {
                    throw api_error_1.ApiError.ENOTEMPTY(p);
                }
                else {
                    this.deletePath(p);
                }
            }
        }
        else {
            throw api_error_1.ApiError.ENOENT(p);
        }
    };
    UnlockedOverlayFS.prototype.mkdir = function (p, mode, cb) {
        var _this = this;
        if (!this.checkInitAsync(cb))
            return;
        this.exists(p, function (exists) {
            if (exists) {
                return cb(api_error_1.ApiError.EEXIST(p));
            }
            _this.createParentDirectoriesAsync(p, function (err) {
                if (err) {
                    return cb(err);
                }
                _this._writable.mkdir(p, mode, cb);
            });
        });
    };
    UnlockedOverlayFS.prototype.mkdirSync = function (p, mode) {
        this.checkInitialized();
        if (this.existsSync(p)) {
            throw api_error_1.ApiError.EEXIST(p);
        }
        else {
            this.createParentDirectories(p);
            this._writable.mkdirSync(p, mode);
        }
    };
    UnlockedOverlayFS.prototype.readdir = function (p, cb) {
        var _this = this;
        if (!this.checkInitAsync(cb))
            return;
        this.stat(p, false, function (err, dirStats) {
            if (err) {
                return cb(err);
            }
            if (!dirStats.isDirectory()) {
                return cb(api_error_1.ApiError.ENOTDIR(p));
            }
            _this._writable.readdir(p, function (err, wFiles) {
                if (err && err.code !== 'ENOENT') {
                    return cb(err);
                }
                else if (err || !wFiles) {
                    wFiles = [];
                }
                _this._readable.readdir(p, function (err, rFiles) {
                    if (err || !rFiles) {
                        rFiles = [];
                    }
                    var contents = wFiles.concat(rFiles);
                    var seenMap = {};
                    var filtered = contents.filter(function (fPath) {
                        var result = !seenMap[fPath] && !_this._deletedFiles[p + "/" + fPath];
                        seenMap[fPath] = true;
                        return result;
                    });
                    cb(null, filtered);
                });
            });
        });
    };
    UnlockedOverlayFS.prototype.readdirSync = function (p) {
        var _this = this;
        this.checkInitialized();
        var dirStats = this.statSync(p, false);
        if (!dirStats.isDirectory()) {
            throw api_error_1.ApiError.ENOTDIR(p);
        }
        var contents = [];
        try {
            contents = contents.concat(this._writable.readdirSync(p));
        }
        catch (e) {
        }
        try {
            contents = contents.concat(this._readable.readdirSync(p));
        }
        catch (e) {
        }
        var seenMap = {};
        return contents.filter(function (fileP) {
            var result = seenMap[fileP] === undefined && _this._deletedFiles[p + "/" + fileP] !== true;
            seenMap[fileP] = true;
            return result;
        });
    };
    UnlockedOverlayFS.prototype.exists = function (p, cb) {
        var _this = this;
        this.checkInitialized();
        this._writable.exists(p, function (existsWritable) {
            if (existsWritable) {
                return cb(true);
            }
            _this._readable.exists(p, function (existsReadable) {
                cb(existsReadable && _this._deletedFiles[p] !== true);
            });
        });
    };
    UnlockedOverlayFS.prototype.existsSync = function (p) {
        this.checkInitialized();
        return this._writable.existsSync(p) || (this._readable.existsSync(p) && this._deletedFiles[p] !== true);
    };
    UnlockedOverlayFS.prototype.chmod = function (p, isLchmod, mode, cb) {
        var _this = this;
        if (!this.checkInitAsync(cb))
            return;
        this.operateOnWritableAsync(p, function (err) {
            if (err) {
                return cb(err);
            }
            else {
                _this._writable.chmod(p, isLchmod, mode, cb);
            }
        });
    };
    UnlockedOverlayFS.prototype.chmodSync = function (p, isLchmod, mode) {
        var _this = this;
        this.checkInitialized();
        this.operateOnWritable(p, function () {
            _this._writable.chmodSync(p, isLchmod, mode);
        });
    };
    UnlockedOverlayFS.prototype.chown = function (p, isLchmod, uid, gid, cb) {
        var _this = this;
        if (!this.checkInitAsync(cb))
            return;
        this.operateOnWritableAsync(p, function (err) {
            if (err) {
                return cb(err);
            }
            else {
                _this._writable.chown(p, isLchmod, uid, gid, cb);
            }
        });
    };
    UnlockedOverlayFS.prototype.chownSync = function (p, isLchown, uid, gid) {
        var _this = this;
        this.checkInitialized();
        this.operateOnWritable(p, function () {
            _this._writable.chownSync(p, isLchown, uid, gid);
        });
    };
    UnlockedOverlayFS.prototype.utimes = function (p, atime, mtime, cb) {
        var _this = this;
        if (!this.checkInitAsync(cb))
            return;
        this.operateOnWritableAsync(p, function (err) {
            if (err) {
                return cb(err);
            }
            else {
                _this._writable.utimes(p, atime, mtime, cb);
            }
        });
    };
    UnlockedOverlayFS.prototype.utimesSync = function (p, atime, mtime) {
        var _this = this;
        this.checkInitialized();
        this.operateOnWritable(p, function () {
            _this._writable.utimesSync(p, atime, mtime);
        });
    };
    UnlockedOverlayFS.prototype.operateOnWritable = function (p, f) {
        if (this.existsSync(p)) {
            if (!this._writable.existsSync(p)) {
                this.copyToWritable(p);
            }
            f();
        }
        else {
            throw api_error_1.ApiError.ENOENT(p);
        }
    };
    UnlockedOverlayFS.prototype.operateOnWritableAsync = function (p, cb) {
        var _this = this;
        this.exists(p, function (exists) {
            if (!exists) {
                return cb(api_error_1.ApiError.ENOENT(p));
            }
            _this._writable.exists(p, function (existsWritable) {
                if (existsWritable) {
                    cb();
                }
                else {
                    return _this.copyToWritableAsync(p, cb);
                }
            });
        });
    };
    UnlockedOverlayFS.prototype.copyToWritable = function (p) {
        var pStats = this.statSync(p, false);
        if (pStats.isDirectory()) {
            this._writable.mkdirSync(p, pStats.mode);
        }
        else {
            this.writeFileSync(p, this._readable.readFileSync(p, null, getFlag('r')), null, getFlag('w'), this.statSync(p, false).mode);
        }
    };
    UnlockedOverlayFS.prototype.copyToWritableAsync = function (p, cb) {
        var _this = this;
        this.stat(p, false, function (err, pStats) {
            if (err) {
                return cb(err);
            }
            if (pStats.isDirectory()) {
                return _this._writable.mkdir(p, pStats.mode, cb);
            }
            _this._readable.readFile(p, null, getFlag('r'), function (err, data) {
                if (err) {
                    return cb(err);
                }
                _this.writeFile(p, data, null, getFlag('w'), pStats.mode, cb);
            });
        });
    };
    return UnlockedOverlayFS;
}(file_system_1.BaseFileSystem));
exports.UnlockedOverlayFS = UnlockedOverlayFS;
var OverlayFS = (function (_super) {
    __extends(OverlayFS, _super);
    function OverlayFS(writable, readable) {
        _super.call(this, new UnlockedOverlayFS(writable, readable));
    }
    OverlayFS.prototype.initialize = function (cb) {
        _super.prototype.initialize.call(this, cb);
    };
    OverlayFS.isAvailable = function () {
        return UnlockedOverlayFS.isAvailable();
    };
    OverlayFS.prototype.getOverlayedFileSystems = function () {
        return _super.prototype.getFSUnlocked.call(this).getOverlayedFileSystems();
    };
    return OverlayFS;
}(locked_fs_1["default"]));
exports.__esModule = true;
exports["default"] = OverlayFS;
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiT3ZlcmxheUZTLmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXMiOlsiLi4vLi4vLi4vc3JjL2JhY2tlbmQvT3ZlcmxheUZTLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiI7Ozs7OztBQUFBLDRCQUF5QyxxQkFBcUIsQ0FBQyxDQUFBO0FBQy9ELDBCQUFrQyxtQkFBbUIsQ0FBQyxDQUFBO0FBQ3RELDBCQUFtQyxtQkFBbUIsQ0FBQyxDQUFBO0FBSXZELDZCQUEwQix5QkFBeUIsQ0FBQyxDQUFBO0FBQ3BELDBCQUFxQixzQkFBc0IsQ0FBQyxDQUFBO0FBQzVDLElBQU8sSUFBSSxXQUFXLE1BQU0sQ0FBQyxDQUFDO0FBQzlCLElBQUksZUFBZSxHQUFHLG9CQUFvQixDQUFDO0FBSzNDLDBCQUEwQixJQUFZO0lBQ3BDLE1BQU0sQ0FBQyxHQUFLLEdBQUcsSUFBSSxDQUFDO0FBQ3RCLENBQUM7QUFFRCxpQkFBaUIsQ0FBUztJQUN4QixNQUFNLENBQUMsb0JBQVEsQ0FBQyxXQUFXLENBQUMsQ0FBQyxDQUFDLENBQUM7QUFDakMsQ0FBQztBQUtEO0lBQTBCLCtCQUE4QjtJQUN0RCxxQkFBWSxFQUFxQixFQUFFLElBQVksRUFBRSxJQUFjLEVBQUUsS0FBWSxFQUFFLElBQVk7UUFDekYsa0JBQU0sRUFBRSxFQUFFLElBQUksRUFBRSxJQUFJLEVBQUUsS0FBSyxFQUFFLElBQUksQ0FBQyxDQUFDO0lBQ3JDLENBQUM7SUFFTSwwQkFBSSxHQUFYLFVBQVksRUFBMEI7UUFBdEMsaUJBVUM7UUFUQyxFQUFFLENBQUMsQ0FBQyxDQUFDLElBQUksQ0FBQyxPQUFPLEVBQUUsQ0FBQyxDQUFDLENBQUM7WUFDcEIsRUFBRSxDQUFDLElBQUksQ0FBQyxDQUFDO1lBQ1QsTUFBTSxDQUFDO1FBQ1QsQ0FBQztRQUVELElBQUksQ0FBQyxHQUFHLENBQUMsVUFBVSxDQUFDLElBQUksRUFBRSxVQUFDLEdBQWE7WUFDdEMsS0FBSSxDQUFDLFVBQVUsRUFBRSxDQUFDO1lBQ2xCLEVBQUUsQ0FB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QUFDLEFBN3lCRCxDQUF1Qyw0QkFBYyxHQTZ5QnBEO0FBN3lCWSx5QkFBaUIsb0JBNnlCN0IsQ0FBQTtBQUVEO0lBQXVDLDZCQUEyQjtJQUNqRSxtQkFBWSxRQUFvQixFQUFFLFFBQW9CO1FBQ3JELGtCQUFNLElBQUksaUJBQWlCLENBQUMsUUFBUSxFQUFFLFFBQVEsQ0FBQyxDQUFDLENBQUM7SUFDbEQsQ0FBQztJQUVELDhCQUFVLEdBQVYsVUFBVyxFQUE0QjtRQUN0QyxnQkFBSyxDQUFDLFVBQVUsWUFBQyxFQUFFLENBQUMsQ0FBQztJQUN0QixDQUFDO0lBRU0scUJBQVcsR0FBbEI7UUFDQyxNQUFNLENBQUMsaUJBQWlCLENBQUMsV0FBVyxFQUFFLENBQUM7SUFDeEMsQ0FBQztJQUVELDJDQUF1QixHQUF2QjtRQUNDLE1BQU0sQ0FBQyxnQkFBSyxDQUFDLGFBQWEsV0FBRSxDQUFDLHVCQUF1QixFQUFFLENBQUM7SUFDeEQsQ0FBQztJQUNGLGdCQUFDO0FBQUQsQ0FBQyxBQWhCRCxDQUF1QyxzQkFBUSxHQWdCOUM7QUFoQkQ7OEJBZ0JDLENBQUEiLCJzb3VyY2VzQ29udGVudCI6WyJpbXBvcnQge0ZpbGVTeXN0ZW0sIEJhc2VGaWxlU3lzdGVtfSBmcm9tICcuLi9jb3JlL2ZpbGVfc3lzdGVtJztcbmltcG9ydCB7QXBpRXJyb3IsIEVycm9yQ29kZX0gZnJvbSAnLi4vY29yZS9hcGlfZXJyb3InO1xuaW1wb3J0IHtGaWxlRmxhZywgQWN0aW9uVHlwZX0gZnJvbSAnLi4vY29yZS9maWxlX2ZsYWcnO1xuaW1wb3J0IHV0aWwgPSByZXF1aXJlKCcuLi9jb3JlL3V0aWwnKTtcbmltcG9ydCB7RmlsZX0gZnJvbSAnLi4vY29yZS9maWxlJztcbmltcG9ydCB7ZGVmYXVsdCBhcyBTdGF0cywgRmlsZVR5cGV9IGZyb20gJy4uL2NvcmUvbm9kZV9mc19zdGF0cyc7XG5pbXBvcnQge1ByZWxvYWRGaWxlfSBmcm9tICcuLi9nZW5lcmljL3ByZWxvYWRfZmlsZSc7XG5pbXBvcnQgTG9ja2VkRlMgZnJvbSAnLi4vZ2VuZXJpYy9sb2NrZWRfZnMnO1xuaW1wb3J0IHBhdGggPSByZXF1aXJlKCdwYXRoJyk7XG5sZXQgZGVsZXRpb25Mb2dQYXRoID0gJy8uZGVsZXRlZEZpbGVzLmxvZyc7XG5cbi8qKlxuICogR2l2ZW4gYSByZWFkLW9ubHkgbW9kZSwgbWFrZXMgaXQgd3JpdGFibGUuXG4gKi9cbmZ1bmN0aW9uIG1ha2VNb2RlV3JpdGFibGUobW9kZTogbnVtYmVyKTogbnVtYmVyIHtcbiAgcmV0dXJuIDBvMjIyIHwgbW9kZTtcbn1cblxuZnVuY3Rpb24gZ2V0RmxhZyhmOiBzdHJpbmcpOiBGaWxlRmxhZyB7XG4gIHJldHVybiBGaWxlRmxhZy5nZXRGaWxlRmxhZyhmKTtcbn1cblxuLyoqXG4gKiBPdmVybGF5cyBhIFJPIGZpbGUgdG8gbWFrZSBpdCB3cml0YWJsZS5cbiAqL1xuY2xhc3MgT3ZlcmxheUZpbGUgZXh0ZW5kcyBQcmVsb2FkRmlsZTxVbmxvY2tlZE92ZXJsYXlGUz4gaW1wbGVtZW50cyBGaWxlIHtcbiAgY29uc3RydWN0b3IoZnM6IFVubG9ja2VkT3ZlcmxheUZTLCBwYXRoOiBzdHJpbmcsIGZsYWc6IEZpbGVGbGFnLCBzdGF0czogU3RhdHMsIGRhdGE6IEJ1ZmZlcikge1xuICAgIHN1cGVyKGZzLCBwYXRoLCBmbGFnLCBzdGF0cywgZGF0YSk7XG4gIH1cblxuICBwdWJsaWMgc3luYyhjYjogKGU/OiBBcGlFcnJvcikgPT4gdm9pZCk6IHZvaWQge1xuICAgIGlmICghdGhpcy5pc0RpcnR5KCkpIHtcbiAgICAgIGNiKG51bGwpO1xuICAgICAgcmV0dXJuO1xuICAgIH1cblxuICAgIHRoaXMuX2ZzLl9zeW5jQXN5bmModGhpcywgKGVycjogQXBpRXJyb3IpID0+IHtcbiAgICAgIHRoaXMucmVzZXREaXJ0eSgpO1xuICAgICAgY2IoZXJyKTtcbiAgICB9KTtcbiAgfVxuXG4gIHB1YmxpYyBzeW5jU3luYygpOiB2b2lkIHtcbiAgICBpZiAodGhpcy5pc0RpcnR5KCkpIHtcbiAgICAgIHRoaXMuX2ZzLl9zeW5jU3luYyh0aGlzKTtcbiAgICAgIHRoaXMucmVzZXREaXJ0eSgpO1xuICAgIH1cbiAgfVxuXG4gIHB1YmxpYyBjbG9zZShjYjogKGU/OiBBcGlFcnJvcikgPT4gdm9pZCk6IHZvaWQge1xuICAgIHRoaXMuc3luYyhjYik7XG4gIH1cblxuICBwdWJsaWMgY2xvc2VTeW5jKCk6IHZvaWQge1xuICAgIHRoaXMuc3luY1N5bmMoKTtcbiAgfVxufVxuXG4vKipcbiAqIE92ZXJsYXlGUyBtYWtlcyBhIHJlYWQtb25seSBmaWxlc3lzdGVtIHdyaXRhYmxlIGJ5IHN0b3Jpbmcgd3JpdGVzIG9uIGEgc2Vjb25kLFxuICogd3JpdGFibGUgZmlsZSBzeXN0ZW0uIERlbGV0ZXMgYXJlIHBlcnNpc3RlZCB2aWEgbWV0YWRhdGEgc3RvcmVkIG9uIHRoZSB3cml0YWJsZVxuICogZmlsZSBzeXN0ZW0uXG4gKi9cbmV4cG9ydCBjbGFzcyBVbmxvY2tlZE92ZXJsYXlGUyBleHRlbmRzIEJhc2VGaWxlU3lzdGVtIGltcGxlbWVudHMgRmlsZVN5c3RlbSB7XG4gIHByaXZhdGUgX3dyaXRhYmxlOiBGaWxlU3lzdGVtO1xuICBwcml2YXRlIF9yZWFkYWJsZTogRmlsZVN5c3RlbTtcbiAgcHJpdmF0ZSBfaXNJbml0aWFsaXplZDogYm9vbGVhbiA9IGZhbHNlO1xuICBwcml2YXRlIF9pbml0aWFsaXplQ2FsbGJhY2tzOiAoKGU/OiBBcGlFcnJvcikgPT4gdm9pZClbXSA9IFtdO1xuICBwcml2YXRlIF9kZWxldGVkRmlsZXM6IHtbcGF0aDogc3RyaW5nXTogYm9vbGVhbn0gPSB7fTtcbiAgcHJpdmF0ZSBfZGVsZXRlTG9nOiBGaWxlID0gbnVsbDtcblxuICBjb25zdHJ1Y3Rvcih3cml0YWJsZTogRmlsZVN5c3RlbSwgcmVhZGFibGU6IEZpbGVTeXN0ZW0pIHtcbiAgICBzdXBlcigpO1xuICAgIHRoaXMuX3dyaXRhYmxlID0gd3JpdGFibGU7XG4gICAgdGhpcy5fcmVhZGFibGUgPSByZWFkYWJsZTtcbiAgICBpZiAodGhpcy5fd3JpdGFibGUuaXNSZWFkT25seSgpKSB7XG4gICAgICB0aHJvdyBuZXcgQXBpRXJyb3IoRXJyb3JDb2RlLkVJTlZBTCwgXCJXcml0YWJsZSBmaWxlIHN5c3RlbSBtdXN0IGJlIHdyaXRhYmxlLlwiKTtcbiAgICB9XG4gIH1cblxuICBwcml2YXRlIGNoZWNrSW5pdGlhbGl6ZWQoKTogdm9pZCB7XG4gICAgaWYgKCF0aGlzLl9pc0luaXRpYWxpemVkKSB7XG4gICAgICB0aHJvdyBuZXcgQXBpRXJyb3IoRXJyb3JDb2RlLkVQRVJNLCBcIk92ZXJsYXlGUyBpcyBub3QgaW5pdGlhbGl6ZWQuIFBsZWFzZSBpbml0aWFsaXplIE92ZXJsYXlGUyB1c2luZyBpdHMgaW5pdGlhbGl6ZSgpIG1ldGhvZCBiZWZvcmUgdXNpbmcgaXQuXCIpO1xuICAgIH1cbiAgfVxuXG4gIHByaXZhdGUgY2hlY2tJbml0QXN5bmMoY2I6IChlPzogQXBpRXJyb3IpID0+IHZvaWQpOiBib29sZWFuIHtcbiAgICBpZiAoIXRoaXMuX2lzSW5pdGlhbGl6ZWQpIHtcbiAgICAgIGNiKG5ldyBBcGlFcnJvcihFcnJvckNvZGUuRVBFUk0sIFwiT3ZlcmxheUZTIGlzIG5vdCBpbml0aWFsaXplZC4gUGxlYXNlIGluaXRpYWxpemUgT3ZlcmxheUZTIHVzaW5nIGl0cyBpbml0aWFsaXplKCkgbWV0aG9kIGJlZm9yZSB1c2luZyBpdC5cIikpO1xuICAgICAgcmV0dXJuIGZhbHNlO1xuICAgIH1cbiAgICByZXR1cm4gdHJ1ZTtcbiAgfVxuXG4gIHB1YmxpYyBnZXRPdmVybGF5ZWRGaWxlU3lzdGVtcygpOiB7IHJlYWRhYmxlOiBGaWxlU3lzdGVtOyB3cml0YWJsZTogRmlsZVN5c3RlbTsgfSB7XG4gICAgcmV0dXJuIHtcbiAgICAgIHJlYWRhYmxlOiB0aGlzLl9yZWFkYWJsZSxcbiAgICAgIHdyaXRhYmxlOiB0aGlzLl93cml0YWJsZVxuICAgIH07XG4gIH1cblxuICBwcml2YXRlIGNyZWF0ZVBhcmVudERpcmVjdG9yaWVzQXN5bmMocDogc3RyaW5nLCBjYjogKGVycj86IEFwaUVycm9yKT0+dm9pZCk6IHZvaWQge1xuICAgIGxldCBwYXJlbnQgPSBwYXRoLmRpcm5hbWUocClcbiAgICBsZXQgdG9DcmVhdGU6IHN0cmluZ1tdID0gW107XG4gICAgbGV0IF90aGlzID0gdGhpcztcblxuICAgIHRoaXMuX3dyaXRhYmxlLnN0YXQocGFyZW50LCBmYWxzZSwgc3RhdERvbmUpO1xuICAgIGZ1bmN0aW9uIHN0YXREb25lKGVycjogQXBpRXJyb3IsIHN0YXQ/OiBTdGF0cyk6IHZvaWQge1xuICAgICAgaWYgKGVycikge1xuICAgICAgICB0b0NyZWF0ZS5wdXNoKHBhcmVudCk7XG4gICAgICAgIHBhcmVudCA9IHBhdGguZGlybmFtZShwYXJlbnQpO1xuICAgICAgICBfdGhpcy5fd3JpdGFibGUuc3RhdChwYXJlbnQsIGZhbHNlLCBzdGF0RG9uZSk7XG4gICAgICB9IGVsc2Uge1xuICAgICAgICBjcmVhdGVQYXJlbnRzKCk7XG4gICAgICB9XG4gICAgfVxuXG4gICAgZnVuY3Rpb24gY3JlYXRlUGFyZW50cygpOiB2b2lkIHtcbiAgICAgIGlmICghdG9DcmVhdGUubGVuZ3RoKSB7XG4gICAgICAgIHJldHVybiBjYigpO1xuICAgICAgfVxuXG4gICAgICBsZXQgZGlyID0gdG9DcmVhdGUucG9wKCk7XG4gICAgICBfdGhpcy5fcmVhZGFibGUuc3RhdChkaXIsIGZhbHNlLCAoZXJyOiBBcGlFcnJvciwgc3RhdHM/OiBTdGF0cykgPT4ge1xuICAgICAgICAvLyBzdG9wIGlmIHdlIGNvdWxkbid0IHJlYWQgdGhlIGRpclxuICAgICAgICBpZiAoIXN0YXRzKSB7XG4gICAgICAgICAgcmV0dXJuIGNiKCk7XG4gICAgICAgIH1cblxuICAgICAgICBfdGhpcy5fd3JpdGFibGUubWtkaXIoZGlyLCBzdGF0cy5tb2RlLCAoZXJyPzogQXBpRXJyb3IpID0+IHtcbiAgICAgICAgICBpZiAoZXJyKSB7XG4gICAgICAgICAgICByZXR1cm4gY2IoZXJyKTtcbiAgICAgICAgICB9XG4gICAgICAgICAgY3JlYXRlUGFyZW50cygpO1xuICAgICAgICB9KTtcbiAgICAgIH0pO1xuICAgIH1cbiAgfVxuXG4gIC8qKlxuICAgKiBXaXRoIHRoZSBnaXZlbiBwYXRoLCBjcmVhdGUgdGhlIG5lZWRlZCBwYXJlbnQgZGlyZWN0b3JpZXMgb24gdGhlIHdyaXRhYmxlIHN0b3JhZ2VcbiAgICogc2hvdWxkIHRoZXkgbm90IGV4aXN0LiBVc2UgbW9kZXMgZnJvbSB0aGUgcmVhZC1vbmx5IHN0b3JhZ2UuXG4gICAqL1xuICBwcml2YXRlIGNyZWF0ZVBhcmVudERpcmVjdG9yaWVzKHA6IHN0cmluZyk6IHZvaWQge1xuICAgIHZhciBwYXJlbnQgPSBwYXRoLmRpcm5hbWUocCksIHRvQ3JlYXRlOiBzdHJpbmdbXSA9IFtdO1xuICAgIHdoaWxlICghdGhpcy5fd3JpdGFibGUuZXhpc3RzU3luYyhwYXJlbnQpKSB7XG4gICAgICB0b0NyZWF0ZS5wdXNoKHBhcmVudCk7XG4gICAgICBwYXJlbnQgPSBwYXRoLmRpcm5hbWUocGFyZW50KTtcbiAgICB9XG4gICAgdG9DcmVhdGUgPSB0b0NyZWF0ZS5yZXZlcnNlKCk7XG5cbiAgICB0b0NyZWF0ZS5mb3JFYWNoKChwOiBzdHJpbmcpID0+IHtcbiAgICAgIHRoaXMuX3dyaXRhYmxlLm1rZGlyU3luYyhwLCB0aGlzLnN0YXRTeW5jKHAsIGZhbHNlKS5tb2RlKTtcbiAgICB9KTtcbiAgfVxuXG4gIHB1YmxpYyBzdGF0aWMgaXNBdmFpbGFibGUoKTogYm9vbGVhbiB7XG4gICAgcmV0dXJuIHRydWU7XG4gIH1cblxuICBwdWJsaWMgX3N5bmNBc3luYyhmaWxlOiBQcmVsb2FkRmlsZTxVbmxvY2tlZE92ZXJsYXlGUz4sIGNiOiAoZXJyOiBBcGlFcnJvcik9PnZvaWQpOiB2b2lkIHtcbiAgICB0aGlzLmNyZWF0ZVBhcmVudERpcmVjdG9yaWVzQXN5bmMoZmlsZS5nZXRQYXRoKCksIChlcnI/OiBBcGlFcnJvcikgPT4ge1xuICAgICAgaWYgKGVycikge1xuICAgICAgICByZXR1cm4gY2IoZXJyKTtcbiAgICAgIH1cbiAgICAgIHRoaXMuX3dyaXRhYmxlLndyaXRlRmlsZShmaWxlLmdldFBhdGgoKSwgZmlsZS5nZXRCdWZmZXIoKSwgbnVsbCwgZ2V0RmxhZygndycpLCBmaWxlLmdldFN0YXRzKCkubW9kZSwgY2IpO1xuICAgIH0pO1xuICB9XG5cbiAgcHVibGljIF9zeW5jU3luYyhmaWxlOiBQcmVsb2FkRmlsZTxVbmxvY2tlZE92ZXJsYXlGUz4pOiB2b2lkIHtcbiAgICB0aGlzLmNyZWF0ZVBhcmVudERpcmVjdG9yaWVzKGZpbGUuZ2V0UGF0aCgpKTtcbiAgICB0aGlzLl93cml0YWJsZS53cml0ZUZpbGVTeW5jKGZpbGUuZ2V0UGF0aCgpLCBmaWxlLmdldEJ1ZmZlcigpLCBudWxsLCBnZXRGbGFnKCd3JyksIGZpbGUuZ2V0U3RhdHMoKS5tb2RlKTtcbiAgfVxuXG4gIHB1YmxpYyBnZXROYW1lKCkge1xuICAgIHJldHVybiBcIk92ZXJsYXlGU1wiO1xuICB9XG5cbiAgLyoqXG4gICAqIENhbGxlZCBvbmNlIHRvIGxvYWQgdXAgbWV0YWRhdGEgc3RvcmVkIG9uIHRoZSB3cml0YWJsZSBmaWxlIHN5c3RlbS5cbiAgICovXG4gIHB1YmxpYyBpbml0aWFsaXplKGNiOiAoZXJyPzogQXBpRXJyb3IpID0+IHZvaWQpOiB2b2lkIHtcbiAgICBjb25zdCBjYWxsYmFja0FycmF5ID0gdGhpcy5faW5pdGlhbGl6ZUNhbGxiYWNrcztcblxuICAgIGNvbnN0IGVuZCA9IChlPzogQXBpRXJyb3IpOiB2b2lkID0+IHtcbiAgICAgIHRoaXMuX2lzSW5pdGlhbGl6ZWQgPSAhZTtcbiAgICAgIHRoaXMuX2luaXRpYWxpemVDYWxsYmFja3MgPSBbXTtcbiAgICAgIGNhbGxiYWNrQXJyYXkuZm9yRWFjaCgoKGNiKSA9PiBjYihlKSkpO1xuICAgIH07XG5cbiAgICAvLyBpZiB3ZSdyZSBhbHJlYWR5IGluaXRpYWxpemVkLCBpbW1lZGlhdGVseSBpbnZva2UgdGhlIGNhbGxiYWNrXG4gICAgaWYgKHRoaXMuX2lzSW5pdGlhbGl6ZWQpIHtcbiAgICAgIHJldHVybiBjYigpO1xuICAgIH1cblxuICAgIGNhbGxiYWNrQXJyYXkucHVzaChjYik7XG4gICAgLy8gVGhlIGZpcnN0IGNhbGwgdG8gaW5pdGlhbGl6ZSBpbml0aWFsaXplcywgdGhlIHJlc3Qgd2FpdCBmb3IgaXQgdG8gY29tcGxldGUuXG4gICAgaWYgKGNhbGxiYWNrQXJyYXkubGVuZ3RoICE9PSAxKSB7XG4gICAgICByZXR1cm47XG4gICAgfVxuXG4gICAgLy8gUmVhZCBkZWxldGlvbiBsb2csIHByb2Nlc3MgaW50byBtZXRhZGF0YS5cbiAgICB0aGlzLl93cml0YWJsZS5yZWFkRmlsZShkZWxldGlvbkxvZ1BhdGgsICd1dGY4JywgZ2V0RmxhZygncicpLCAoZXJyOiBBcGlFcnJvciwgZGF0YT86IHN0cmluZykgPT4ge1xuICAgICAgaWYgKGVycikge1xuICAgICAgICAvLyBFTk9FTlQgPT09IE5ld2x5LWluc3RhbnRpYXRlZCBmaWxlIHN5c3RlbSwgYW5kIHRodXMgZW1wdHkgbG9nLlxuICAgICAgICBpZiAoZXJyLmVycm5vICE9PSBFcnJvckNvZGUuRU5PRU5UKSB7XG4gICAgICAgICAgcmV0dXJuIGVuZChlcnIpO1xuICAgICAgICB9XG4gICAgICB9IGVsc2Uge1xuICAgICAgICBkYXRhLnNwbGl0KCdcXG4nKS5mb3JFYWNoKChwYXRoOiBzdHJpbmcpID0+IHtcbiAgICAgICAgICAvLyBJZiB0aGUgbG9nIGVudHJ5IGJlZ2lucyB3LyAnZCcsIGl0J3MgYSBkZWxldGlvbi4gT3RoZXJ3aXNlLCBpdCdzXG4gICAgICAgICAgLy8gYW4gdW5kZWxldGlvbi5cbiAgICAgICAgICAvLyBUT0RPOiBDbGVhbiB1cCBsb2cgZHVyaW5nIGluaXRpYWxpemF0aW9uIHBoYXNlLlxuICAgICAgICAgIHRoaXMuX2RlbGV0ZWRGaWxlc1twYXRoLnNsaWNlKDEpXSA9IHBhdGguc2xpY2UoMCwgMSkgPT09ICdkJztcbiAgICAgICAgfSk7XG4gICAgICB9XG4gICAgICAvLyBPcGVuIHVwIHRoZSBkZWxldGlvbiBsb2cgZm9yIGFwcGVuZGluZy5cbiAgICAgIHRoaXMuX3dyaXRhYmxlLm9wZW4oZGVsZXRpb25Mb2dQYXRoLCBnZXRGbGFnKCdhJyksIDBvNjQ0LCAoZXJyOiBBcGlFcnJvciwgZmQ/OiBGaWxlKSA9PiB7XG4gICAgICAgIGlmICghZXJyKSB7XG4gICAgICAgICAgdGhpcy5fZGVsZXRlTG9nID0gZmQ7XG4gICAgICAgIH1cbiAgICAgICAgZW5kKGVycik7XG4gICAgICB9KTtcbiAgICB9KTtcbiAgfVxuXG4gIHB1YmxpYyBpc1JlYWRPbmx5KCk6IGJvb2xlYW4geyByZXR1cm4gZmFsc2U7IH1cbiAgcHVibGljIHN1cHBvcnRzU3luY2goKTogYm9vbGVhbiB7IHJldHVybiB0aGlzLl9yZWFkYWJsZS5zdXBwb3J0c1N5bmNoKCkgJiYgdGhpcy5fd3JpdGFibGUuc3VwcG9ydHNTeW5jaCgpOyB9XG4gIHB1YmxpYyBzdXBwb3J0c0xpbmtzKCk6IGJvb2xlYW4geyByZXR1cm4gZmFsc2U7IH1cbiAgcHVibGljIHN1cHBvcnRzUHJvcHMoKTogYm9vbGVhbiB7IHJldHVybiB0aGlzLl9yZWFkYWJsZS5zdXBwb3J0c1Byb3BzKCkgJiYgdGhpcy5fd3JpdGFibGUuc3VwcG9ydHNQcm9wcygpOyB9XG5cbiAgcHJpdmF0ZSBkZWxldGVQYXRoKHA6IHN0cmluZyk6IHZvaWQge1xuICAgIHRoaXMuX2RlbGV0ZWRGaWxlc1twXSA9IHRydWU7XG4gICAgdmFyIGJ1ZmYgPSBuZXcgQnVmZmVyKFwiZFwiICsgcCArIFwiXFxuXCIpO1xuICAgIHRoaXMuX2RlbGV0ZUxvZy53cml0ZVN5bmMoYnVmZiwgMCwgYnVmZi5sZW5ndGgsIG51bGwpO1xuICAgIHRoaXMuX2RlbGV0ZUxvZy5zeW5jU3luYygpO1xuICB9XG5cbiAgcHJpdmF0ZSB1bmRlbGV0ZVBhdGgocDogc3RyaW5nKTogdm9pZCB7XG4gICAgaWYgKHRoaXMuX2RlbGV0ZWRGaWxlc1twXSkge1xuICAgICAgdGhpcy5fZGVsZXRlZEZpbGVzW3BdID0gZmFsc2U7XG4gICAgICB2YXIgYnVmZiA9IG5ldyBCdWZmZXIoXCJ1XCIgKyBwKTtcbiAgICAgIHRoaXMuX2RlbGV0ZUxvZy53cml0ZVN5bmMoYnVmZiwgMCwgYnVmZi5sZW5ndGgsIG51bGwpO1xuICAgICAgdGhpcy5fZGVsZXRlTG9nLnN5bmNTeW5jKCk7XG4gICAgfVxuICB9XG5cbiAgcHVibGljIHJlbmFtZShvbGRQYXRoOiBzdHJpbmcsIG5ld1BhdGg6IHN0cmluZywgY2I6IChlcnI/OiBBcGlFcnJvcikgPT4gdm9pZCk6IHZvaWQge1xuICAgIGlmICghdGhpcy5jaGVja0luaXRBc3luYyhjYikpIHJldHVybjtcbiAgICAvLyBub3RoaW5nIHRvIGRvIGlmIHBhdGhzIG1hdGNoXG4gICAgaWYgKG9sZFBhdGggPT09IG5ld1BhdGgpIHtcbiAgICAgIHJldHVybiBjYigpO1xuICAgIH1cblxuICAgIHRoaXMuc3RhdChvbGRQYXRoLCBmYWxzZSwgKG9sZEVycjogQXBpRXJyb3IsIG9sZFN0YXRzPzogU3RhdHMpID0+IHtcbiAgICAgIGlmIChvbGRFcnIpIHtcbiAgICAgICAgcmV0dXJuIGNiKG9sZEVycik7XG4gICAgICB9XG5cbiAgICAgIHJldHVybiB0aGlzLnN0YXQobmV3UGF0aCwgZmFsc2UsIChuZXdFcnI6IEFwaUVycm9yLCBuZXdTdGF0cz86IFN0YXRzKSA9PiB7XG5cbiAgICAgICAgLy8gcHJlY29uZGl0aW9uOiBib3RoIG9sZFBhdGggYW5kIG5ld1BhdGggZXhpc3QgYW5kIGFyZSBkaXJzLlxuICAgICAgICAvLyBkZWNyZWFzZXM6IHxmaWxlc3xcbiAgICAgICAgLy8gTmVlZCB0byBtb3ZlICpldmVyeSBmaWxlL2ZvbGRlciogY3VycmVudGx5IHN0b3JlZCBvblxuICAgICAgICAvLyByZWFkYWJsZSB0byBpdHMgbmV3IGxvY2F0aW9uIG9uIHdyaXRhYmxlLlxuICAgICAgICBmdW5jdGlvbiBjb3B5RGlyQ29udGVudHMoZmlsZXM6IHN0cmluZ1tdKTogdm9pZCB7XG4gICAgICAgICAgbGV0IGZpbGUgPSBmaWxlcy5zaGlmdCgpO1xuICAgICAgICAgIGlmICghZmlsZSkge1xuICAgICAgICAgICAgcmV0dXJuIGNiKCk7XG4gICAgICAgICAgfVxuXG4gICAgICAgICAgbGV0IG9sZEZpbGUgPSBwYXRoLnJlc29sdmUob2xkUGF0aCwgZmlsZSk7XG4gICAgICAgICAgbGV0IG5ld0ZpbGUgPSBwYXRoLnJlc29sdmUobmV3UGF0aCwgZmlsZSk7XG5cbiAgICAgICAgICAvLyBSZWN1cnNpb24hIFNob3VsZCB3b3JrIGZvciBhbnkgbmVzdGVkIGZpbGVzIC8gZm9sZGVycy5cbiAgICAgICAgICB0aGlzLnJlbmFtZShvbGRGaWxlLCBuZXdGaWxlLCAoZXJyPzogQXBpRXJyb3IpID0+IHtcbiAgICAgICAgICAgIGlmIChlcnIpIHtcbiAgICAgICAgICAgICAgcmV0dXJuIGNiKGVycik7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBjb3B5RGlyQ29udGVudHMoZmlsZXMpO1xuICAgICAgICAgIH0pO1xuICAgICAgICB9XG5cbiAgICAgICAgbGV0IG1vZGUgPSAwbzc3NztcblxuICAgICAgICAvLyBmcm9tIGxpbnV4J3MgcmVuYW1lKDIpIG1hbnBhZ2U6IG9sZHBhdGggY2FuIHNwZWNpZnkgYVxuICAgICAgICAvLyBkaXJlY3RvcnkuICBJbiB0aGlzIGNhc2UsIG5ld3BhdGggbXVzdCBlaXRoZXIgbm90IGV4aXN0LCBvclxuICAgICAgICAvLyBpdCBtdXN0IHNwZWNpZnkgYW4gZW1wdHkgZGlyZWN0b3J5LlxuICAgICAgICBpZiAob2xkU3RhdHMuaXNEaXJlY3RvcnkoKSkge1xuICAgICAgICAgIGlmIChuZXdFcnIpIHtcbiAgICAgICAgICAgIGlmIChuZXdFcnIuZXJybm8gIT09IEVycm9yQ29kZS5FTk9FTlQpIHtcbiAgICAgICAgICAgICAgcmV0dXJuIGNiKG5ld0Vycik7XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIHJldHVybiB0aGlzLl93cml0YWJsZS5leGlzdHMob2xkUGF0aCwgKGV4aXN0czogYm9vbGVhbikgPT4ge1xuICAgICAgICAgICAgICAvLyBzaW1wbGUgY2FzZSAtIGJvdGggb2xkIGFuZCBuZXcgYXJlIG9uIHRoZSB3cml0YWJsZSBsYXllclxuICAgICAgICAgICAgICBpZiAoZXhpc3RzKSB7XG4gICAgICAgICAgICAgICAgcmV0dXJuIHRoaXMuX3dyaXRhYmxlLnJlbmFtZShvbGRQYXRoLCBuZXdQYXRoLCBjYik7XG4gICAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgICB0aGlzLl93cml0YWJsZS5ta2RpcihuZXdQYXRoLCBtb2RlLCAobWtkaXJFcnI/OiBBcGlFcnJvcikgPT4ge1xuICAgICAgICAgICAgICAgIGlmIChta2RpckVycikge1xuICAgICAgICAgICAgICAgICAgcmV0dXJuIGNiKG1rZGlyRXJyKTtcbiAgICAgICAgICAgICAgICB9XG5cbiAgICAgICAgICAgICAgICB0aGlzLl9yZWFkYWJsZS5yZWFkZGlyKG9sZFBhdGgsIChlcnI6IEFwaUVycm9yLCBmaWxlcz86IHN0cmluZ1tdKSA9PiB7XG4gICAgICAgICAgICAgICAgICBpZiAoZXJyKSB7XG4gICAgICAgICAgICAgICAgICAgIHJldHVybiBjYigpO1xuICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgY29weURpckNvbnRlbnRzKGZpbGVzKTtcbiAgICAgICAgICAgICAgICB9KTtcbiAgICAgICAgICAgICAgfSk7XG4gICAgICAgICAgICB9KTtcbiAgICAgICAgICB9XG5cbiAgICAgICAgICBtb2RlID0gbmV3U3RhdHMubW9kZTtcbiAgICAgICAgICBpZiAoIW5ld1N0YXRzLmlzRGlyZWN0b3J5KCkpIHtcbiAgICAgICAgICAgIHJldHVybiBjYihBcGlFcnJvci5FTk9URElSKG5ld1BhdGgpKTtcbiAgICAgICAgICB9XG5cbiAgICAgICAgICB0aGlzLnJlYWRkaXIobmV3UGF0aCwgKHJlYWRkaXJFcnI6IEFwaUVycm9yLCBmaWxlcz86IHN0cmluZ1tdKSA9PiB7XG4gICAgICAgICAgICBpZiAoZmlsZXMgJiYgZmlsZXMubGVuZ3RoKSB7XG4gICAgICAgICAgICAgIHJldHVybiBjYihBcGlFcnJvci5FTk9URU1QVFkobmV3UGF0aCkpO1xuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICB0aGlzLl9yZWFkYWJsZS5yZWFkZGlyKG9sZFBhdGgsIChlcnI6IEFwaUVycm9yLCBmaWxlcz86IHN0cmluZ1tdKSA9PiB7XG4gICAgICAgICAgICAgIGlmIChlcnIpIHtcbiAgICAgICAgICAgICAgICByZXR1cm4gY2IoKTtcbiAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICBjb3B5RGlyQ29udGVudHMoZmlsZXMpO1xuICAgICAgICAgICAgfSk7XG4gICAgICAgICAgfSk7XG4gICAgICAgIH1cblxuICAgICAgICBpZiAobmV3U3RhdHMgJiYgbmV3U3RhdHMuaXNEaXJlY3RvcnkoKSkge1xuICAgICAgICAgIHJldHVybiBjYihBcGlFcnJvci5FSVNESVIobmV3UGF0aCkpO1xuICAgICAgICB9XG5cbiAgICAgICAgdGhpcy5yZWFkRmlsZShvbGRQYXRoLCBudWxsLCBnZXRGbGFnKCdyJyksIChlcnI6IEFwaUVycm9yLCBkYXRhPzogYW55KSA9PiB7XG4gICAgICAgICAgaWYgKGVycikge1xuICAgICAgICAgICAgcmV0dXJuIGNiKGVycik7XG4gICAgICAgICAgfVxuXG4gICAgICAgICAgcmV0dXJuIHRoaXMud3JpdGVGaWxlKG5ld1BhdGgsIGRhdGEsIG51bGwsIGdldEZsYWcoJ3cnKSwgb2xkU3RhdHMubW9kZSwgKGVycjogQXBpRXJyb3IpID0+IHtcbiAgICAgICAgICAgIGlmIChlcnIpIHtcbiAgICAgICAgICAgICAgcmV0dXJuIGNiKGVycik7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICByZXR1cm4gdGhpcy51bmxpbmsob2xkUGF0aCwgY2IpO1xuICAgICAgICAgIH0pO1xuICAgICAgICB9KTtcbiAgICAgIH0pO1xuICAgIH0pO1xuICB9XG5cbiAgcHVibGljIHJlbmFtZVN5bmMob2xkUGF0aDogc3RyaW5nLCBuZXdQYXRoOiBzdHJpbmcpOiB2b2lkIHtcbiAgICB0aGlzLmNoZWNrSW5pdGlhbGl6ZWQoKTtcbiAgICAvLyBXcml0ZSBuZXdQYXRoIHVzaW5nIG9sZFBhdGgncyBjb250ZW50cywgZGVsZXRlIG9sZFBhdGguXG4gICAgdmFyIG9sZFN0YXRzID0gdGhpcy5zdGF0U3luYyhvbGRQYXRoLCBmYWxzZSk7XG4gICAgaWYgKG9sZFN0YXRzLmlzRGlyZWN0b3J5KCkpIHtcbiAgICAgIC8vIE9wdGltaXphdGlvbjogRG9uJ3QgYm90aGVyIG1vdmluZyBpZiBvbGQgPT09IG5ldy5cbiAgICAgIGlmIChvbGRQYXRoID09PSBuZXdQYXRoKSB7XG4gICAgICAgIHJldHVybjtcbiAgICAgIH1cblxuICAgICAgdmFyIG1vZGUgPSAwbzc3NztcbiAgICAgIGlmICh0aGlzLmV4aXN0c1N5bmMobmV3UGF0aCkpIHtcbiAgICAgICAgdmFyIHN0YXRzID0gdGhpcy5zdGF0U3luYyhuZXdQYXRoLCBmYWxzZSksXG4gICAgICAgICAgbW9kZSA9IHN0YXRzLm1vZGU7XG4gICAgICAgIGlmIChzdGF0cy5pc0RpcmVjdG9yeSgpKSB7XG4gICAgICAgICAgaWYgKHRoaXMucmVhZGRpclN5bmMobmV3UGF0aCkubGVuZ3RoID4gMCkge1xuICAgICAgICAgICAgdGhyb3cgQXBpRXJyb3IuRU5PVEVNUFRZKG5ld1BhdGgpO1xuICAgICAgICAgIH1cbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICB0aHJvdyBBcGlFcnJvci5FTk9URElSKG5ld1BhdGgpO1xuICAgICAgICB9XG4gICAgICB9XG5cbiAgICAgIC8vIFRha2UgY2FyZSBvZiB3cml0YWJsZSBmaXJzdC4gTW92ZSBhbnkgZmlsZXMgdGhlcmUsIG9yIGNyZWF0ZSBhbiBlbXB0eSBkaXJlY3RvcnlcbiAgICAgIC8vIGlmIGl0IGRvZXNuJ3QgZXhpc3QuXG4gICAgICBpZiAodGhpcy5fd3JpdGFibGUuZXhpc3RzU3luYyhvbGRQYXRoKSkge1xuICAgICAgICB0aGlzLl93cml0YWJsZS5yZW5hbWVTeW5jKG9sZFBhdGgsIG5ld1BhdGgpO1xuICAgICAgfSBlbHNlIGlmICghdGhpcy5fd3JpdGFibGUuZXhpc3RzU3luYyhuZXdQYXRoKSkge1xuICAgICAgICB0aGlzLl93cml0YWJsZS5ta2RpclN5bmMobmV3UGF0aCwgbW9kZSk7XG4gICAgICB9XG5cbiAgICAgIC8vIE5lZWQgdG8gbW92ZSAqZXZlcnkgZmlsZS9mb2xkZXIqIGN1cnJlbnRseSBzdG9yZWQgb24gcmVhZGFibGUgdG8gaXRzIG5ldyBsb2NhdGlvblxuICAgICAgLy8gb24gd3JpdGFibGUuXG4gICAgICBpZiAodGhpcy5fcmVhZGFibGUuZXhpc3RzU3luYyhvbGRQYXRoKSkge1xuICAgICAgICB0aGlzLl9yZWFkYWJsZS5yZWFkZGlyU3luYyhvbGRQYXRoKS5mb3JFYWNoKChuYW1lKSA9PiB7XG4gICAgICAgICAgLy8gUmVjdXJzaW9uISBTaG91bGQgd29yayBmb3IgYW55IG5lc3RlZCBmaWxlcyAvIGZvbGRlcnMuXG4gICAgICAgICAgdGhpcy5yZW5hbWVTeW5jKHBhdGgucmVzb2x2ZShvbGRQYXRoLCBuYW1lKSwgcGF0aC5yZXNvbHZlKG5ld1BhdGgsIG5hbWUpKTtcbiAgICAgICAgfSk7XG4gICAgICB9XG4gICAgfSBlbHNlIHtcbiAgICAgIGlmICh0aGlzLmV4aXN0c1N5bmMobmV3UGF0aCkgJiYgdGhpcy5zdGF0U3luYyhuZXdQYXRoLCBmYWxzZSkuaXNEaXJlY3RvcnkoKSkge1xuICAgICAgICB0aHJvdyBBcGlFcnJvci5FSVNESVIobmV3UGF0aCk7XG4gICAgICB9XG5cbiAgICAgIHRoaXMud3JpdGVGaWxlU3luYyhuZXdQYXRoLFxuICAgICAgICB0aGlzLnJlYWRGaWxlU3luYyhvbGRQYXRoLCBudWxsLCBnZXRGbGFnKCdyJykpLCBudWxsLCBnZXRGbGFnKCd3JyksIG9sZFN0YXRzLm1vZGUpO1xuICAgIH1cblxuICAgIGlmIChvbGRQYXRoICE9PSBuZXdQYXRoICYmIHRoaXMuZXhpc3RzU3luYyhvbGRQYXRoKSkge1xuICAgICAgdGhpcy51bmxpbmtTeW5jKG9sZFBhdGgpO1xuICAgIH1cbiAgfVxuXG4gIHB1YmxpYyBzdGF0KHA6IHN0cmluZywgaXNMc3RhdDogYm9vbGVhbiwgIGNiOiAoZXJyOiBBcGlFcnJvciwgc3RhdD86IFN0YXRzKSA9PiB2b2lkKTogdm9pZCB7XG4gICAgaWYgKCF0aGlzLmNoZWNrSW5pdEFzeW5jKGNiKSkgcmV0dXJuO1xuICAgIHRoaXMuX3dyaXRhYmxlLnN0YXQocCwgaXNMc3RhdCwgKGVycjogQXBpRXJyb3IsIHN0YXQ/OiBTdGF0cykgPT4ge1xuICAgICAgaWYgKGVyciAmJiBlcnIuZXJybm8gPT09IEVycm9yQ29kZS5FTk9FTlQpIHtcbiAgICAgICAgaWYgKHRoaXMuX2RlbGV0ZWRGaWxlc1twXSkge1xuICAgICAgICAgIGNiKEFwaUVycm9yLkVOT0VOVChwKSk7XG4gICAgICAgIH1cbiAgICAgICAgdGhpcy5fcmVhZGFibGUuc3RhdChwLCBpc0xzdGF0LCAoZXJyOiBBcGlFcnJvciwgc3RhdD86IFN0YXRzKSA9PiB7XG4gICAgICAgICAgaWYgKHN0YXQpIHtcbiAgICAgICAgICAgIC8vIE1ha2UgdGhlIG9sZFN0YXQncyBtb2RlIHdyaXRhYmxlLiBQcmVzZXJ2ZSB0aGUgdG9wbW9zdFxuICAgICAgICAgICAgLy8gcGFydCBvZiB0aGUgbW9kZSwgd2hpY2ggc3BlY2lmaWVzIGlmIGl0IGlzIGEgZmlsZSBvciBhXG4gICAgICAgICAgICAvLyBkaXJlY3RvcnkuXG4gICAgICAgICAgICBzdGF0ID0gc3RhdC5jbG9uZSgpO1xuICAgICAgICAgICAgc3RhdC5tb2RlID0gbWFrZU1vZGVXcml0YWJsZShzdGF0Lm1vZGUpO1xuICAgICAgICAgIH1cbiAgICAgICAgICBjYihlcnIsIHN0YXQpO1xuICAgICAgICB9KTtcbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIGNiKGVyciwgc3RhdCk7XG4gICAgICB9XG4gICAgfSk7XG4gIH1cblxuICBwdWJsaWMgc3RhdFN5bmMocDogc3RyaW5nLCBpc0xzdGF0OiBib29sZWFuKTogU3RhdHMge1xuICAgIHRoaXMuY2hlY2tJbml0aWFsaXplZCgpO1xuICAgIHRyeSB7XG4gICAgICByZXR1cm4gdGhpcy5fd3JpdGFibGUuc3RhdFN5bmMocCwgaXNMc3RhdCk7XG4gICAgfSBjYXRjaCAoZSkge1xuICAgICAgaWYgKHRoaXMuX2RlbGV0ZWRGaWxlc1twXSkge1xuICAgICAgICB0aHJvdyBBcGlFcnJvci5FTk9FTlQocCk7XG4gICAgICB9XG4gICAgICB2YXIgb2xkU3RhdCA9IHRoaXMuX3JlYWRhYmxlLnN0YXRTeW5jKHAsIGlzTHN0YXQpLmNsb25lKCk7XG4gICAgICAvLyBNYWtlIHRoZSBvbGRTdGF0J3MgbW9kZSB3cml0YWJsZS4gUHJlc2VydmUgdGhlIHRvcG1vc3QgcGFydCBvZiB0aGVcbiAgICAgIC8vIG1vZGUsIHdoaWNoIHNwZWNpZmllcyBpZiBpdCBpcyBhIGZpbGUgb3IgYSBkaXJlY3RvcnkuXG4gICAgICBvbGRTdGF0Lm1vZGUgPSBtYWtlTW9kZVdyaXRhYmxlKG9sZFN0YXQubW9kZSk7XG4gICAgICByZXR1cm4gb2xkU3RhdDtcbiAgICB9XG4gIH1cblxuICBwdWJsaWMgb3BlbihwOiBzdHJpbmcsIGZsYWc6IEZpbGVGbGFnLCBtb2RlOiBudW1iZXIsIGNiOiAoZXJyOiBBcGlFcnJvciwgZmQ/OiBGaWxlKSA9PiBhbnkpOiB2b2lkIHtcbiAgICBpZiAoIXRoaXMuY2hlY2tJbml0QXN5bmMoY2IpKSByZXR1cm47XG4gICAgdGhpcy5zdGF0KHAsIGZhbHNlLCAoZXJyOiBBcGlFcnJvciwgc3RhdHM/OiBTdGF0cykgPT4ge1xuICAgICAgaWYgKHN0YXRzKSB7XG4gICAgICAgIHN3aXRjaCAoZmxhZy5wYXRoRXhpc3RzQWN0aW9uKCkpIHtcbiAgICAgICAgY2FzZSBBY3Rpb25UeXBlLlRSVU5DQVRFX0ZJTEU6XG4gICAgICAgICAgcmV0dXJuIHRoaXMuY3JlYXRlUGFyZW50RGlyZWN0b3JpZXNBc3luYyhwLCAoZXJyPzogQXBpRXJyb3IpPT4ge1xuICAgICAgICAgICAgaWYgKGVycikge1xuICAgICAgICAgICAgICByZXR1cm4gY2IoZXJyKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIHRoaXMuX3dyaXRhYmxlLm9wZW4ocCwgZmxhZywgbW9kZSwgY2IpO1xuICAgICAgICAgIH0pO1xuICAgICAgICBjYXNlIEFjdGlvblR5cGUuTk9QOlxuICAgICAgICAgIHJldHVybiB0aGlzLl93cml0YWJsZS5leGlzdHMocCwgKGV4aXN0czogYm9vbGVhbikgPT4ge1xuICAgICAgICAgICAgaWYgKGV4aXN0cykge1xuICAgICAgICAgICAgICB0aGlzLl93cml0YWJsZS5vcGVuKHAsIGZsYWcsIG1vZGUsIGNiKTtcbiAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgIC8vIGF0IHRoaXMgcG9pbnQgd2Uga25vdyB0aGUgc3RhdHMgb2JqZWN0IHdlIGdvdCBpcyBmcm9tXG4gICAgICAgICAgICAgIC8vIHRoZSByZWFkYWJsZSBGUy5cbiAgICAgICAgICAgICAgc3RhdHMgPSBzdGF0cy5jbG9uZSgpO1xuICAgICAgICAgICAgICBzdGF0cy5tb2RlID0gbW9kZTtcbiAgICAgICAgICAgICAgdGhpcy5fcmVhZGFibGUucmVhZEZpbGUocCwgbnVsbCwgZ2V0RmxhZygncicpLCAocmVhZEZpbGVFcnI6IEFwaUVycm9yLCBkYXRhPzogYW55KSA9PiB7XG4gICAgICAgICAgICAgICAgaWYgKHJlYWRGaWxlRXJyKSB7XG4gICAgICAgICAgICAgICAgICByZXR1cm4gY2IocmVhZEZpbGVFcnIpO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICBpZiAoc3RhdHMuc2l6ZSA9PT0gLTEpIHtcbiAgICAgICAgICAgICAgICAgIHN0YXRzLnNpemUgPSBkYXRhLmxlbmd0aDtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgbGV0IGYgPSBuZXcgT3ZlcmxheUZpbGUodGhpcywgcCwgZmxhZywgc3RhdHMsIGRhdGEpO1xuICAgICAgICAgICAgICAgIGNiKG51bGwsIGYpO1xuICAgICAgICAgICAgICB9KTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICB9KTtcbiAgICAgICAgZGVmYXVsdDpcbiAgICAgICAgICByZXR1cm4gY2IoQXBpRXJyb3IuRUVYSVNUKHApKTtcbiAgICAgICAgfVxuICAgICAgfSBlbHNlIHtcbiAgICAgICAgc3dpdGNoKGZsYWcucGF0aE5vdEV4aXN0c0FjdGlvbigpKSB7XG4gICAgICAgIGNhc2UgQWN0aW9uVHlwZS5DUkVBVEVfRklMRTpcbiAgICAgICAgICByZXR1cm4gdGhpcy5jcmVhdGVQYXJlbnREaXJlY3Rvcmllc0FzeW5jKHAsIChlcnI/OiBBcGlFcnJvcikgPT4ge1xuICAgICAgICAgICAgaWYgKGVycikge1xuICAgICAgICAgICAgICByZXR1cm4gY2IoZXJyKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIHJldHVybiB0aGlzLl93cml0YWJsZS5vcGVuKHAsIGZsYWcsIG1vZGUsIGNiKTtcbiAgICAgICAgICB9KTtcbiAgICAgICAgZGVmYXVsdDpcbiAgICAgICAgICByZXR1cm4gY2IoQXBpRXJyb3IuRU5PRU5UKHApKTtcbiAgICAgICAgfVxuICAgICAgfVxuICAgIH0pO1xuICB9XG5cbiAgcHVibGljIG9wZW5TeW5jKHA6IHN0cmluZywgZmxhZzogRmlsZUZsYWcsIG1vZGU6IG51bWJlcik6IEZpbGUge1xuICAgIHRoaXMuY2hlY2tJbml0aWFsaXplZCgpO1xuICAgIGlmICh0aGlzLmV4aXN0c1N5bmMocCkpIHtcbiAgICAgIHN3aXRjaCAoZmxhZy5wYXRoRXhpc3RzQWN0aW9uKCkpIHtcbiAgICAgICAgY2FzZSBBY3Rpb25UeXBlLlRSVU5DQVRFX0ZJTEU6XG4gICAgICAgICAgdGhpcy5jcmVhdGVQYXJlbnREaXJlY3RvcmllcyhwKTtcbiAgICAgICAgICByZXR1cm4gdGhpcy5fd3JpdGFibGUub3BlblN5bmMocCwgZmxhZywgbW9kZSk7XG4gICAgICAgIGNhc2UgQWN0aW9uVHlwZS5OT1A6XG4gICAgICAgICAgaWYgKHRoaXMuX3dyaXRhYmxlLmV4aXN0c1N5bmMocCkpIHtcbiAgICAgICAgICAgIHJldHVybiB0aGlzLl93cml0YWJsZS5vcGVuU3luYyhwLCBmbGFnLCBtb2RlKTtcbiAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgLy8gQ3JlYXRlIGFuIE92ZXJsYXlGaWxlLlxuICAgICAgICAgICAgdmFyIHN0YXRzID0gdGhpcy5fcmVhZGFibGUuc3RhdFN5bmMocCwgZmFsc2UpLmNsb25lKCk7XG4gICAgICAgICAgICBzdGF0cy5tb2RlID0gbW9kZTtcbiAgICAgICAgICAgIHJldHVybiBuZXcgT3ZlcmxheUZpbGUodGhpcywgcCwgZmxhZywgc3RhdHMsIHRoaXMuX3JlYWRhYmxlLnJlYWRGaWxlU3luYyhwLCBudWxsLCBnZXRGbGFnKCdyJykpKTtcbiAgICAgICAgICB9XG4gICAgICAgIGRlZmF1bHQ6XG4gICAgICAgICAgdGhyb3cgQXBpRXJyb3IuRUVYSVNUKHApO1xuICAgICAgfVxuICAgIH0gZWxzZSB7XG4gICAgICBzd2l0Y2goZmxhZy5wYXRoTm90RXhpc3RzQWN0aW9uKCkpIHtcbiAgICAgICAgY2FzZSBBY3Rpb25UeXBlLkNSRUFURV9GSUxFOlxuICAgICAgICAgIHRoaXMuY3JlYXRlUGFyZW50RGlyZWN0b3JpZXMocCk7XG4gICAgICAgICAgcmV0dXJuIHRoaXMuX3dyaXRhYmxlLm9wZW5TeW5jKHAsIGZsYWcsIG1vZGUpO1xuICAgICAgICBkZWZhdWx0OlxuICAgICAgICAgIHRocm93IEFwaUVycm9yLkVOT0VOVChwKTtcbiAgICAgIH1cbiAgICB9XG4gIH1cblxuICBwdWJsaWMgdW5saW5rKHA6IHN0cmluZywgY2I6IChlcnI6IEFwaUVycm9yKSA9PiB2b2lkKTogdm9pZCB7XG4gICAgaWYgKCF0aGlzLmNoZWNrSW5pdEFzeW5jKGNiKSkgcmV0dXJuO1xuICAgIHRoaXMuZXhpc3RzKHAsIChleGlzdHM6IGJvb2xlYW4pID0+IHtcbiAgICAgIGlmICghZXhpc3RzKVxuICAgICAgICByZXR1cm4gY2IoQXBpRXJyb3IuRU5PRU5UKHApKTtcblxuICAgICAgdGhpcy5fd3JpdGFibGUuZXhpc3RzKHAsICh3cml0YWJsZUV4aXN0czogYm9vbGVhbikgPT4ge1xuICAgICAgICBpZiAod3JpdGFibGVFeGlzdHMpIHtcbiAgICAgICAgICByZXR1cm4gdGhpcy5fd3JpdGFibGUudW5saW5rKHAsIChlcnI6IEFwaUVycm9yKSA9PiB7XG4gICAgICAgICAgICBpZiAoZXJyKSB7XG4gICAgICAgICAgICAgIHJldHVybiBjYihlcnIpO1xuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICB0aGlzLmV4aXN0cyhwLCAocmVhZGFibGVFeGlzdHM6IGJvb2xlYW4pID0+IHtcbiAgICAgICAgICAgICAgaWYgKHJlYWRhYmxlRXhpc3RzKSB7XG4gICAgICAgICAgICAgICAgdGhpcy5kZWxldGVQYXRoKHApO1xuICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgIGNiKG51bGwpO1xuICAgICAgICAgICAgfSk7XG4gICAgICAgICAgfSk7XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgLy8gaWYgdGhpcyBvbmx5IGV4aXN0cyBvbiB0aGUgcmVhZGFibGUgRlMsIGFkZCBpdCB0byB0aGVcbiAgICAgICAgICAvLyBkZWxldGUgbWFwLlxuICAgICAgICAgIHRoaXMuZGVsZXRlUGF0aChwKTtcbiAgICAgICAgICBjYihudWxsKTtcbiAgICAgICAgfVxuICAgICAgfSk7XG4gICAgfSk7XG4gIH1cblxuICBwdWJsaWMgdW5saW5rU3luYyhwOiBzdHJpbmcpOiB2b2lkIHtcbiAgICB0aGlzLmNoZWNrSW5pdGlhbGl6ZWQoKTtcbiAgICBpZiAodGhpcy5leGlzdHNTeW5jKHApKSB7XG4gICAgICBpZiAodGhpcy5fd3JpdGFibGUuZXhpc3RzU3luYyhwKSkge1xuICAgICAgICB0aGlzLl93cml0YWJsZS51bmxpbmtTeW5jKHApO1xuICAgICAgfVxuXG4gICAgICAvLyBpZiBpdCBzdGlsbCBleGlzdHMgYWRkIHRvIHRoZSBkZWxldGUgbG9nXG4gICAgICBpZiAodGhpcy5leGlzdHNTeW5jKHApKSB7XG4gICAgICAgIHRoaXMuZGVsZXRlUGF0aChwKTtcbiAgICAgIH1cbiAgICB9IGVsc2Uge1xuICAgICAgdGhyb3cgQXBpRXJyb3IuRU5PRU5UKHApO1xuICAgIH1cbiAgfVxuXG4gIHB1YmxpYyBybWRpcihwOiBzdHJpbmcsIGNiOiAoZXJyPzogQXBpRXJyb3IpID0+IHZvaWQpOiB2b2lkIHtcbiAgICBpZiAoIXRoaXMuY2hlY2tJbml0QXN5bmMoY2IpKSByZXR1cm47XG5cbiAgICBsZXQgcm1kaXJMb3dlciA9ICgpOiB2b2lkID0+IHtcbiAgICAgIHRoaXMucmVhZGRpcihwLCAoZXJyOiBBcGlFcnJvciwgZmlsZXM6IHN0cmluZ1tdKTogdm9pZCA9PiB7XG4gICAgICAgIGlmIChlcnIpIHtcbiAgICAgICAgICByZXR1cm4gY2IoZXJyKTtcbiAgICAgICAgfVxuXG4gICAgICAgIGlmIChmaWxlcy5sZW5ndGgpIHtcbiAgICAgICAgICByZXR1cm4gY2IoQXBpRXJyb3IuRU5PVEVNUFRZKHApKTtcbiAgICAgICAgfVxuXG4gICAgICAgIHRoaXMuZGVsZXRlUGF0aChwKTtcbiAgICAgICAgY2IobnVsbCk7XG4gICAgICB9KTtcbiAgICB9O1xuXG4gICAgdGhpcy5leGlzdHMocCwgKGV4aXN0czogYm9vbGVhbikgPT4ge1xuICAgICAgaWYgKCFleGlzdHMpIHtcbiAgICAgICAgcmV0dXJuIGNiKEFwaUVycm9yLkVOT0VOVChwKSk7XG4gICAgICB9XG5cbiAgICAgIHRoaXMuX3dyaXRhYmxlLmV4aXN0cyhwLCAod3JpdGFibGVFeGlzdHM6IGJvb2xlYW4pID0+IHtcbiAgICAgICAgaWYgKHdyaXRhYmxlRXhpc3RzKSB7XG4gICAgICAgICAgdGhpcy5fd3JpdGFibGUucm1kaXIocCwgKGVycjogQXBpRXJyb3IpID0+IHtcbiAgICAgICAgICAgIGlmIChlcnIpIHtcbiAgICAgICAgICAgICAgcmV0dXJuIGNiKGVycik7XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIHRoaXMuX3JlYWRhYmxlLmV4aXN0cyhwLCAocmVhZGFibGVFeGlzdHM6IGJvb2xlYW4pID0+IHtcbiAgICAgICAgICAgICAgaWYgKHJlYWRhYmxlRXhpc3RzKSB7XG4gICAgICAgICAgICAgICAgcm1kaXJMb3dlcigpO1xuICAgICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgIGNiKCk7XG4gICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH0pO1xuICAgICAgICAgIH0pO1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgIHJtZGlyTG93ZXIoKTtcbiAgICAgICAgfVxuICAgICAgfSk7XG4gICAgfSk7XG4gIH1cblxuICBwdWJsaWMgcm1kaXJTeW5jKHA6IHN0cmluZyk6IHZvaWQge1xuICAgIHRoaXMuY2hlY2tJbml0aWFsaXplZCgpO1xuICAgIGlmICh0aGlzLmV4aXN0c1N5bmMocCkpIHtcbiAgICAgIGlmICh0aGlzLl93cml0YWJsZS5leGlzdHNTeW5jKHApKSB7XG4gICAgICAgIHRoaXMuX3dyaXRhYmxlLnJtZGlyU3luYyhwKTtcbiAgICAgIH1cbiAgICAgIGlmICh0aGlzLmV4aXN0c1N5bmMocCkpIHtcbiAgICAgICAgLy8gQ2hlY2sgaWYgZGlyZWN0b3J5IGlzIGVtcHR5LlxuICAgICAgICBpZiAodGhpcy5yZWFkZGlyU3luYyhwKS5sZW5ndGggPiAwKSB7XG4gICAgICAgICAgdGhyb3cgQXBpRXJyb3IuRU5PVEVNUFRZKHApO1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgIHRoaXMuZGVsZXRlUGF0aChwKTtcbiAgICAgICAgfVxuICAgICAgfVxuICAgIH0gZWxzZSB7XG4gICAgICB0aHJvdyBBcGlFcnJvci5FTk9FTlQocCk7XG4gICAgfVxuICB9XG5cbiAgcHVibGljIG1rZGlyKHA6IHN0cmluZywgbW9kZTogbnVtYmVyLCBjYjogKGVycjogQXBpRXJyb3IsIHN0YXQ/OiBTdGF0cykgPT4gdm9pZCk6IHZvaWQge1xuICAgIGlmICghdGhpcy5jaGVja0luaXRBc3luYyhjYikpIHJldHVybjtcbiAgICB0aGlzLmV4aXN0cyhwLCAoZXhpc3RzOiBib29sZWFuKSA9PiB7XG4gICAgICBpZiAoZXhpc3RzKSB7XG4gICAgICAgIHJldHVybiBjYihBcGlFcnJvci5FRVhJU1QocCkpO1xuICAgICAgfVxuXG4gICAgICAvLyBUaGUgYmVsb3cgd2lsbCB0aHJvdyBzaG91bGQgYW55IG9mIHRoZSBwYXJlbnQgZGlyZWN0b3JpZXNcbiAgICAgIC8vIGZhaWwgdG8gZXhpc3Qgb24gX3dyaXRhYmxlLlxuICAgICAgdGhpcy5jcmVhdGVQYXJlbnREaXJlY3Rvcmllc0FzeW5jKHAsIChlcnI6IEFwaUVycm9yKSA9PiB7XG4gICAgICAgIGlmIChlcnIpIHtcbiAgICAgICAgICByZXR1cm4gY2IoZXJyKTtcbiAgICAgICAgfVxuICAgICAgICB0aGlzLl93cml0YWJsZS5ta2RpcihwLCBtb2RlLCBjYik7XG4gICAgICB9KTtcbiAgICB9KTtcbiAgfVxuXG4gIHB1YmxpYyBta2RpclN5bmMocDogc3RyaW5nLCBtb2RlOiBudW1iZXIpOiB2b2lkIHtcbiAgICB0aGlzLmNoZWNrSW5pdGlhbGl6ZWQoKTtcbiAgICBpZiAodGhpcy5leGlzdHNTeW5jKHApKSB7XG4gICAgICB0aHJvdyBBcGlFcnJvci5FRVhJU1QocCk7XG4gICAgfSBlbHNlIHtcbiAgICAgIC8vIFRoZSBiZWxvdyB3aWxsIHRocm93IHNob3VsZCBhbnkgb2YgdGhlIHBhcmVudCBkaXJlY3RvcmllcyBmYWlsIHRvIGV4aXN0XG4gICAgICAvLyBvbiBfd3JpdGFibGUuXG4gICAgICB0aGlzLmNyZWF0ZVBhcmVudERpcmVjdG9yaWVzKHApO1xuICAgICAgdGhpcy5fd3JpdGFibGUubWtkaXJTeW5jKHAsIG1vZGUpO1xuICAgIH1cbiAgfVxuXG4gIHB1YmxpYyByZWFkZGlyKHA6IHN0cmluZywgY2I6IChlcnJvcjogQXBpRXJyb3IsIGZpbGVzPzogc3RyaW5nW10pID0+IHZvaWQpOiB2b2lkIHtcbiAgICBpZiAoIXRoaXMuY2hlY2tJbml0QXN5bmMoY2IpKSByZXR1cm47XG4gICAgdGhpcy5zdGF0KHAsIGZhbHNlLCAoZXJyOiBBcGlFcnJvciwgZGlyU3RhdHM/OiBTdGF0cykgPT4ge1xuICAgICAgaWYgKGVycikge1xuICAgICAgICByZXR1cm4gY2IoZXJyKTtcbiAgICAgIH1cblxuICAgICAgaWYgKCFkaXJTdGF0cy5pc0RpcmVjdG9yeSgpKSB7XG4gICAgICAgIHJldHVybiBjYihBcGlFcnJvci5FTk9URElSKHApKTtcbiAgICAgIH1cblxuICAgICAgdGhpcy5fd3JpdGFibGUucmVhZGRpcihwLCAoZXJyOiBBcGlFcnJvciwgd0ZpbGVzOiBzdHJpbmdbXSkgPT4ge1xuICAgICAgICBpZiAoZXJyICYmIGVyci5jb2RlICE9PSAnRU5PRU5UJykge1xuICAgICAgICAgIHJldHVybiBjYihlcnIpO1xuICAgICAgICB9IGVsc2UgaWYgKGVyciB8fCAhd0ZpbGVzKSB7XG4gICAgICAgICAgd0ZpbGVzID0gW107XG4gICAgICAgIH1cblxuICAgICAgICB0aGlzLl9yZWFkYWJsZS5yZWFkZGlyKHAsIChlcnI6IEFwaUVycm9yLCByRmlsZXM6IHN0cmluZ1tdKSA9PiB7XG4gICAgICAgICAgLy8gaWYgdGhlIGRpcmVjdG9yeSBkb2Vzbid0IGV4aXN0IG9uIHRoZSBsb3dlciBGUyBzZXQgckZpbGVzXG4gICAgICAgICAgLy8gaGVyZSB0byBzaW1wbGlmeSB0aGUgZm9sbG93aW5nIGNvZGUuXG4gICAgICAgICAgaWYgKGVyciB8fCAhckZpbGVzKSB7XG4gICAgICAgICAgICByRmlsZXMgPSBbXTtcbiAgICAgICAgICB9XG5cbiAgICAgICAgICAvLyBSZWFkZGlyIGluIGJvdGgsIG1lcmdlLCBjaGVjayBkZWxldGUgbG9nIG9uIGVhY2ggZmlsZSwgcmV0dXJuLlxuICAgICAgICAgIGxldCBjb250ZW50czogc3RyaW5nW10gPSB3RmlsZXMuY29uY2F0KHJGaWxlcyk7XG4gICAgICAgICAgbGV0IHNlZW5NYXA6IHtbbmFtZTogc3RyaW5nXTogYm9vbGVhbn0gPSB7fTtcbiAgICAgICAgICBsZXQgZmlsdGVyZWQgPSBjb250ZW50cy5maWx0ZXIoKGZQYXRoOiBzdHJpbmcpID0+IHtcbiAgICAgICAgICAgIGxldCByZXN1bHQgPSAhc2Vlbk1hcFtmUGF0aF0gJiYgIXRoaXMuX2RlbGV0ZWRGaWxlc1twICsgXCIvXCIgKyBmUGF0aF07XG4gICAgICAgICAgICBzZWVuTWFwW2ZQYXRoXSA9IHRydWU7XG4gICAgICAgICAgICByZXR1cm4gcmVzdWx0O1xuICAgICAgICAgIH0pO1xuXG4gICAgICAgICAgY2IobnVsbCwgZmlsdGVyZWQpO1xuICAgICAgICB9KTtcbiAgICAgIH0pO1xuICAgIH0pO1xuICB9XG5cbiAgcHVibGljIHJlYWRkaXJTeW5jKHA6IHN0cmluZyk6IHN0cmluZ1tdIHtcbiAgICB0aGlzLmNoZWNrSW5pdGlhbGl6ZWQoKTtcbiAgICB2YXIgZGlyU3RhdHMgPSB0aGlzLnN0YXRTeW5jKHAsIGZhbHNlKTtcbiAgICBpZiAoIWRpclN0YXRzLmlzRGlyZWN0b3J5KCkpIHtcbiAgICAgIHRocm93IEFwaUVycm9yLkVOT1RESVIocCk7XG4gICAgfVxuXG4gICAgLy8gUmVhZGRpciBpbiBib3RoLCBtZXJnZSwgY2hlY2sgZGVsZXRlIGxvZyBvbiBlYWNoIGZpbGUsIHJldHVybi5cbiAgICB2YXIgY29udGVudHM6IHN0cmluZ1tdID0gW107XG4gICAgdHJ5IHtcbiAgICAgIGNvbnRlbnRzID0gY29udGVudHMuY29uY2F0KHRoaXMuX3dyaXRhYmxlLnJlYWRkaXJTeW5jKHApKTtcbiAgICB9IGNhdGNoIChlKSB7XG4gICAgfVxuICAgIHRyeSB7XG4gICAgICBjb250ZW50cyA9IGNvbnRlbnRzLmNvbmNhdCh0aGlzLl9yZWFkYWJsZS5yZWFkZGlyU3luYyhwKSk7XG4gICAgfSBjYXRjaCAoZSkge1xuICAgIH1cbiAgICB2YXIgc2Vlbk1hcDoge1tuYW1lOiBzdHJpbmddOiBib29sZWFufSA9IHt9O1xuICAgIHJldHVybiBjb250ZW50cy5maWx0ZXIoKGZpbGVQOiBzdHJpbmcpID0+IHtcbiAgICAgIHZhciByZXN1bHQgPSBzZWVuTWFwW2ZpbGVQXSA9PT0gdW5kZWZpbmVkICYmIHRoaXMuX2RlbGV0ZWRGaWxlc1twICsgXCIvXCIgKyBmaWxlUF0gIT09IHRydWU7XG4gICAgICBzZWVuTWFwW2ZpbGVQXSA9IHRydWU7XG4gICAgICByZXR1cm4gcmVzdWx0O1xuICAgIH0pO1xuICB9XG5cbiAgcHVibGljIGV4aXN0cyhwOiBzdHJpbmcsIGNiOiAoZXhpc3RzOiBib29sZWFuKSA9PiB2b2lkKTogdm9pZCB7XG4gICAgLy8gQ2Fubm90IHBhc3MgYW4gZXJyb3IgYmFjayB0byBjYWxsYmFjaywgc28gdGhyb3cgYW4gZXhjZXB0aW9uIGluc3RlYWRcbiAgICAvLyBpZiBub3QgaW5pdGlhbGl6ZWQuXG4gICAgdGhpcy5jaGVja0luaXRpYWxpemVkKCk7XG4gICAgdGhpcy5fd3JpdGFibGUuZXhpc3RzKHAsIChleGlzdHNXcml0YWJsZTogYm9vbGVhbikgPT4ge1xuICAgICAgaWYgKGV4aXN0c1dyaXRhYmxlKSB7XG4gICAgICAgIHJldHVybiBjYih0cnVlKTtcbiAgICAgIH1cblxuICAgICAgdGhpcy5fcmVhZGFibGUuZXhpc3RzKHAsIChleGlzdHNSZWFkYWJsZTogYm9vbGVhbikgPT4ge1xuICAgICAgICBjYihleGlzdHNSZWFkYWJsZSAmJiB0aGlzLl9kZWxldGVkRmlsZXNbcF0gIT09IHRydWUpO1xuICAgICAgfSk7XG4gICAgfSk7XG4gIH1cblxuICBwdWJsaWMgZXhpc3RzU3luYyhwOiBzdHJpbmcpOiBib29sZWFuIHtcbiAgICB0aGlzLmNoZWNrSW5pdGlhbGl6ZWQoKTtcbiAgICByZXR1cm4gdGhpcy5fd3JpdGFibGUuZXhpc3RzU3luYyhwKSB8fCAodGhpcy5fcmVhZGFibGUuZXhpc3RzU3luYyhwKSAmJiB0aGlzLl9kZWxldGVkRmlsZXNbcF0gIT09IHRydWUpO1xuICB9XG5cbiAgcHVibGljIGNobW9kKHA6IHN0cmluZywgaXNMY2htb2Q6IGJvb2xlYW4sIG1vZGU6IG51bWJlciwgY2I6IChlcnJvcj86IEFwaUVycm9yKSA9PiB2b2lkKTogdm9pZCB7XG4gICAgaWYgKCF0aGlzLmNoZWNrSW5pdEFzeW5jKGNiKSkgcmV0dXJuO1xuICAgIHRoaXMub3BlcmF0ZU9uV3JpdGFibGVBc3luYyhwLCAoZXJyPzogQXBpRXJyb3IpID0+IHtcbiAgICAgIGlmIChlcnIpIHtcbiAgICAgICAgcmV0dXJuIGNiKGVycik7XG4gICAgICB9IGVsc2Uge1xuICAgICAgICB0aGlzLl93cml0YWJsZS5jaG1vZChwLCBpc0xjaG1vZCwgbW9kZSwgY2IpO1xuICAgICAgfVxuICAgIH0pO1xuICB9XG5cbiAgcHVibGljIGNobW9kU3luYyhwOiBzdHJpbmcsIGlzTGNobW9kOiBib29sZWFuLCBtb2RlOiBudW1iZXIpOiB2b2lkIHtcbiAgICB0aGlzLmNoZWNrSW5pdGlhbGl6ZWQoKTtcbiAgICB0aGlzLm9wZXJhdGVPbldyaXRhYmxlKHAsICgpID0+IHtcbiAgICAgIHRoaXMuX3dyaXRhYmxlLmNobW9kU3luYyhwLCBpc0xjaG1vZCwgbW9kZSk7XG4gICAgfSk7XG4gIH1cblxuICBwdWJsaWMgY2hvd24ocDogc3RyaW5nLCBpc0xjaG1vZDogYm9vbGVhbiwgdWlkOiBudW1iZXIsIGdpZDogbnVtYmVyLCBjYjogKGVycm9yPzogQXBpRXJyb3IpID0+IHZvaWQpOiB2b2lkIHtcbiAgICBpZiAoIXRoaXMuY2hlY2tJbml0QXN5bmMoY2IpKSByZXR1cm47XG4gICAgdGhpcy5vcGVyYXRlT25Xcml0YWJsZUFzeW5jKHAsIChlcnI/OiBBcGlFcnJvcikgPT4ge1xuICAgICAgaWYgKGVycikge1xuICAgICAgICByZXR1cm4gY2IoZXJyKTtcbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIHRoaXMuX3dyaXRhYmxlLmNob3duKHAsIGlzTGNobW9kLCB1aWQsIGdpZCwgY2IpO1xuICAgICAgfVxuICAgIH0pO1xuICB9XG5cbiAgcHVibGljIGNob3duU3luYyhwOiBzdHJpbmcsIGlzTGNob3duOiBib29sZWFuLCB1aWQ6IG51bWJlciwgZ2lkOiBudW1iZXIpOiB2b2lkIHtcbiAgICB0aGlzLmNoZWNrSW5pdGlhbGl6ZWQoKTtcbiAgICB0aGlzLm9wZXJhdGVPbldyaXRhYmxlKHAsICgpID0+IHtcbiAgICAgIHRoaXMuX3dyaXRhYmxlLmNob3duU3luYyhwLCBpc0xjaG93biwgdWlkLCBnaWQpO1xuICAgIH0pO1xuICB9XG5cbiAgcHVibGljIHV0aW1lcyhwOiBzdHJpbmcsIGF0aW1lOiBEYXRlLCBtdGltZTogRGF0ZSwgY2I6IChlcnJvcj86IEFwaUVycm9yKSA9PiB2b2lkKTogdm9pZCB7XG4gICAgaWYgKCF0aGlzLmNoZWNrSW5pdEFzeW5jKGNiKSkgcmV0dXJuO1xuICAgIHRoaXMub3BlcmF0ZU9uV3JpdGFibGVBc3luYyhwLCAoZXJyPzogQXBpRXJyb3IpID0+IHtcbiAgICAgIGlmIChlcnIpIHtcbiAgICAgICAgcmV0dXJuIGNiKGVycik7XG4gICAgICB9IGVsc2Uge1xuICAgICAgICB0aGlzLl93cml0YWJsZS51dGltZXMocCwgYXRpbWUsIG10aW1lLCBjYik7XG4gICAgICB9XG4gICAgfSk7XG4gIH1cblxuICBwdWJsaWMgdXRpbWVzU3luYyhwOiBzdHJpbmcsIGF0aW1lOiBEYXRlLCBtdGltZTogRGF0ZSk6IHZvaWQge1xuICAgIHRoaXMuY2hlY2tJbml0aWFsaXplZCgpO1xuICAgIHRoaXMub3BlcmF0ZU9uV3JpdGFibGUocCwgKCkgPT4ge1xuICAgICAgdGhpcy5fd3JpdGFibGUudXRpbWVzU3luYyhwLCBhdGltZSwgbXRpbWUpO1xuICAgIH0pO1xuICB9XG5cbiAgLyoqXG4gICAqIEhlbHBlciBmdW5jdGlvbjpcbiAgICogLSBFbnN1cmVzIHAgaXMgb24gd3JpdGFibGUgYmVmb3JlIHByb2NlZWRpbmcuIFRocm93cyBhbiBlcnJvciBpZiBpdCBkb2Vzbid0IGV4aXN0LlxuICAgKiAtIENhbGxzIGYgdG8gcGVyZm9ybSBvcGVyYXRpb24gb24gd3JpdGFibGUuXG4gICAqL1xuICBwcml2YXRlIG9wZXJhdGVPbldyaXRhYmxlKHA6IHN0cmluZywgZjogKCkgPT4gdm9pZCk6IHZvaWQge1xuICAgIGlmICh0aGlzLmV4aXN0c1N5bmMocCkpIHtcbiAgICAgIGlmICghdGhpcy5fd3JpdGFibGUuZXhpc3RzU3luYyhwKSkge1xuICAgICAgICAvLyBGaWxlIGlzIG9uIHJlYWRhYmxlIHN0b3JhZ2UuIENvcHkgdG8gd3JpdGFibGUgc3RvcmFnZSBiZWZvcmVcbiAgICAgICAgLy8gY2hhbmdpbmcgaXRzIG1vZGUuXG4gICAgICAgIHRoaXMuY29weVRvV3JpdGFibGUocCk7XG4gICAgICB9XG4gICAgICBmKCk7XG4gICAgfSBlbHNlIHtcbiAgICAgIHRocm93IEFwaUVycm9yLkVOT0VOVChwKTtcbiAgICB9XG4gIH1cblxuICBwcml2YXRlIG9wZXJhdGVPbldyaXRhYmxlQXN5bmMocDogc3RyaW5nLCBjYjogKGVycm9yPzogQXBpRXJyb3IpID0+IHZvaWQpOiB2b2lkIHtcbiAgICB0aGlzLmV4aXN0cyhwLCAoZXhpc3RzOiBib29sZWFuKSA9PiB7XG4gICAgICBpZiAoIWV4aXN0cykge1xuICAgICAgICByZXR1cm4gY2IoQXBpRXJyb3IuRU5PRU5UKHApKTtcbiAgICAgIH1cblxuICAgICAgdGhpcy5fd3JpdGFibGUuZXhpc3RzKHAsIChleGlzdHNXcml0YWJsZTogYm9vbGVhbikgPT4ge1xuICAgICAgICBpZiAoZXhpc3RzV3JpdGFibGUpIHtcbiAgICAgICAgICBjYigpO1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgIHJldHVybiB0aGlzLmNvcHlUb1dyaXRhYmxlQXN5bmMocCwgY2IpO1xuICAgICAgICB9XG4gICAgICB9KTtcbiAgICB9KTtcbiAgfVxuXG4gIC8qKlxuICAgKiBDb3B5IGZyb20gcmVhZGFibGUgdG8gd3JpdGFibGUgc3RvcmFnZS5cbiAgICogUFJFQ09ORElUSU9OOiBGaWxlIGRvZXMgbm90IGV4aXN0IG9uIHdyaXRhYmxlIHN0b3JhZ2UuXG4gICAqL1xuICBwcml2YXRlIGNvcHlUb1dyaXRhYmxlKHA6IHN0cmluZyk6IHZvaWQge1xuICAgIHZhciBwU3RhdHMgPSB0aGlzLnN0YXRTeW5jKHAsIGZhbHNlKTtcbiAgICBpZiAocFN0YXRzLmlzRGlyZWN0b3J5KCkpIHtcbiAgICAgIHRoaXMuX3dyaXRhYmxlLm1rZGlyU3luYyhwLCBwU3RhdHMubW9kZSk7XG4gICAgfSBlbHNlIHtcbiAgICAgIHRoaXMud3JpdGVGaWxlU3luYyhwLFxuICAgICAgICB0aGlzLl9yZWFkYWJsZS5yZWFkRmlsZVN5bmMocCwgbnVsbCwgZ2V0RmxhZygncicpKSwgbnVsbCxcbiAgICAgICAgZ2V0RmxhZygndycpLCB0aGlzLnN0YXRTeW5jKHAsIGZhbHNlKS5tb2RlKTtcbiAgICB9XG4gIH1cblxuICBwcml2YXRlIGNvcHlUb1dyaXRhYmxlQXN5bmMocDogc3RyaW5nLCBjYjogKGVycj86IEFwaUVycm9yKSA9PiB2b2lkKTogdm9pZCB7XG4gICAgdGhpcy5zdGF0KHAsIGZhbHNlLCAoZXJyOiBBcGlFcnJvciwgcFN0YXRzPzogU3RhdHMpID0+IHtcbiAgICAgIGlmIChlcnIpIHtcbiAgICAgICAgcmV0dXJuIGNiKGVycik7XG4gICAgICB9XG5cbiAgICAgIGlmIChwU3RhdHMuaXNEaXJlY3RvcnkoKSkge1xuICAgICAgICByZXR1cm4gdGhpcy5fd3JpdGFibGUubWtkaXIocCwgcFN0YXRzLm1vZGUsIGNiKTtcbiAgICAgIH1cblxuICAgICAgLy8gbmVlZCB0byBjb3B5IGZpbGUuXG4gICAgICB0aGlzLl9yZWFkYWJsZS5yZWFkRmlsZShwLCBudWxsLCBnZXRGbGFnKCdyJyksIChlcnI6IEFwaUVycm9yLCBkYXRhPzogQnVmZmVyKSA9PiB7XG4gICAgICAgIGlmIChlcnIpIHtcbiAgICAgICAgICByZXR1cm4gY2IoZXJyKTtcbiAgICAgICAgfVxuXG4gICAgICAgIHRoaXMud3JpdGVGaWxlKHAsIGRhdGEsIG51bGwsIGdldEZsYWcoJ3cnKSwgcFN0YXRzLm1vZGUsIGNiKTtcbiAgICAgIH0pO1xuICAgIH0pO1xuICB9XG59XG5cbmV4cG9ydCBkZWZhdWx0IGNsYXNzIE92ZXJsYXlGUyBleHRlbmRzIExvY2tlZEZTPFVubG9ja2VkT3ZlcmxheUZTPiB7XG5cdGNvbnN0cnVjdG9yKHdyaXRhYmxlOiBGaWxlU3lzdGVtLCByZWFkYWJsZTogRmlsZVN5c3RlbSkge1xuXHRcdHN1cGVyKG5ldyBVbmxvY2tlZE92ZXJsYXlGUyh3cml0YWJsZSwgcmVhZGFibGUpKTtcblx0fVxuXG5cdGluaXRpYWxpemUoY2I6IChlcnI/OiBBcGlFcnJvcikgPT4gdm9pZCk6IHZvaWQge1xuXHRcdHN1cGVyLmluaXRpYWxpemUoY2IpO1xuXHR9XG5cblx0c3RhdGljIGlzQXZhaWxhYmxlKCk6IGJvb2xlYW4ge1xuXHRcdHJldHVybiBVbmxvY2tlZE92ZXJsYXlGUy5pc0F2YWlsYWJsZSgpO1xuXHR9XG5cblx0Z2V0T3ZlcmxheWVkRmlsZVN5c3RlbXMoKTogeyByZWFkYWJsZTogRmlsZVN5c3RlbTsgd3JpdGFibGU6IEZpbGVTeXN0ZW07IH0ge1xuXHRcdHJldHVybiBzdXBlci5nZXRGU1VubG9ja2VkKCkuZ2V0T3ZlcmxheWVkRmlsZVN5c3RlbXMoKTtcblx0fVxufVxuIl19