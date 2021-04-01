"use strict";
var api_error_1 = require('./api_error');
var file_flag_1 = require('./file_flag');
var path = require('path');
var node_fs_stats_1 = require('./node_fs_stats');
var global = require('./global');
function wrapCb(cb, numArgs) {
    if (RELEASE) {
        return cb;
    }
    else {
        if (typeof cb !== 'function') {
            throw new api_error_1.ApiError(api_error_1.ErrorCode.EINVAL, 'Callback must be a function.');
        }
        if (typeof __numWaiting === 'undefined') {
            global.__numWaiting = 0;
        }
        __numWaiting++;
        switch (numArgs) {
            case 1:
                return function (arg1) {
                    setImmediate(function () {
                        __numWaiting--;
                        return cb(arg1);
                    });
                };
            case 2:
                return function (arg1, arg2) {
                    setImmediate(function () {
                        __numWaiting--;
                        return cb(arg1, arg2);
                    });
                };
            case 3:
                return function (arg1, arg2, arg3) {
                    setImmediate(function () {
                        __numWaiting--;
                        return cb(arg1, arg2, arg3);
                    });
                };
            default:
                throw new Error('Invalid invocation of wrapCb.');
        }
    }
}
function normalizeMode(mode, def) {
    switch (typeof mode) {
        case 'number':
            return mode;
        case 'string':
            var trueMode = parseInt(mode, 8);
            if (trueMode !== NaN) {
                return trueMode;
            }
        default:
            return def;
    }
}
function normalizeTime(time) {
    if (time instanceof Date) {
        return time;
    }
    else if (typeof time === 'number') {
        return new Date(time * 1000);
    }
    else {
        throw new api_error_1.ApiError(api_error_1.ErrorCode.EINVAL, "Invalid time.");
    }
}
function normalizePath(p) {
    if (p.indexOf('\u0000') >= 0) {
        throw new api_error_1.ApiError(api_error_1.ErrorCode.EINVAL, 'Path must be a string without null bytes.');
    }
    else if (p === '') {
        throw new api_error_1.ApiError(api_error_1.ErrorCode.EINVAL, 'Path must not be empty.');
    }
    return path.resolve(p);
}
function normalizeOptions(options, defEnc, defFlag, defMode) {
    switch (typeof options) {
        case 'object':
            return {
                encoding: typeof options['encoding'] !== 'undefined' ? options['encoding'] : defEnc,
                flag: typeof options['flag'] !== 'undefined' ? options['flag'] : defFlag,
                mode: normalizeMode(options['mode'], defMode)
            };
        case 'string':
            return {
                encoding: options,
                flag: defFlag,
                mode: defMode
            };
        default:
            return {
                encoding: defEnc,
                flag: defFlag,
                mode: defMode
            };
    }
}
function nopCb() { }
;
var FS = (function () {
    function FS() {
        this.root = null;
        this.fdMap = {};
        this.nextFd = 100;
        this.F_OK = 0;
        this.R_OK = 4;
        this.W_OK = 2;
        this.X_OK = 1;
        this._wrapCb = wrapCb;
    }
    FS.prototype.getFdForFile = function (file) {
        var fd = this.nextFd++;
        this.fdMap[fd] = file;
        return fd;
    };
    FS.prototype.fd2file = function (fd) {
        var rv = this.fdMap[fd];
        if (rv) {
            return rv;
        }
        else {
            throw new api_error_1.ApiError(api_error_1.ErrorCode.EBADF, 'Invalid file descriptor.');
        }
    };
    FS.prototype.closeFd = function (fd) {
        delete this.fdMap[fd];
    };
    FS.prototype.initialize = function (rootFS) {
        if (!rootFS.constructor.isAvailable()) {
            throw new api_error_1.ApiError(api_error_1.ErrorCode.EINVAL, 'Tried to instantiate BrowserFS with an unavailable file system.');
        }
        return this.root = rootFS;
    };
    FS.prototype._toUnixTimestamp = function (time) {
        if (typeof time === 'number') {
            return time;
        }
        else if (time instanceof Date) {
            return time.getTime() / 1000;
        }
        throw new Error("Cannot parse time: " + time);
    };
    FS.prototype.getRootFS = function () {
        if (this.root) {
            return this.root;
        }
        else {
            return null;
        }
    };
    FS.prototype.rename = function (oldPath, newPath, cb) {
        if (cb === void 0) { cb = nopCb; }
        var newCb = wrapCb(cb, 1);
        try {
            this.root.rename(normalizePath(oldPath), normalizePath(newPath), newCb);
        }
        catch (e) {
            newCb(e);
        }
    };
    FS.prototype.renameSync = function (oldPath, newPath) {
        this.root.renameSync(normalizePath(oldPath), normalizePath(newPath));
    };
    FS.prototype.exists = function (path, cb) {
        if (cb === void 0) { cb = nopCb; }
        var newCb = wrapCb(cb, 1);
        try {
            return this.root.exists(normalizePath(path), newCb);
        }
        catch (e) {
            return newCb(false);
        }
    };
    FS.prototype.existsSync = function (path) {
        try {
            return this.root.existsSync(normalizePath(path));
        }
        catch (e) {
            return false;
        }
    };
    FS.prototype.stat = function (path, cb) {
        if (cb === void 0) { cb = nopCb; }
        var newCb = wrapCb(cb, 2);
        try {
            return this.root.stat(normalizePath(path), false, newCb);
        }
        catch (e) {
            return newCb(e, null);
        }
    };
    FS.prototype.statSync = function (path) {
        return this.root.statSync(normalizePath(path), false);
    };
    FS.prototype.lstat = function (path, cb) {
        if (cb === void 0) { cb = nopCb; }
        var newCb = wrapCb(cb, 2);
        try {
            return this.root.stat(normalizePath(path), true, newCb);
        }
        catch (e) {
            return newCb(e, null);
        }
    };
    FS.prototype.lstatSync = function (path) {
        return this.root.statSync(normalizePath(path), true);
    };
    FS.prototype.truncate = function (path, arg2, cb) {
        if (arg2 === void 0) { arg2 = 0; }
        if (cb === void 0) { cb = nopCb; }
        var len = 0;
        if (typeof arg2 === 'function') {
            cb = arg2;
        }
        else if (typeof arg2 === 'number') {
            len = arg2;
        }
        var newCb = wrapCb(cb, 1);
        try {
            if (len < 0) {
                throw new api_error_1.ApiError(api_error_1.ErrorCode.EINVAL);
            }
            return this.root.truncate(normalizePath(path), len, newCb);
        }
        catch (e) {
            return newCb(e);
        }
    };
    FS.prototype.truncateSync = function (path, len) {
        if (len === void 0) { len = 0; }
        if (len < 0) {
            throw new api_error_1.ApiError(api_error_1.ErrorCode.EINVAL);
        }
        return this.root.truncateSync(normalizePath(path), len);
    };
    FS.prototype.unlink = function (path, cb) {
        if (cb === void 0) { cb = nopCb; }
        var newCb = wrapCb(cb, 1);
        try {
            return this.root.unlink(normalizePath(path), newCb);
        }
        catch (e) {
            return newCb(e);
        }
    };
    FS.prototype.unlinkSync = function (path) {
        return this.root.unlinkSync(normalizePath(path));
    };
    FS.prototype.open = function (path, flag, arg2, cb) {
        var _this = this;
        if (cb === void 0) { cb = nopCb; }
        var mode = normalizeMode(arg2, 0x1a4);
        cb = typeof arg2 === 'function' ? arg2 : cb;
        var newCb = wrapCb(cb, 2);
        try {
            this.root.open(normalizePath(path), file_flag_1.FileFlag.getFileFlag(flag), mode, function (e, file) {
                if (file) {
                    newCb(e, _this.getFdForFile(file));
                }
                else {
                    newCb(e);
                }
            });
        }
        catch (e) {
            newCb(e, null);
        }
    };
    FS.prototype.openSync = function (path, flag, mode) {
        if (mode === void 0) { mode = 0x1a4; }
        return this.getFdForFile(this.root.openSync(normalizePath(path), file_flag_1.FileFlag.getFileFlag(flag), normalizeMode(mode, 0x1a4)));
    };
    FS.prototype.readFile = function (filename, arg2, cb) {
        if (arg2 === void 0) { arg2 = {}; }
        if (cb === void 0) { cb = nopCb; }
        var options = normalizeOptions(arg2, null, 'r', null);
        cb = typeof arg2 === 'function' ? arg2 : cb;
        var newCb = wrapCb(cb, 2);
        try {
            var flag = file_flag_1.FileFlag.getFileFlag(options['flag']);
            if (!flag.isReadable()) {
                return newCb(new api_error_1.ApiError(api_error_1.ErrorCode.EINVAL, 'Flag passed to readFile must allow for reading.'));
            }
            return this.root.readFile(normalizePath(filename), options.encoding, flag, newCb);
        }
        catch (e) {
            return newCb(e, null);
        }
    };
    FS.prototype.readFileSync = function (filename, arg2) {
        if (arg2 === void 0) { arg2 = {}; }
        var options = normalizeOptions(arg2, null, 'r', null);
        var flag = file_flag_1.FileFlag.getFileFlag(options.flag);
        if (!flag.isReadable()) {
            throw new api_error_1.ApiError(api_error_1.ErrorCode.EINVAL, 'Flag passed to readFile must allow for reading.');
        }
        return this.root.readFileSync(normalizePath(filename), options.encoding, flag);
    };
    FS.prototype.writeFile = function (filename, data, arg3, cb) {
        if (arg3 === void 0) { arg3 = {}; }
        if (cb === void 0) { cb = nopCb; }
        var options = normalizeOptions(arg3, 'utf8', 'w', 0x1a4);
        cb = typeof arg3 === 'function' ? arg3 : cb;
        var newCb = wrapCb(cb, 1);
        try {
            var flag = file_flag_1.FileFlag.getFileFlag(options.flag);
            if (!flag.isWriteable()) {
                return newCb(new api_error_1.ApiError(api_error_1.ErrorCode.EINVAL, 'Flag passed to writeFile must allow for writing.'));
            }
            return this.root.writeFile(normalizePath(filename), data, options.encoding, flag, options.mode, newCb);
        }
        catch (e) {
            return newCb(e);
        }
    };
    FS.prototype.writeFileSync = function (filename, data, arg3) {
        var options = normalizeOptions(arg3, 'utf8', 'w', 0x1a4);
        var flag = file_flag_1.FileFlag.getFileFlag(options.flag);
        if (!flag.isWriteable()) {
            throw new api_error_1.ApiError(api_error_1.ErrorCode.EINVAL, 'Flag passed to writeFile must allow for writing.');
        }
        return this.root.writeFileSync(normalizePath(filename), data, options.encoding, flag, options.mode);
    };
    FS.prototype.appendFile = function (filename, data, arg3, cb) {
        if (cb === void 0) { cb = nopCb; }
        var options = normalizeOptions(arg3, 'utf8', 'a', 0x1a4);
        cb = typeof arg3 === 'function' ? arg3 : cb;
        var newCb = wrapCb(cb, 1);
        try {
            var flag = file_flag_1.FileFlag.getFileFlag(options.flag);
            if (!flag.isAppendable()) {
                return newCb(new api_error_1.ApiError(api_error_1.ErrorCode.EINVAL, 'Flag passed to appendFile must allow for appending.'));
            }
            this.root.appendFile(normalizePath(filename), data, options.encoding, flag, options.mode, newCb);
        }
        catch (e) {
            newCb(e);
        }
    };
    FS.prototype.appendFileSync = function (filename, data, arg3) {
        var options = normalizeOptions(arg3, 'utf8', 'a', 0x1a4);
        var flag = file_flag_1.FileFlag.getFileFlag(options.flag);
        if (!flag.isAppendable()) {
            throw new api_error_1.ApiError(api_error_1.ErrorCode.EINVAL, 'Flag passed to appendFile must allow for appending.');
        }
        return this.root.appendFileSync(normalizePath(filename), data, options.encoding, flag, options.mode);
    };
    FS.prototype.fstat = function (fd, cb) {
        if (cb === void 0) { cb = nopCb; }
        var newCb = wrapCb(cb, 2);
        try {
            var file = this.fd2file(fd);
            file.stat(newCb);
        }
        catch (e) {
            newCb(e);
        }
    };
    FS.prototype.fstatSync = function (fd) {
        return this.fd2file(fd).statSync();
    };
    FS.prototype.close = function (fd, cb) {
        var _this = this;
        if (cb === void 0) { cb = nopCb; }
        var newCb = wrapCb(cb, 1);
        try {
            this.fd2file(fd).close(function (e) {
                if (!e) {
                    _this.closeFd(fd);
                }
                newCb(e);
            });
        }
        catch (e) {
            newCb(e);
        }
    };
    FS.prototype.closeSync = function (fd) {
        this.fd2file(fd).closeSync();
        this.closeFd(fd);
    };
    FS.prototype.ftruncate = function (fd, arg2, cb) {
        if (cb === void 0) { cb = nopCb; }
        var length = typeof arg2 === 'number' ? arg2 : 0;
        cb = typeof arg2 === 'function' ? arg2 : cb;
        var newCb = wrapCb(cb, 1);
        try {
            var file = this.fd2file(fd);
            if (length < 0) {
                throw new api_error_1.ApiError(api_error_1.ErrorCode.EINVAL);
            }
            file.truncate(length, newCb);
        }
        catch (e) {
            newCb(e);
        }
    };
    FS.prototype.ftruncateSync = function (fd, len) {
        if (len === void 0) { len = 0; }
        var file = this.fd2file(fd);
        if (len < 0) {
            throw new api_error_1.ApiError(api_error_1.ErrorCode.EINVAL);
        }
        file.truncateSync(len);
    };
    FS.prototype.fsync = function (fd, cb) {
        if (cb === void 0) { cb = nopCb; }
        var newCb = wrapCb(cb, 1);
        try {
            this.fd2file(fd).sync(newCb);
        }
        catch (e) {
            newCb(e);
        }
    };
    FS.prototype.fsyncSync = function (fd) {
        this.fd2file(fd).syncSync();
    };
    FS.prototype.fdatasync = function (fd, cb) {
        if (cb === void 0) { cb = nopCb; }
        var newCb = wrapCb(cb, 1);
        try {
            this.fd2file(fd).datasync(newCb);
        }
        catch (e) {
            newCb(e);
        }
    };
    FS.prototype.fdatasyncSync = function (fd) {
        this.fd2file(fd).datasyncSync();
    };
    FS.prototype.write = function (fd, arg2, arg3, arg4, arg5, cb) {
        if (cb === void 0) { cb = nopCb; }
        var buffer, offset, length, position = null;
        if (typeof arg2 === 'string') {
            var encoding = 'utf8';
            switch (typeof arg3) {
                case 'function':
                    cb = arg3;
                    break;
                case 'number':
                    position = arg3;
                    encoding = typeof arg4 === 'string' ? arg4 : 'utf8';
                    cb = typeof arg5 === 'function' ? arg5 : cb;
                    break;
                default:
                    cb = typeof arg4 === 'function' ? arg4 : typeof arg5 === 'function' ? arg5 : cb;
                    return cb(new api_error_1.ApiError(api_error_1.ErrorCode.EINVAL, 'Invalid arguments.'));
            }
            buffer = new Buffer(arg2, encoding);
            offset = 0;
            length = buffer.length;
        }
        else {
            buffer = arg2;
            offset = arg3;
            length = arg4;
            position = typeof arg5 === 'number' ? arg5 : null;
            cb = typeof arg5 === 'function' ? arg5 : cb;
        }
        var newCb = wrapCb(cb, 3);
        try {
            var file = this.fd2file(fd);
            if (position == null) {
                position = file.getPos();
            }
            file.write(buffer, offset, length, position, newCb);
        }
        catch (e) {
            newCb(e);
        }
    };
    FS.prototype.writeSync = function (fd, arg2, arg3, arg4, arg5) {
        var buffer, offset = 0, length, position;
        if (typeof arg2 === 'string') {
            position = typeof arg3 === 'number' ? arg3 : null;
            var encoding = typeof arg4 === 'string' ? arg4 : 'utf8';
            offset = 0;
            buffer = new Buffer(arg2, encoding);
            length = buffer.length;
        }
        else {
            buffer = arg2;
            offset = arg3;
            length = arg4;
            position = typeof arg5 === 'number' ? arg5 : null;
        }
        var file = this.fd2file(fd);
        if (position == null) {
            position = file.getPos();
        }
        return file.writeSync(buffer, offset, length, position);
    };
    FS.prototype.read = function (fd, arg2, arg3, arg4, arg5, cb) {
        if (cb === void 0) { cb = nopCb; }
        var position, offset, length, buffer, newCb;
        if (typeof arg2 === 'number') {
            length = arg2;
            position = arg3;
            var encoding = arg4;
            cb = typeof arg5 === 'function' ? arg5 : cb;
            offset = 0;
            buffer = new Buffer(length);
            newCb = wrapCb((function (err, bytesRead, buf) {
                if (err) {
                    return cb(err);
                }
                cb(err, buf.toString(encoding), bytesRead);
            }), 3);
        }
        else {
            buffer = arg2;
            offset = arg3;
            length = arg4;
            position = arg5;
            newCb = wrapCb(cb, 3);
        }
        try {
            var file = this.fd2file(fd);
            if (position == null) {
                position = file.getPos();
            }
            file.read(buffer, offset, length, position, newCb);
        }
        catch (e) {
            newCb(e);
        }
    };
    FS.prototype.readSync = function (fd, arg2, arg3, arg4, arg5) {
        var shenanigans = false;
        var buffer, offset, length, position;
        if (typeof arg2 === 'number') {
            length = arg2;
            position = arg3;
            var encoding = arg4;
            offset = 0;
            buffer = new Buffer(length);
            shenanigans = true;
        }
        else {
            buffer = arg2;
            offset = arg3;
            length = arg4;
            position = arg5;
        }
        var file = this.fd2file(fd);
        if (position == null) {
            position = file.getPos();
        }
        var rv = file.readSync(buffer, offset, length, position);
        if (!shenanigans) {
            return rv;
        }
        else {
            return [buffer.toString(encoding), rv];
        }
    };
    FS.prototype.fchown = function (fd, uid, gid, callback) {
        if (callback === void 0) { callback = nopCb; }
        var newCb = wrapCb(callback, 1);
        try {
            this.fd2file(fd).chown(uid, gid, newCb);
        }
        catch (e) {
            newCb(e);
        }
    };
    FS.prototype.fchownSync = function (fd, uid, gid) {
        this.fd2file(fd).chownSync(uid, gid);
    };
    FS.prototype.fchmod = function (fd, mode, cb) {
        var newCb = wrapCb(cb, 1);
        try {
            var numMode = typeof mode === 'string' ? parseInt(mode, 8) : mode;
            this.fd2file(fd).chmod(numMode, newCb);
        }
        catch (e) {
            newCb(e);
        }
    };
    FS.prototype.fchmodSync = function (fd, mode) {
        var numMode = typeof mode === 'string' ? parseInt(mode, 8) : mode;
        this.fd2file(fd).chmodSync(numMode);
    };
    FS.prototype.futimes = function (fd, atime, mtime, cb) {
        if (cb === void 0) { cb = nopCb; }
        var newCb = wrapCb(cb, 1);
        try {
            var file = this.fd2file(fd);
            if (typeof atime === 'number') {
                atime = new Date(atime * 1000);
            }
            if (typeof mtime === 'number') {
                mtime = new Date(mtime * 1000);
            }
            file.utimes(atime, mtime, newCb);
        }
        catch (e) {
            newCb(e);
        }
    };
    FS.prototype.futimesSync = function (fd, atime, mtime) {
        this.fd2file(fd).utimesSync(normalizeTime(atime), normalizeTime(mtime));
    };
    FS.prototype.rmdir = function (path, cb) {
        if (cb === void 0) { cb = nopCb; }
        var newCb = wrapCb(cb, 1);
        try {
            path = normalizePath(path);
            this.root.rmdir(path, newCb);
        }
        catch (e) {
            newCb(e);
        }
    };
    FS.prototype.rmdirSync = function (path) {
        path = normalizePath(path);
        return this.root.rmdirSync(path);
    };
    FS.prototype.mkdir = function (path, mode, cb) {
        if (cb === void 0) { cb = nopCb; }
        if (typeof mode === 'function') {
            cb = mode;
            mode = 0x1ff;
        }
        var newCb = wrapCb(cb, 1);
        try {
            path = normalizePath(path);
            this.root.mkdir(path, mode, newCb);
        }
        catch (e) {
            newCb(e);
        }
    };
    FS.prototype.mkdirSync = function (path, mode) {
        this.root.mkdirSync(normalizePath(path), normalizeMode(mode, 0x1ff));
    };
    FS.prototype.readdir = function (path, cb) {
        if (cb === void 0) { cb = nopCb; }
        var newCb = wrapCb(cb, 2);
        try {
            path = normalizePath(path);
            this.root.readdir(path, newCb);
        }
        catch (e) {
            newCb(e);
        }
    };
    FS.prototype.readdirSync = function (path) {
        path = normalizePath(path);
        return this.root.readdirSync(path);
    };
    FS.prototype.link = function (srcpath, dstpath, cb) {
        if (cb === void 0) { cb = nopCb; }
        var newCb = wrapCb(cb, 1);
        try {
            srcpath = normalizePath(srcpath);
            dstpath = normalizePath(dstpath);
            this.root.link(srcpath, dstpath, newCb);
        }
        catch (e) {
            newCb(e);
        }
    };
    FS.prototype.linkSync = function (srcpath, dstpath) {
        srcpath = normalizePath(srcpath);
        dstpath = normalizePath(dstpath);
        return this.root.linkSync(srcpath, dstpath);
    };
    FS.prototype.symlink = function (srcpath, dstpath, arg3, cb) {
        if (cb === void 0) { cb = nopCb; }
        var type = typeof arg3 === 'string' ? arg3 : 'file';
        cb = typeof arg3 === 'function' ? arg3 : cb;
        var newCb = wrapCb(cb, 1);
        try {
            if (type !== 'file' && type !== 'dir') {
                return newCb(new api_error_1.ApiError(api_error_1.ErrorCode.EINVAL, "Invalid type: " + type));
            }
            srcpath = normalizePath(srcpath);
            dstpath = normalizePath(dstpath);
            this.root.symlink(srcpath, dstpath, type, newCb);
        }
        catch (e) {
            newCb(e);
        }
    };
    FS.prototype.symlinkSync = function (srcpath, dstpath, type) {
        if (type == null) {
            type = 'file';
        }
        else if (type !== 'file' && type !== 'dir') {
            throw new api_error_1.ApiError(api_error_1.ErrorCode.EINVAL, "Invalid type: " + type);
        }
        srcpath = normalizePath(srcpath);
        dstpath = normalizePath(dstpath);
        return this.root.symlinkSync(srcpath, dstpath, type);
    };
    FS.prototype.readlink = function (path, cb) {
        if (cb === void 0) { cb = nopCb; }
        var newCb = wrapCb(cb, 2);
        try {
            path = normalizePath(path);
            this.root.readlink(path, newCb);
        }
        catch (e) {
            newCb(e);
        }
    };
    FS.prototype.readlinkSync = function (path) {
        path = normalizePath(path);
        return this.root.readlinkSync(path);
    };
    FS.prototype.chown = function (path, uid, gid, cb) {
        if (cb === void 0) { cb = nopCb; }
        var newCb = wrapCb(cb, 1);
        try {
            path = normalizePath(path);
            this.root.chown(path, false, uid, gid, newCb);
        }
        catch (e) {
            newCb(e);
        }
    };
    FS.prototype.chownSync = function (path, uid, gid) {
        path = normalizePath(path);
        this.root.chownSync(path, false, uid, gid);
    };
    FS.prototype.lchown = function (path, uid, gid, cb) {
        if (cb === void 0) { cb = nopCb; }
        var newCb = wrapCb(cb, 1);
        try {
            path = normalizePath(path);
            this.root.chown(path, true, uid, gid, newCb);
        }
        catch (e) {
            newCb(e);
        }
    };
    FS.prototype.lchownSync = function (path, uid, gid) {
        path = normalizePath(path);
        this.root.chownSync(path, true, uid, gid);
    };
    FS.prototype.chmod = function (path, mode, cb) {
        if (cb === void 0) { cb = nopCb; }
        var newCb = wrapCb(cb, 1);
        try {
            var numMode = normalizeMode(mode, -1);
            if (numMode < 0) {
                throw new api_error_1.ApiError(api_error_1.ErrorCode.EINVAL, "Invalid mode.");
            }
            this.root.chmod(normalizePath(path), false, numMode, newCb);
        }
        catch (e) {
            newCb(e);
        }
    };
    FS.prototype.chmodSync = function (path, mode) {
        var numMode = normalizeMode(mode, -1);
        if (numMode < 0) {
            throw new api_error_1.ApiError(api_error_1.ErrorCode.EINVAL, "Invalid mode.");
        }
        path = normalizePath(path);
        this.root.chmodSync(path, false, numMode);
    };
    FS.prototype.lchmod = function (path, mode, cb) {
        if (cb === void 0) { cb = nopCb; }
        var newCb = wrapCb(cb, 1);
        try {
            var numMode = normalizeMode(mode, -1);
            if (numMode < 0) {
                throw new api_error_1.ApiError(api_error_1.ErrorCode.EINVAL, "Invalid mode.");
            }
            this.root.chmod(normalizePath(path), true, numMode, newCb);
        }
        catch (e) {
            newCb(e);
        }
    };
    FS.prototype.lchmodSync = function (path, mode) {
        var numMode = normalizeMode(mode, -1);
        if (numMode < 1) {
            throw new api_error_1.ApiError(api_error_1.ErrorCode.EINVAL, "Invalid mode.");
        }
        this.root.chmodSync(normalizePath(path), true, numMode);
    };
    FS.prototype.utimes = function (path, atime, mtime, cb) {
        if (cb === void 0) { cb = nopCb; }
        var newCb = wrapCb(cb, 1);
        try {
            this.root.utimes(normalizePath(path), normalizeTime(atime), normalizeTime(mtime), newCb);
        }
        catch (e) {
            newCb(e);
        }
    };
    FS.prototype.utimesSync = function (path, atime, mtime) {
        this.root.utimesSync(normalizePath(path), normalizeTime(atime), normalizeTime(mtime));
    };
    FS.prototype.realpath = function (path, arg2, cb) {
        if (cb === void 0) { cb = nopCb; }
        var cache = typeof arg2 === 'object' ? arg2 : {};
        cb = typeof arg2 === 'function' ? arg2 : nopCb;
        var newCb = wrapCb(cb, 2);
        try {
            path = normalizePath(path);
            this.root.realpath(path, cache, newCb);
        }
        catch (e) {
            newCb(e);
        }
    };
    FS.prototype.realpathSync = function (path, cache) {
        if (cache === void 0) { cache = {}; }
        path = normalizePath(path);
        return this.root.realpathSync(path, cache);
    };
    FS.prototype.watchFile = function (filename, arg2, listener) {
        if (listener === void 0) { listener = nopCb; }
        throw new api_error_1.ApiError(api_error_1.ErrorCode.ENOTSUP);
    };
    FS.prototype.unwatchFile = function (filename, listener) {
        if (listener === void 0) { listener = nopCb; }
        throw new api_error_1.ApiError(api_error_1.ErrorCode.ENOTSUP);
    };
    FS.prototype.watch = function (filename, arg2, listener) {
        if (listener === void 0) { listener = nopCb; }
        throw new api_error_1.ApiError(api_error_1.ErrorCode.ENOTSUP);
    };
    FS.prototype.access = function (path, arg2, cb) {
        if (cb === void 0) { cb = nopCb; }
        throw new api_error_1.ApiError(api_error_1.ErrorCode.ENOTSUP);
    };
    FS.prototype.accessSync = function (path, mode) {
        throw new api_error_1.ApiError(api_error_1.ErrorCode.ENOTSUP);
    };
    FS.prototype.createReadStream = function (path, options) {
        throw new api_error_1.ApiError(api_error_1.ErrorCode.ENOTSUP);
    };
    FS.prototype.createWriteStream = function (path, options) {
        throw new api_error_1.ApiError(api_error_1.ErrorCode.ENOTSUP);
    };
    FS.Stats = node_fs_stats_1["default"];
    return FS;
}());
exports.__esModule = true;
exports["default"] = FS;
var _ = new FS();
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiRlMuanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyIuLi8uLi8uLi9zcmMvY29yZS9GUy50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiO0FBQ0EsMEJBQWtDLGFBQWEsQ0FBQyxDQUFBO0FBRWhELDBCQUF1QixhQUFhLENBQUMsQ0FBQTtBQUNyQyxJQUFPLElBQUksV0FBVyxNQUFNLENBQUMsQ0FBQztBQUM5Qiw4QkFBa0IsaUJBQWlCLENBQUMsQ0FBQTtBQUdwQyxJQUFPLE1BQU0sV0FBVyxVQUFVLENBQUMsQ0FBQztBQWNwQyxnQkFBb0MsRUFBSyxFQUFFLE9BQWU7SUFDeEQsRUFBRSxDQUFDLENBQUMsT0FBTyxDQUFDLENBQUMsQ0FBQztRQUNaLE1BQU0sQ0FBQyxFQUFFLENBQUM7SUFDWixDQUFDO0lBQUMsSUFBSSxDQUFDLENBQUM7UUFDTixFQUFFLENBQUMsQ0FBQyxPQUFPLEVBQUUsS0FBSyxVQUFVLENBQUMsQ0FBQyxDQUFDO1lBQzdCLE1BQU0sSUFBSSxvQkFBUSxDQUFDLHFCQUFTLENBQUMsTUFBTSxFQUFFLDhCQUE4QixDQUFDLENBQUM7UUFDdkUsQ0FBQztRQUlELEVBQUUsQ0FBQyxDQUFDLE9BQU8sWUFBWSxLQUFLLFdBQVcsQ0FBQyxDQUFDLENBQUM7WUFDeEMsTUFBTSxDQUFDLFlBQVksR0FBRyxDQUFDLENBQUM7UUFDMUIsQ0FBQztRQUNELFlBQVksRUFBRSxDQUFDO1FBRWYsTUFBTSxDQUFDLENBQUMsT0FBTyxDQUFDLENBQUMsQ0FBQztZQUNoQixLQUFLLENBQUM7Z0JBQ0osTUFBTSxDQUFPLFVBQVMsSUFBUztvQkFDN0IsWUFBWSxDQUFDO3dCQUNYLFlBQVksRUFBRSxDQUFDO3dCQUNmLE1BQU0sQ0FBQyxFQUFFLENBQUMsSUFBSSxDQUFDLENBQUM7b0JBQ2xCLENBQUMsQ0FBQyxDQUFDO2dCQUNMLENBQUMsQ0FBQztZQUNKLEtBQUssQ0FBQztnQkFDSixNQUFNLENBQU8sVUFBUyxJQUFTLEVBQUUsSUFBUztvQkFDeEMsWUFB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e0ZpbGV9IGZyb20gJy4vZmlsZSc7XG5pbXBvcnQge0FwaUVycm9yLCBFcnJvckNvZGV9IGZyb20gJy4vYXBpX2Vycm9yJztcbmltcG9ydCBmaWxlX3N5c3RlbSA9IHJlcXVpcmUoJy4vZmlsZV9zeXN0ZW0nKTtcbmltcG9ydCB7RmlsZUZsYWd9IGZyb20gJy4vZmlsZV9mbGFnJztcbmltcG9ydCBwYXRoID0gcmVxdWlyZSgncGF0aCcpO1xuaW1wb3J0IFN0YXRzIGZyb20gJy4vbm9kZV9mc19zdGF0cyc7XG4vLyBUeXBpbmcgaW5mbyBvbmx5LlxuaW1wb3J0IF9mcyA9IHJlcXVpcmUoJ2ZzJyk7XG5pbXBvcnQgZ2xvYmFsID0gcmVxdWlyZSgnLi9nbG9iYWwnKTtcblxuZGVjbGFyZSB2YXIgX19udW1XYWl0aW5nOiBudW1iZXI7XG5cbmRlY2xhcmUgdmFyIHNldEltbWVkaWF0ZTogKGNiOiBGdW5jdGlvbikgPT4gdm9pZDtcblxuZGVjbGFyZSB2YXIgUkVMRUFTRTogYm9vbGVhbjtcblxuLyoqXG4gKiBXcmFwcyBhIGNhbGxiYWNrIHdpdGggYSBzZXRJbW1lZGlhdGUgY2FsbC5cbiAqIEBwYXJhbSBbRnVuY3Rpb25dIGNiIFRoZSBjYWxsYmFjayB0byB3cmFwLlxuICogQHBhcmFtIFtOdW1iZXJdIG51bUFyZ3MgVGhlIG51bWJlciBvZiBhcmd1bWVudHMgdGhhdCB0aGUgY2FsbGJhY2sgdGFrZXMuXG4gKiBAcmV0dXJuIFtGdW5jdGlvbl0gVGhlIHdyYXBwZWQgY2FsbGJhY2suXG4gKi9cbmZ1bmN0aW9uIHdyYXBDYjxUIGV4dGVuZHMgRnVuY3Rpb24+KGNiOiBULCBudW1BcmdzOiBudW1iZXIpOiBUIHtcbiAgaWYgKFJFTEVBU0UpIHtcbiAgICByZXR1cm4gY2I7XG4gIH0gZWxzZSB7XG4gICAgaWYgKHR5cGVvZiBjYiAhPT0gJ2Z1bmN0aW9uJykge1xuICAgICAgdGhyb3cgbmV3IEFwaUVycm9yKEVycm9yQ29kZS5FSU5WQUwsICdDYWxsYmFjayBtdXN0IGJlIGEgZnVuY3Rpb24uJyk7XG4gICAgfVxuICAgIC8vIFRoaXMgaXMgdXNlZCBmb3IgdW5pdCB0ZXN0aW5nLlxuICAgIC8vIFdlIGNvdWxkIHVzZSBgYXJndW1lbnRzYCwgYnV0IEZ1bmN0aW9uLmNhbGwvYXBwbHkgaXMgZXhwZW5zaXZlLiBBbmQgd2Ugb25seVxuICAgIC8vIG5lZWQgdG8gaGFuZGxlIDEtMyBhcmd1bWVudHNcbiAgICBpZiAodHlwZW9mIF9fbnVtV2FpdGluZyA9PT0gJ3VuZGVmaW5lZCcpIHtcbiAgICAgIGdsb2JhbC5fX251bVdhaXRpbmcgPSAwO1xuICAgIH1cbiAgICBfX251bVdhaXRpbmcrKztcblxuICAgIHN3aXRjaCAobnVtQXJncykge1xuICAgICAgY2FzZSAxOlxuICAgICAgICByZXR1cm4gPGFueT4gZnVuY3Rpb24oYXJnMTogYW55KSB7XG4gICAgICAgICAgc2V0SW1tZWRpYXRlKGZ1bmN0aW9uKCkge1xuICAgICAgICAgICAgX19udW1XYWl0aW5nLS07XG4gICAgICAgICAgICByZXR1cm4gY2IoYXJnMSk7XG4gICAgICAgICAgfSk7XG4gICAgICAgIH07XG4gICAgICBjYXNlIDI6XG4gICAgICAgIHJldHVybiA8YW55PiBmdW5jdGlvbihhcmcxOiBhbnksIGFyZzI6IGFueSkge1xuICAgICAgICAgIHNldEltbWVkaWF0ZShmdW5jdGlvbigpIHtcbiAgICAgICAgICAgIF9fbnVtV2FpdGluZy0tO1xuICAgICAgICAgICAgcmV0dXJuIGNiKGFyZzEsIGFyZzIpO1xuICAgICAgICAgIH0pO1xuICAgICAgICB9O1xuICAgICAgY2FzZSAzOlxuICAgICAgICByZXR1cm4gPGFueT4gZnVuY3Rpb24oYXJnMTogYW55LCBhcmcyOiBhbnksIGFyZzM6IGFueSkge1xuICAgICAgICAgIHNldEltbWVkaWF0ZShmdW5jdGlvbigpIHtcbiAgICAgICAgICAgIF9fbnVtV2FpdGluZy0tO1xuICAgICAgICAgICAgcmV0dXJuIGNiKGFyZzEsIGFyZzIsIGFyZzMpO1xuICAgICAgICAgIH0pO1xuICAgICAgICB9O1xuICAgICAgZGVmYXVsdDpcbiAgICAgICAgdGhyb3cgbmV3IEVycm9yKCdJbnZhbGlkIGludm9jYXRpb24gb2Ygd3JhcENiLicpO1xuICAgIH1cbiAgfVxufVxuXG5mdW5jdGlvbiBub3JtYWxpemVNb2RlKG1vZGU6IG51bWJlcnxzdHJpbmcsIGRlZjogbnVtYmVyKTogbnVtYmVyIHtcbiAgc3dpdGNoKHR5cGVvZiBtb2RlKSB7XG4gICAgY2FzZSAnbnVtYmVyJzpcbiAgICAgIC8vIChwYXRoLCBmbGFnLCBtb2RlLCBjYj8pXG4gICAgICByZXR1cm4gPG51bWJlcj4gbW9kZTtcbiAgICBjYXNlICdzdHJpbmcnOlxuICAgICAgLy8gKHBhdGgsIGZsYWcsIG1vZGVTdHJpbmcsIGNiPylcbiAgICAgIHZhciB0cnVlTW9kZSA9IHBhcnNlSW50KDxzdHJpbmc+IG1vZGUsIDgpO1xuICAgICAgaWYgKHRydWVNb2RlICE9PSBOYU4pIHtcbiAgICAgICAgcmV0dXJuIHRydWVNb2RlO1xuICAgICAgfVxuICAgICAgLy8gRkFMTCBUSFJPVUdIIGlmIG1vZGUgaXMgYW4gaW52YWxpZCBzdHJpbmchXG4gICAgZGVmYXVsdDpcbiAgICAgIHJldHVybiBkZWY7XG4gIH1cbn1cblxuZnVuY3Rpb24gbm9ybWFsaXplVGltZSh0aW1lOiBudW1iZXIgfCBEYXRlKTogRGF0ZSB7XG4gIGlmICh0aW1lIGluc3RhbmNlb2YgRGF0ZSkge1xuICAgIHJldHVybiB0aW1lO1xuICB9IGVsc2UgaWYgKHR5cGVvZiB0aW1lID09PSAnbnVtYmVyJykge1xuICAgIHJldHVybiBuZXcgRGF0ZSh0aW1lICogMTAwMCk7XG4gIH0gZWxzZSB7XG4gICAgdGhyb3cgbmV3IEFwaUVycm9yKEVycm9yQ29kZS5FSU5WQUwsIGBJbnZhbGlkIHRpbWUuYCk7XG4gIH1cbn1cblxuZnVuY3Rpb24gbm9ybWFsaXplUGF0aChwOiBzdHJpbmcpOiBzdHJpbmcge1xuICAvLyBOb2RlIGRvZXNuJ3QgYWxsb3cgbnVsbCBjaGFyYWN0ZXJzIGluIHBhdGhzLlxuICBpZiAocC5pbmRleE9mKCdcXHUwMDAwJykgPj0gMCkge1xuICAgIHRocm93IG5ldyBBcGlFcnJvcihFcnJvckNvZGUuRUlOVkFMLCAnUGF0aCBtdXN0IGJlIGEgc3RyaW5nIHdpdGhvdXQgbnVsbCBieXRlcy4nKTtcbiAgfSBlbHNlIGlmIChwID09PSAnJykge1xuICAgIHRocm93IG5ldyBBcGlFcnJvcihFcnJvckNvZGUuRUlOVkFMLCAnUGF0aCBtdXN0IG5vdCBiZSBlbXB0eS4nKTtcbiAgfVxuICByZXR1cm4gcGF0aC5yZXNvbHZlKHApO1xufVxuXG5mdW5jdGlvbiBub3JtYWxpemVPcHRpb25zKG9wdGlvbnM6IGFueSwgZGVmRW5jOiBzdHJpbmcsIGRlZkZsYWc6IHN0cmluZywgZGVmTW9kZTogbnVtYmVyKToge2VuY29kaW5nOiBzdHJpbmc7IGZsYWc6IHN0cmluZzsgbW9kZTogbnVtYmVyfSB7XG4gIHN3aXRjaCAodHlwZW9mIG9wdGlvbnMpIHtcbiAgICBjYXNlICdvYmplY3QnOlxuICAgICAgcmV0dXJuIHtcbiAgICAgICAgZW5jb2Rpbmc6IHR5cGVvZiBvcHRpb25zWydlbmNvZGluZyddICE9PSAndW5kZWZpbmVkJyA/IG9wdGlvbnNbJ2VuY29kaW5nJ10gOiBkZWZFbmMsXG4gICAgICAgIGZsYWc6IHR5cGVvZiBvcHRpb25zWydmbGFnJ10gIT09ICd1bmRlZmluZWQnID8gb3B0aW9uc1snZmxhZyddIDogZGVmRmxhZyxcbiAgICAgICAgbW9kZTogbm9ybWFsaXplTW9kZShvcHRpb25zWydtb2RlJ10sIGRlZk1vZGUpXG4gICAgICB9O1xuICAgIGNhc2UgJ3N0cmluZyc6XG4gICAgICByZXR1cm4ge1xuICAgICAgICBlbmNvZGluZzogb3B0aW9ucyxcbiAgICAgICAgZmxhZzogZGVmRmxhZyxcbiAgICAgICAgbW9kZTogZGVmTW9kZVxuICAgICAgfTtcbiAgICBkZWZhdWx0OlxuICAgICAgcmV0dXJuIHtcbiAgICAgICAgZW5jb2Rpbmc6IGRlZkVuYyxcbiAgICAgICAgZmxhZzogZGVmRmxhZyxcbiAgICAgICAgbW9kZTogZGVmTW9kZVxuICAgICAgfTtcbiAgfVxufVxuXG4vLyBUaGUgZGVmYXVsdCBjYWxsYmFjayBpcyBhIE5PUC5cbmZ1bmN0aW9uIG5vcENiKCkge307XG5cbi8qKlxuICogVGhlIG5vZGUgZnJvbnRlbmQgdG8gYWxsIGZpbGVzeXN0ZW1zLlxuICogVGhpcyBsYXllciBoYW5kbGVzOlxuICpcbiAqICogU2FuaXR5IGNoZWNraW5nIGlucHV0cy5cbiAqICogTm9ybWFsaXppbmcgcGF0aHMuXG4gKiAqIFJlc2V0dGluZyBzdGFjayBkZXB0aCBmb3IgYXN5bmNocm9ub3VzIG9wZXJhdGlvbnMgd2hpY2ggbWF5IG5vdCBnbyB0aHJvdWdoXG4gKiAgIHRoZSBicm93c2VyIGJ5IHdyYXBwaW5nIGFsbCBpbnB1dCBjYWxsYmFja3MgdXNpbmcgYHNldEltbWVkaWF0ZWAuXG4gKiAqIFBlcmZvcm1pbmcgdGhlIHJlcXVlc3RlZCBvcGVyYXRpb24gdGhyb3VnaCB0aGUgZmlsZXN5c3RlbSBvciB0aGUgZmlsZVxuICogICBkZXNjcmlwdG9yLCBhcyBhcHByb3ByaWF0ZS5cbiAqICogSGFuZGxpbmcgb3B0aW9uYWwgYXJndW1lbnRzIGFuZCBzZXR0aW5nIGRlZmF1bHQgYXJndW1lbnRzLlxuICogQHNlZSBodHRwOi8vbm9kZWpzLm9yZy9hcGkvZnMuaHRtbFxuICogQGNsYXNzXG4gKi9cbmV4cG9ydCBkZWZhdWx0IGNsYXNzIEZTIHtcbiAgLy8gRXhwb3J0ZWQgZnMuU3RhdHMuXG4gIHB1YmxpYyBzdGF0aWMgU3RhdHMgPSBTdGF0cztcblxuICBwcml2YXRlIHJvb3Q6IGZpbGVfc3lzdGVtLkZpbGVTeXN0ZW0gPSBudWxsO1xuICBwcml2YXRlIGZkTWFwOiB7W2ZkOiBudW1iZXJdOiBGaWxlfSA9IHt9O1xuICBwcml2YXRlIG5leHRGZCA9IDEwMDtcbiAgcHJpdmF0ZSBnZXRGZEZvckZpbGUoZmlsZTogRmlsZSk6IG51bWJlciB7XG4gICAgbGV0IGZkID0gdGhpcy5uZXh0RmQrKztcbiAgICB0aGlzLmZkTWFwW2ZkXSA9IGZpbGU7XG4gICAgcmV0dXJuIGZkO1xuICB9XG4gIHByaXZhdGUgZmQyZmlsZShmZDogbnVtYmVyKTogRmlsZSB7XG4gICAgbGV0IHJ2ID0gdGhpcy5mZE1hcFtmZF07XG4gICAgaWYgKHJ2KSB7XG4gICAgICByZXR1cm4gcnY7XG4gICAgfSBlbHNlIHtcbiAgICAgIHRocm93IG5ldyBBcGlFcnJvcihFcnJvckNvZGUuRUJBREYsICdJbnZhbGlkIGZpbGUgZGVzY3JpcHRvci4nKTtcbiAgICB9XG4gIH1cbiAgcHJpdmF0ZSBjbG9zZUZkKGZkOiBudW1iZXIpOiB2b2lkIHtcbiAgICBkZWxldGUgdGhpcy5mZE1hcFtmZF07XG4gIH1cblxuICBwdWJsaWMgaW5pdGlhbGl6ZShyb290RlM6IGZpbGVfc3lzdGVtLkZpbGVTeXN0ZW0pOiBmaWxlX3N5c3RlbS5GaWxlU3lzdGVtIHtcbiAgICBpZiAoISg8YW55PiByb290RlMpLmNvbnN0cnVjdG9yLmlzQXZhaWxhYmxlKCkpIHtcbiAgICAgIHRocm93IG5ldyBBcGlFcnJvcihFcnJvckNvZGUuRUlOVkFMLCAnVHJpZWQgdG8gaW5zdGFudGlhdGUgQnJvd3NlckZTIHdpdGggYW4gdW5hdmFpbGFibGUgZmlsZSBzeXN0ZW0uJyk7XG4gICAgfVxuICAgIHJldHVybiB0aGlzLnJvb3QgPSByb290RlM7XG4gIH1cblxuICAvKipcbiAgICogY29udmVydHMgRGF0ZSBvciBudW1iZXIgdG8gYSBmcmFjdGlvbmFsIFVOSVggdGltZXN0YW1wXG4gICAqIEdyYWJiZWQgZnJvbSBOb2RlSlMgc291cmNlcyAobGliL2ZzLmpzKVxuICAgKi9cbiAgcHVibGljIF90b1VuaXhUaW1lc3RhbXAodGltZTogRGF0ZSB8IG51bWJlcik6IG51bWJlciB7XG4gICAgaWYgKHR5cGVvZiB0aW1lID09PSAnbnVtYmVyJykge1xuICAgICAgcmV0dXJuIHRpbWU7XG4gICAgfSBlbHNlIGlmICh0aW1lIGluc3RhbmNlb2YgRGF0ZSkge1xuICAgICAgcmV0dXJuIHRpbWUuZ2V0VGltZSgpIC8gMTAwMDtcbiAgICB9XG4gICAgdGhyb3cgbmV3IEVycm9yKFwiQ2Fubm90IHBhcnNlIHRpbWU6IFwiICsgdGltZSk7XG4gIH1cblxuICAvKipcbiAgICogKipOT05TVEFOREFSRCoqOiBHcmFiIHRoZSBGaWxlU3lzdGVtIGluc3RhbmNlIHRoYXQgYmFja3MgdGhpcyBBUEkuXG4gICAqIEByZXR1cm4gW0Jyb3dzZXJGUy5GaWxlU3lzdGVtIHwgbnVsbF0gUmV0dXJucyBudWxsIGlmIHRoZSBmaWxlIHN5c3RlbSBoYXNcbiAgICogICBub3QgYmVlbiBpbml0aWFsaXplZC5cbiAgICovXG4gIHB1YmxpYyBnZXRSb290RlMoKTogZmlsZV9zeXN0ZW0uRmlsZVN5c3RlbSB7XG4gICAgaWYgKHRoaXMucm9vdCkge1xuICAgICAgcmV0dXJuIHRoaXMucm9vdDtcbiAgICB9IGVsc2Uge1xuICAgICAgcmV0dXJuIG51bGw7XG4gICAgfVxuICB9XG5cbiAgLy8gRklMRSBPUiBESVJFQ1RPUlkgTUVUSE9EU1xuXG4gIC8qKlxuICAgKiBBc3luY2hyb25vdXMgcmVuYW1lLiBObyBhcmd1bWVudHMgb3RoZXIgdGhhbiBhIHBvc3NpYmxlIGV4Y2VwdGlvbiBhcmUgZ2l2ZW5cbiAgICogdG8gdGhlIGNvbXBsZXRpb24gY2FsbGJhY2suXG4gICAqIEBwYXJhbSBbU3RyaW5nXSBvbGRQYXRoXG4gICAqIEBwYXJhbSBbU3RyaW5nXSBuZXdQYXRoXG4gICAqIEBwYXJhbSBbRnVuY3Rpb24oQnJvd3NlckZTLkFwaUVycm9yKV0gY2FsbGJhY2tcbiAgICovXG4gIHB1YmxpYyByZW5hbWUob2xkUGF0aDogc3RyaW5nLCBuZXdQYXRoOiBzdHJpbmcsIGNiOiAoZXJyPzogQXBpRXJyb3IpID0+IHZvaWQgPSBub3BDYik6IHZvaWQge1xuICAgIHZhciBuZXdDYiA9IHdyYXBDYihjYiwgMSk7XG4gICAgdHJ5IHtcbiAgICAgIHRoaXMucm9vdC5yZW5hbWUobm9ybWFsaXplUGF0aChvbGRQYXRoKSwgbm9ybWFsaXplUGF0aChuZXdQYXRoKSwgbmV3Q2IpO1xuICAgIH0gY2F0Y2ggKGUpIHtcbiAgICAgIG5ld0NiKGUpO1xuICAgIH1cbiAgfVxuXG4gIC8qKlxuICAgKiBTeW5jaHJvbm91cyByZW5hbWUuXG4gICAqIEBwYXJhbSBbU3RyaW5nXSBvbGRQYXRoXG4gICAqIEBwYXJhbSBbU3RyaW5nXSBuZXdQYXRoXG4gICAqL1xuICBwdWJsaWMgcmVuYW1lU3luYyhvbGRQYXRoOiBzdHJpbmcsIG5ld1BhdGg6IHN0cmluZyk6IHZvaWQge1xuICAgIHRoaXMucm9vdC5yZW5hbWVTeW5jKG5vcm1hbGl6ZVBhdGgob2xkUGF0aCksIG5vcm1hbGl6ZVBhdGgobmV3UGF0aCkpO1xuICB9XG5cbiAgLyoqXG4gICAqIFRlc3Qgd2hldGhlciBvciBub3QgdGhlIGdpdmVuIHBhdGggZXhpc3RzIGJ5IGNoZWNraW5nIHdpdGggdGhlIGZpbGUgc3lzdGVtLlxuICAgKiBUaGVuIGNhbGwgdGhlIGNhbGxiYWNrIGFyZ3VtZW50IHdpdGggZWl0aGVyIHRydWUgb3IgZmFsc2UuXG4gICAqIEBleGFtcGxlIFNhbXBsZSBpbnZvY2F0aW9uXG4gICAqICAgZnMuZXhpc3RzKCcvZXRjL3Bhc3N3ZCcsIGZ1bmN0aW9uIChleGlzdHMpIHtcbiAgICogICAgIHV0aWwuZGVidWcoZXhpc3RzID8gXCJpdCdzIHRoZXJlXCIgOiBcIm5vIHBhc3N3ZCFcIik7XG4gICAqICAgfSk7XG4gICAqIEBwYXJhbSBbU3RyaW5nXSBwYXRoXG4gICAqIEBwYXJhbSBbRnVuY3Rpb24oQm9vbGVhbildIGNhbGxiYWNrXG4gICAqL1xuICBwdWJsaWMgZXhpc3RzKHBhdGg6IHN0cmluZywgY2I6IChleGlzdHM6IGJvb2xlYW4pID0+IHZvaWQgPSBub3BDYik6IHZvaWQge1xuICAgIHZhciBuZXdDYiA9IHdyYXBDYihjYiwgMSk7XG4gICAgdHJ5IHtcbiAgICAgIHJldHVybiB0aGlzLnJvb3QuZXhpc3RzKG5vcm1hbGl6ZVBhdGgocGF0aCksIG5ld0NiKTtcbiAgICB9IGNhdGNoIChlKSB7XG4gICAgICAvLyBEb2Vzbid0IHJldHVybiBhbiBlcnJvci4gSWYgc29tZXRoaW5nIGJhZCBoYXBwZW5zLCB3ZSBhc3N1bWUgaXQganVzdFxuICAgICAgLy8gZG9lc24ndCBleGlzdC5cbiAgICAgIHJldHVybiBuZXdDYihmYWxzZSk7XG4gICAgfVxuICB9XG5cbiAgLyoqXG4gICAqIFRlc3Qgd2hldGhlciBvciBub3QgdGhlIGdpdmVuIHBhdGggZXhpc3RzIGJ5IGNoZWNraW5nIHdpdGggdGhlIGZpbGUgc3lzdGVtLlxuICAgKiBAcGFyYW0gW1N0cmluZ10gcGF0aFxuICAgKiBAcmV0dXJuIFtib29sZWFuXVxuICAgKi9cbiAgcHVibGljIGV4aXN0c1N5bmMocGF0aDogc3RyaW5nKTogYm9vbGVhbiB7XG4gICAgdHJ5IHtcbiAgICAgIHJldHVybiB0aGlzLnJvb3QuZXhpc3RzU3luYyhub3JtYWxpemVQYXRoKHBhdGgpKTtcbiAgICB9IGNhdGNoIChlKSB7XG4gICAgICAvLyBEb2Vzbid0IHJldHVybiBhbiBlcnJvci4gSWYgc29tZXRoaW5nIGJhZCBoYXBwZW5zLCB3ZSBhc3N1bWUgaXQganVzdFxuICAgICAgLy8gZG9lc24ndCBleGlzdC5cbiAgICAgIHJldHVybiBmYWxzZTtcbiAgICB9XG4gIH1cblxuICAvKipcbiAgICogQXN5bmNocm9ub3VzIGBzdGF0YC5cbiAgICogQHBhcmFtIFtTdHJpbmddIHBhdGhcbiAgICogQHBhcmFtIFtGdW5jdGlvbihCcm93c2VyRlMuQXBpRXJyb3IsIEJyb3dzZXJGUy5ub2RlLmZzLlN0YXRzKV0gY2FsbGJhY2tcbiAgICovXG4gIHB1YmxpYyBzdGF0KHBhdGg6IHN0cmluZywgY2I6IChlcnI6IEFwaUVycm9yLCBzdGF0cz86IFN0YXRzKSA9PiBhbnkgPSBub3BDYik6IHZvaWQge1xuICAgIHZhciBuZXdDYiA9IHdyYXBDYihjYiwgMik7XG4gICAgdHJ5IHtcbiAgICAgIHJldHVybiB0aGlzLnJvb3Quc3RhdChub3JtYWxpemVQYXRoKHBhdGgpLCBmYWxzZSwgbmV3Q2IpO1xuICAgIH0gY2F0Y2ggKGUpIHtcbiAgICAgIHJldHVybiBuZXdDYihlLCBudWxsKTtcbiAgICB9XG4gIH1cblxuICAvKipcbiAgICogU3luY2hyb25vdXMgYHN0YXRgLlxuICAgKiBAcGFyYW0gW1N0cmluZ10gcGF0aFxuICAgKiBAcmV0dXJuIFtCcm93c2VyRlMubm9kZS5mcy5TdGF0c11cbiAgICovXG4gIHB1YmxpYyBzdGF0U3luYyhwYXRoOiBzdHJpbmcpOiBTdGF0cyB7XG4gICAgcmV0dXJuIHRoaXMucm9vdC5zdGF0U3luYyhub3JtYWxpemVQYXRoKHBhdGgpLCBmYWxzZSk7XG4gIH1cblxuICAvKipcbiAgICogQXN5bmNocm9ub3VzIGBsc3RhdGAuXG4gICAqIGBsc3RhdCgpYCBpcyBpZGVudGljYWwgdG8gYHN0YXQoKWAsIGV4Y2VwdCB0aGF0IGlmIHBhdGggaXMgYSBzeW1ib2xpYyBsaW5rLFxuICAgKiB0aGVuIHRoZSBsaW5rIGl0c2VsZiBpcyBzdGF0LWVkLCBub3QgdGhlIGZpbGUgdGhhdCBpdCByZWZlcnMgdG8uXG4gICAqIEBwYXJhbSBbU3RyaW5nXSBwYXRoXG4gICAqIEBwYXJhbSBbRnVuY3Rpb24oQnJvd3NlckZTLkFwaUVycm9yLCBCcm93c2VyRlMubm9kZS5mcy5TdGF0cyldIGNhbGxiYWNrXG4gICAqL1xuICBwdWJsaWMgbHN0YXQocGF0aDogc3RyaW5nLCBjYjogKGVycjogQXBpRXJyb3IsIHN0YXRzPzogU3RhdHMpID0+IGFueSA9IG5vcENiKTogdm9pZCB7XG4gICAgdmFyIG5ld0NiID0gd3JhcENiKGNiLCAyKTtcbiAgICB0cnkge1xuICAgICAgcmV0dXJuIHRoaXMucm9vdC5zdGF0KG5vcm1hbGl6ZVBhdGgocGF0aCksIHRydWUsIG5ld0NiKTtcbiAgICB9IGNhdGNoIChlKSB7XG4gICAgICByZXR1cm4gbmV3Q2IoZSwgbnVsbCk7XG4gICAgfVxuICB9XG5cbiAgLyoqXG4gICAqIFN5bmNocm9ub3VzIGBsc3RhdGAuXG4gICAqIGBsc3RhdCgpYCBpcyBpZGVudGljYWwgdG8gYHN0YXQoKWAsIGV4Y2VwdCB0aGF0IGlmIHBhdGggaXMgYSBzeW1ib2xpYyBsaW5rLFxuICAgKiB0aGVuIHRoZSBsaW5rIGl0c2VsZiBpcyBzdGF0LWVkLCBub3QgdGhlIGZpbGUgdGhhdCBpdCByZWZlcnMgdG8uXG4gICAqIEBwYXJhbSBbU3RyaW5nXSBwYXRoXG4gICAqIEByZXR1cm4gW0Jyb3dzZXJGUy5ub2RlLmZzLlN0YXRzXVxuICAgKi9cbiAgcHVibGljIGxzdGF0U3luYyhwYXRoOiBzdHJpbmcpOiBTdGF0cyB7XG4gICAgcmV0dXJuIHRoaXMucm9vdC5zdGF0U3luYyhub3JtYWxpemVQYXRoKHBhdGgpLCB0cnVlKTtcbiAgfVxuXG4gIC8vIEZJTEUtT05MWSBNRVRIT0RTXG5cbiAgLyoqXG4gICAqIEFzeW5jaHJvbm91cyBgdHJ1bmNhdGVgLlxuICAgKiBAcGFyYW0gW1N0cmluZ10gcGF0aFxuICAgKiBAcGFyYW0gW051bWJlcl0gbGVuXG4gICAqIEBwYXJhbSBbRnVuY3Rpb24oQnJvd3NlckZTLkFwaUVycm9yKV0gY2FsbGJhY2tcbiAgICovXG4gIHB1YmxpYyB0cnVuY2F0ZShwYXRoOiBzdHJpbmcsIGNiPzogKGVycj86IEFwaUVycm9yKSA9PiB2b2lkKTogdm9pZDtcbiAgcHVibGljIHRydW5jYXRlKHBhdGg6IHN0cmluZywgbGVuOiBudW1iZXIsIGNiPzogKGVycj86IEFwaUVycm9yKSA9PiB2b2lkKTogdm9pZDtcbiAgcHVibGljIHRydW5jYXRlKHBhdGg6IHN0cmluZywgYXJnMjogYW55ID0gMCwgY2I6IChlcnI/OiBBcGlFcnJvcikgPT4gdm9pZCA9IG5vcENiKTogdm9pZCB7XG4gICAgdmFyIGxlbiA9IDA7XG4gICAgaWYgKHR5cGVvZiBhcmcyID09PSAnZnVuY3Rpb24nKSB7XG4gICAgICBjYiA9IGFyZzI7XG4gICAgfSBlbHNlIGlmICh0eXBlb2YgYXJnMiA9PT0gJ251bWJlcicpIHtcbiAgICAgIGxlbiA9IGFyZzI7XG4gICAgfVxuXG4gICAgdmFyIG5ld0NiID0gd3JhcENiKGNiLCAxKTtcbiAgICB0cnkge1xuICAgICAgaWYgKGxlbiA8IDApIHtcbiAgICAgICAgdGhyb3cgbmV3IEFwaUVycm9yKEVycm9yQ29kZS5FSU5WQUwpO1xuICAgICAgfVxuICAgICAgcmV0dXJuIHRoaXMucm9vdC50cnVuY2F0ZShub3JtYWxpemVQYXRoKHBhdGgpLCBsZW4sIG5ld0NiKTtcbiAgICB9IGNhdGNoIChlKSB7XG4gICAgICByZXR1cm4gbmV3Q2IoZSk7XG4gICAgfVxuICB9XG5cbiAgLyoqXG4gICAqIFN5bmNocm9ub3VzIGB0cnVuY2F0ZWAuXG4gICAqIEBwYXJhbSBbU3RyaW5nXSBwYXRoXG4gICAqIEBwYXJhbSBbTnVtYmVyXSBsZW5cbiAgICovXG4gIHB1YmxpYyB0cnVuY2F0ZVN5bmMocGF0aDogc3RyaW5nLCBsZW46IG51bWJlciA9IDApOiB2b2lkIHtcbiAgICBpZiAobGVuIDwgMCkge1xuICAgICAgdGhyb3cgbmV3IEFwaUVycm9yKEVycm9yQ29kZS5FSU5WQUwpO1xuICAgIH1cbiAgICByZXR1cm4gdGhpcy5yb290LnRydW5jYXRlU3luYyhub3JtYWxpemVQYXRoKHBhdGgpLCBsZW4pO1xuICB9XG5cbiAgLyoqXG4gICAqIEFzeW5jaHJvbm91cyBgdW5saW5rYC5cbiAgICogQHBhcmFtIFtTdHJpbmddIHBhdGhcbiAgICogQHBhcmFtIFtGdW5jdGlvbihCcm93c2VyRlMuQXBpRXJyb3IpXSBjYWxsYmFja1xuICAgKi9cbiAgcHVibGljIHVubGluayhwYXRoOiBzdHJpbmcsIGNiOiAoZXJyPzogQXBpRXJyb3IpID0+IHZvaWQgPSBub3BDYik6IHZvaWQge1xuICAgIHZhciBuZXdDYiA9IHdyYXBDYihjYiwgMSk7XG4gICAgdHJ5IHtcbiAgICAgIHJldHVybiB0aGlzLnJvb3QudW5saW5rKG5vcm1hbGl6ZVBhdGgocGF0aCksIG5ld0NiKTtcbiAgICB9IGNhdGNoIChlKSB7XG4gICAgICByZXR1cm4gbmV3Q2IoZSk7XG4gICAgfVxuICB9XG5cbiAgLyoqXG4gICAqIFN5bmNocm9ub3VzIGB1bmxpbmtgLlxuICAgKiBAcGFyYW0gW1N0cmluZ10gcGF0aFxuICAgKi9cbiAgcHVibGljIHVubGlua1N5bmMocGF0aDogc3RyaW5nKTogdm9pZCB7XG4gICAgcmV0dXJuIHRoaXMucm9vdC51bmxpbmtTeW5jKG5vcm1hbGl6ZVBhdGgocGF0aCkpO1xuICB9XG5cbiAgLyoqXG4gICAqIEFzeW5jaHJvbm91cyBmaWxlIG9wZW4uXG4gICAqIEV4Y2x1c2l2ZSBtb2RlIGVuc3VyZXMgdGhhdCBwYXRoIGlzIG5ld2x5IGNyZWF0ZWQuXG4gICAqXG4gICAqIGBmbGFnc2AgY2FuIGJlOlxuICAgKlxuICAgKiAqIGAncidgIC0gT3BlbiBmaWxlIGZvciByZWFkaW5nLiBBbiBleGNlcHRpb24gb2NjdXJzIGlmIHRoZSBmaWxlIGRvZXMgbm90IGV4aXN0LlxuICAgKiAqIGAncisnYCAtIE9wZW4gZmlsZSBmb3IgcmVhZGluZyBhbmQgd3JpdGluZy4gQW4gZXhjZXB0aW9uIG9jY3VycyBpZiB0aGUgZmlsZSBkb2VzIG5vdCBleGlzdC5cbiAgICogKiBgJ3JzJ2AgLSBPcGVuIGZpbGUgZm9yIHJlYWRpbmcgaW4gc3luY2hyb25vdXMgbW9kZS4gSW5zdHJ1Y3RzIHRoZSBmaWxlc3lzdGVtIHRvIG5vdCBjYWNoZSB3cml0ZXMuXG4gICAqICogYCdycysnYCAtIE9wZW4gZmlsZSBmb3IgcmVhZGluZyBhbmQgd3JpdGluZywgYW5kIG9wZW5zIHRoZSBmaWxlIGluIHN5bmNocm9ub3VzIG1vZGUuXG4gICAqICogYCd3J2AgLSBPcGVuIGZpbGUgZm9yIHdyaXRpbmcuIFRoZSBmaWxlIGlzIGNyZWF0ZWQgKGlmIGl0IGRvZXMgbm90IGV4aXN0KSBvciB0cnVuY2F0ZWQgKGlmIGl0IGV4aXN0cykuXG4gICAqICogYCd3eCdgIC0gTGlrZSAndycgYnV0IG9wZW5zIHRoZSBmaWxlIGluIGV4Y2x1c2l2ZSBtb2RlLlxuICAgKiAqIGAndysnYCAtIE9wZW4gZmlsZSBmb3IgcmVhZGluZyBhbmQgd3JpdGluZy4gVGhlIGZpbGUgaXMgY3JlYXRlZCAoaWYgaXQgZG9lcyBub3QgZXhpc3QpIG9yIHRydW5jYXRlZCAoaWYgaXQgZXhpc3RzKS5cbiAgICogKiBgJ3d4KydgIC0gTGlrZSAndysnIGJ1dCBvcGVucyB0aGUgZmlsZSBpbiBleGNsdXNpdmUgbW9kZS5cbiAgICogKiBgJ2EnYCAtIE9wZW4gZmlsZSBmb3IgYXBwZW5kaW5nLiBUaGUgZmlsZSBpcyBjcmVhdGVkIGlmIGl0IGRvZXMgbm90IGV4aXN0LlxuICAgKiAqIGAnYXgnYCAtIExpa2UgJ2EnIGJ1dCBvcGVucyB0aGUgZmlsZSBpbiBleGNsdXNpdmUgbW9kZS5cbiAgICogKiBgJ2ErJ2AgLSBPcGVuIGZpbGUgZm9yIHJlYWRpbmcgYW5kIGFwcGVuZGluZy4gVGhlIGZpbGUgaXMgY3JlYXRlZCBpZiBpdCBkb2VzIG5vdCBleGlzdC5cbiAgICogKiBgJ2F4KydgIC0gTGlrZSAnYSsnIGJ1dCBvcGVucyB0aGUgZmlsZSBpbiBleGNsdXNpdmUgbW9kZS5cbiAgICpcbiAgICogQHNlZSBodHRwOi8vd3d3Lm1hbnBhZ2V6LmNvbS9tYW4vMi9vcGVuL1xuICAgKiBAcGFyYW0gW1N0cmluZ10gcGF0aFxuICAgKiBAcGFyYW0gW1N0cmluZ10gZmxhZ3NcbiAgICogQHBhcmFtIFtOdW1iZXI/XSBtb2RlIGRlZmF1bHRzIHRvIGAwNjQ0YFxuICAgKiBAcGFyYW0gW0Z1bmN0aW9uKEJyb3dzZXJGUy5BcGlFcnJvciwgQnJvd3NlckZTLkZpbGUpXSBjYWxsYmFja1xuICAgKi9cbiAgcHVibGljIG9wZW4ocGF0aDogc3RyaW5nLCBmbGFnOiBzdHJpbmcsIGNiPzogKGVycjogQXBpRXJyb3IsIGZkPzogbnVtYmVyKSA9PiBhbnkpOiB2b2lkO1xuICBwdWJsaWMgb3BlbihwYXRoOiBzdHJpbmcsIGZsYWc6IHN0cmluZywgbW9kZTogbnVtYmVyfHN0cmluZywgY2I/OiAoZXJyOiBBcGlFcnJvciwgZmQ/OiBudW1iZXIpID0+IGFueSk6IHZvaWQ7XG4gIHB1YmxpYyBvcGVuKHBhdGg6IHN0cmluZywgZmxhZzogc3RyaW5nLCBhcmcyPzogYW55LCBjYjogKGVycjogQXBpRXJyb3IsIGZkPzogbnVtYmVyKSA9PiBhbnkgPSBub3BDYik6IHZvaWQge1xuICAgIHZhciBtb2RlID0gbm9ybWFsaXplTW9kZShhcmcyLCAweDFhNCk7XG4gICAgY2IgPSB0eXBlb2YgYXJnMiA9PT0gJ2Z1bmN0aW9uJyA/IGFyZzIgOiBjYjtcbiAgICB2YXIgbmV3Q2IgPSB3cmFwQ2IoY2IsIDIpO1xuICAgIHRyeSB7XG4gICAgICB0aGlzLnJvb3Qub3Blbihub3JtYWxpemVQYXRoKHBhdGgpLCBGaWxlRmxhZy5nZXRGaWxlRmxhZyhmbGFnKSwgbW9kZSwgKGU6IEFwaUVycm9yLCBmaWxlPzogRmlsZSkgPT4ge1xuICAgICAgICBpZiAoZmlsZSkge1xuICAgICAgICAgIG5ld0NiKGUsIHRoaXMuZ2V0RmRGb3JGaWxlKGZpbGUpKTtcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICBuZXdDYihlKTtcbiAgICAgICAgfVxuICAgICAgfSk7XG4gICAgfSBjYXRjaCAoZSkge1xuICAgICAgbmV3Q2IoZSwgbnVsbCk7XG4gICAgfVxuICB9XG5cbiAgLyoqXG4gICAqIFN5bmNocm9ub3VzIGZpbGUgb3Blbi5cbiAgICogQHNlZSBodHRwOi8vd3d3Lm1hbnBhZ2V6LmNvbS9tYW4vMi9vcGVuL1xuICAgKiBAcGFyYW0gW1N0cmluZ10gcGF0aFxuICAgKiBAcGFyYW0gW1N0cmluZ10gZmxhZ3NcbiAgICogQHBhcmFtIFtOdW1iZXI/XSBtb2RlIGRlZmF1bHRzIHRvIGAwNjQ0YFxuICAgKiBAcmV0dXJuIFtCcm93c2VyRlMuRmlsZV1cbiAgICovXG4gIHB1YmxpYyBvcGVuU3luYyhwYXRoOiBzdHJpbmcsIGZsYWc6IHN0cmluZywgbW9kZTogbnVtYmVyfHN0cmluZyA9IDB4MWE0KTogbnVtYmVyIHtcbiAgICByZXR1cm4gdGhpcy5nZXRGZEZvckZpbGUoXG4gICAgICB0aGlzLnJvb3Qub3BlblN5bmMobm9ybWFsaXplUGF0aChwYXRoKSwgRmlsZUZsYWcuZ2V0RmlsZUZsYWcoZmxhZyksIG5vcm1hbGl6ZU1vZGUobW9kZSwgMHgxYTQpKSk7XG4gIH1cblxuICAvKipcbiAgICogQXN5bmNocm9ub3VzbHkgcmVhZHMgdGhlIGVudGlyZSBjb250ZW50cyBvZiBhIGZpbGUuXG4gICAqIEBleGFtcGxlIFVzYWdlIGV4YW1wbGVcbiAgICogICBmcy5yZWFkRmlsZSgnL2V0Yy9wYXNzd2QnLCBmdW5jdGlvbiAoZXJyLCBkYXRhKSB7XG4gICAqICAgICBpZiAoZXJyKSB0aHJvdyBlcnI7XG4gICAqICAgICBjb25zb2xlLmxvZyhkYXRhKTtcbiAgICogICB9KTtcbiAgICogQHBhcmFtIFtTdHJpbmddIGZpbGVuYW1lXG4gICAqIEBwYXJhbSBbT2JqZWN0P10gb3B0aW9uc1xuICAgKiBAb3B0aW9uIG9wdGlvbnMgW1N0cmluZ10gZW5jb2RpbmcgVGhlIHN0cmluZyBlbmNvZGluZyBmb3IgdGhlIGZpbGUgY29udGVudHMuIERlZmF1bHRzIHRvIGBudWxsYC5cbiAgICogQG9wdGlvbiBvcHRpb25zIFtTdHJpbmddIGZsYWcgRGVmYXVsdHMgdG8gYCdyJ2AuXG4gICAqIEBwYXJhbSBbRnVuY3Rpb24oQnJvd3NlckZTLkFwaUVycm9yLCBTdHJpbmcgfCBCcm93c2VyRlMubm9kZS5CdWZmZXIpXSBjYWxsYmFjayBJZiBubyBlbmNvZGluZyBpcyBzcGVjaWZpZWQsIHRoZW4gdGhlIHJhdyBidWZmZXIgaXMgcmV0dXJuZWQuXG4gICAqL1xuICBwdWJsaWMgcmVhZEZpbGUoZmlsZW5hbWU6IHN0cmluZywgY2I6IChlcnI6IEFwaUVycm9yLCBkYXRhPzogQnVmZmVyKSA9PiB2b2lkICk6IHZvaWQ7XG4gIHB1YmxpYyByZWFkRmlsZShmaWxlbmFtZTogc3RyaW5nLCBvcHRpb25zOiB7IGZsYWc/OiBzdHJpbmc7IH0sIGNhbGxiYWNrOiAoZXJyOiBBcGlFcnJvciwgZGF0YTogQnVmZmVyKSA9PiB2b2lkKTogdm9pZDtcbiAgcHVibGljIHJlYWRGaWxlKGZpbGVuYW1lOiBzdHJpbmcsIG9wdGlvbnM6IHsgZW5jb2Rpbmc6IHN0cmluZzsgZmxhZz86IHN0cmluZzsgfSwgY2FsbGJhY2s6IChlcnI6IEFwaUVycm9yLCBkYXRhOiBzdHJpbmcpID0+IHZvaWQpOiB2b2lkO1xuICBwdWJsaWMgcmVhZEZpbGUoZmlsZW5hbWU6IHN0cmluZywgZW5jb2Rpbmc6IHN0cmluZywgY2I/OiAoZXJyOiBBcGlFcnJvciwgZGF0YT86IHN0cmluZykgPT4gdm9pZCApOiB2b2lkO1xuICBwdWJsaWMgcmVhZEZpbGUoZmlsZW5hbWU6IHN0cmluZywgYXJnMjogYW55ID0ge30sIGNiOiAoZXJyOiBBcGlFcnJvciwgZGF0YT86IGFueSkgPT4gdm9pZCA9IG5vcENiICkge1xuICAgIHZhciBvcHRpb25zID0gbm9ybWFsaXplT3B0aW9ucyhhcmcyLCBudWxsLCAncicsIG51bGwpO1xuICAgIGNiID0gdHlwZW9mIGFyZzIgPT09ICdmdW5jdGlvbicgPyBhcmcyIDogY2I7XG4gICAgdmFyIG5ld0NiID0gd3JhcENiKGNiLCAyKTtcbiAgICB0cnkge1xuICAgICAgdmFyIGZsYWcgPSBGaWxlRmxhZy5nZXRGaWxlRmxhZyhvcHRpb25zWydmbGFnJ10pO1xuICAgICAgaWYgKCFmbGFnLmlzUmVhZGFibGUoKSkge1xuICAgICAgICByZXR1cm4gbmV3Q2IobmV3IEFwaUVycm9yKEVycm9yQ29kZS5FSU5WQUwsICdGbGFnIHBhc3NlZCB0byByZWFkRmlsZSBtdXN0IGFsbG93IGZvciByZWFkaW5nLicpKTtcbiAgICAgIH1cbiAgICAgIHJldHVybiB0aGlzLnJvb3QucmVhZEZpbGUobm9ybWFsaXplUGF0aChmaWxlbmFtZSksIG9wdGlvbnMuZW5jb2RpbmcsIGZsYWcsIG5ld0NiKTtcbiAgICB9IGNhdGNoIChlKSB7XG4gICAgICByZXR1cm4gbmV3Q2IoZSwgbnVsbCk7XG4gICAgfVxuICB9XG5cbiAgLyoqXG4gICAqIFN5bmNocm9ub3VzbHkgcmVhZHMgdGhlIGVudGlyZSBjb250ZW50cyBvZiBhIGZpbGUuXG4gICAqIEBwYXJhbSBbU3RyaW5nXSBmaWxlbmFtZVxuICAgKiBAcGFyYW0gW09iamVjdD9dIG9wdGlvbnNcbiAgICogQG9wdGlvbiBvcHRpb25zIFtTdHJpbmddIGVuY29kaW5nIFRoZSBzdHJpbmcgZW5jb2RpbmcgZm9yIHRoZSBmaWxlIGNvbnRlbnRzLiBEZWZhdWx0cyB0byBgbnVsbGAuXG4gICAqIEBvcHRpb24gb3B0aW9ucyBbU3RyaW5nXSBmbGFnIERlZmF1bHRzIHRvIGAncidgLlxuICAgKiBAcmV0dXJuIFtTdHJpbmcgfCBCcm93c2VyRlMubm9kZS5CdWZmZXJdXG4gICAqL1xuICBwdWJsaWMgcmVhZEZpbGVTeW5jKGZpbGVuYW1lOiBzdHJpbmcsIG9wdGlvbnM/OiB7IGZsYWc/OiBzdHJpbmc7IH0pOiBCdWZmZXI7XG4gIHB1YmxpYyByZWFkRmlsZVN5bmMoZmlsZW5hbWU6IHN0cmluZywgb3B0aW9uczogeyBlbmNvZGluZzogc3RyaW5nOyBmbGFnPzogc3RyaW5nOyB9KTogc3RyaW5nO1xuICBwdWJsaWMgcmVhZEZpbGVTeW5jKGZpbGVuYW1lOiBzdHJpbmcsIGVuY29kaW5nOiBzdHJpbmcpOiBzdHJpbmc7XG4gIHB1YmxpYyByZWFkRmlsZVN5bmMoZmlsZW5hbWU6IHN0cmluZywgYXJnMjogYW55ID0ge30pOiBhbnkge1xuICAgIHZhciBvcHRpb25zID0gbm9ybWFsaXplT3B0aW9ucyhhcmcyLCBudWxsLCAncicsIG51bGwpO1xuICAgIHZhciBmbGFnID0gRmlsZUZsYWcuZ2V0RmlsZUZsYWcob3B0aW9ucy5mbGFnKTtcbiAgICBpZiAoIWZsYWcuaXNSZWFkYWJsZSgpKSB7XG4gICAgICB0aHJvdyBuZXcgQXBpRXJyb3IoRXJyb3JDb2RlLkVJTlZBTCwgJ0ZsYWcgcGFzc2VkIHRvIHJlYWRGaWxlIG11c3QgYWxsb3cgZm9yIHJlYWRpbmcuJyk7XG4gICAgfVxuICAgIHJldHVybiB0aGlzLnJvb3QucmVhZEZpbGVTeW5jKG5vcm1hbGl6ZVBhdGgoZmlsZW5hbWUpLCBvcHRpb25zLmVuY29kaW5nLCBmbGFnKTtcbiAgfVxuXG4gIC8qKlxuICAgKiBBc3luY2hyb25vdXNseSB3cml0ZXMgZGF0YSB0byBhIGZpbGUsIHJlcGxhY2luZyB0aGUgZmlsZSBpZiBpdCBhbHJlYWR5XG4gICAqIGV4aXN0cy5cbiAgICpcbiAgICogVGhlIGVuY29kaW5nIG9wdGlvbiBpcyBpZ25vcmVkIGlmIGRhdGEgaXMgYSBidWZmZXIuXG4gICAqXG4gICAqIEBleGFtcGxlIFVzYWdlIGV4YW1wbGVcbiAgICogICBmcy53cml0ZUZpbGUoJ21lc3NhZ2UudHh0JywgJ0hlbGxvIE5vZGUnLCBmdW5jdGlvbiAoZXJyKSB7XG4gICAqICAgICBpZiAoZXJyKSB0aHJvdyBlcnI7XG4gICAqICAgICBjb25zb2xlLmxvZygnSXRcXCdzIHNhdmVkIScpO1xuICAgKiAgIH0pO1xuICAgKiBAcGFyYW0gW1N0cmluZ10gZmlsZW5hbWVcbiAgICogQHBhcmFtIFtTdHJpbmcgfCBCcm93c2VyRlMubm9kZS5CdWZmZXJdIGRhdGFcbiAgICogQHBhcmFtIFtPYmplY3Q/XSBvcHRpb25zXG4gICAqIEBvcHRpb24gb3B0aW9ucyBbU3RyaW5nXSBlbmNvZGluZyBEZWZhdWx0cyB0byBgJ3V0ZjgnYC5cbiAgICogQG9wdGlvbiBvcHRpb25zIFtOdW1iZXJdIG1vZGUgRGVmYXVsdHMgdG8gYDA2NDRgLlxuICAgKiBAb3B0aW9uIG9wdGlvbnMgW1N0cmluZ10gZmxhZyBEZWZhdWx0cyB0byBgJ3cnYC5cbiAgICogQHBhcmFtIFtGdW5jdGlvbihCcm93c2VyRlMuQXBpRXJyb3IpXSBjYWxsYmFja1xuICAgKi9cbiAgcHVibGljIHdyaXRlRmlsZShmaWxlbmFtZTogc3RyaW5nLCBkYXRhOiBhbnksIGNiPzogKGVycj86IEFwaUVycm9yKSA9PiB2b2lkKTogdm9pZDtcbiAgcHVibGljIHdyaXRlRmlsZShmaWxlbmFtZTogc3RyaW5nLCBkYXRhOiBhbnksIGVuY29kaW5nPzogc3RyaW5nLCBjYj86IChlcnI/OiBBcGlFcnJvcikgPT4gdm9pZCk6IHZvaWQ7XG4gIHB1YmxpYyB3cml0ZUZpbGUoZmlsZW5hbWU6IHN0cmluZywgZGF0YTogYW55LCBvcHRpb25zPzogeyBlbmNvZGluZz86IHN0cmluZzsgbW9kZT86IHN0cmluZyB8IG51bWJlcjsgZmxhZz86IHN0cmluZzsgfSwgY2I/OiAoZXJyPzogQXBpRXJyb3IpID0+IHZvaWQpOiB2b2lkO1xuICBwdWJsaWMgd3JpdGVGaWxlKGZpbGVuYW1lOiBzdHJpbmcsIGRhdGE6IGFueSwgYXJnMzogYW55ID0ge30sIGNiOiAoZXJyPzogQXBpRXJyb3IpID0+IHZvaWQgPSBub3BDYik6IHZvaWQge1xuICAgIHZhciBvcHRpb25zID0gbm9ybWFsaXplT3B0aW9ucyhhcmczLCAndXRmOCcsICd3JywgMHgxYTQpO1xuICAgIGNiID0gdHlwZW9mIGFyZzMgPT09ICdmdW5jdGlvbicgPyBhcmczIDogY2I7XG4gICAgdmFyIG5ld0NiID0gd3JhcENiKGNiLCAxKTtcbiAgICB0cnkge1xuICAgICAgdmFyIGZsYWcgPSBGaWxlRmxhZy5nZXRGaWxlRmxhZyhvcHRpb25zLmZsYWcpO1xuICAgICAgaWYgKCFmbGFnLmlzV3JpdGVhYmxlKCkpIHtcbiAgICAgICAgcmV0dXJuIG5ld0NiKG5ldyBBcGlFcnJvcihFcnJvckNvZGUuRUlOVkFMLCAnRmxhZyBwYXNzZWQgdG8gd3JpdGVGaWxlIG11c3QgYWxsb3cgZm9yIHdyaXRpbmcuJykpO1xuICAgICAgfVxuICAgICAgcmV0dXJuIHRoaXMucm9vdC53cml0ZUZpbGUobm9ybWFsaXplUGF0aChmaWxlbmFtZSksIGRhdGEsIG9wdGlvbnMuZW5jb2RpbmcsIGZsYWcsIG9wdGlvbnMubW9kZSwgbmV3Q2IpO1xuICAgIH0gY2F0Y2ggKGUpIHtcbiAgICAgIHJldHVybiBuZXdDYihlKTtcbiAgICB9XG4gIH1cblxuICAvKipcbiAgICogU3luY2hyb25vdXNseSB3cml0ZXMgZGF0YSB0byBhIGZpbGUsIHJlcGxhY2luZyB0aGUgZmlsZSBpZiBpdCBhbHJlYWR5XG4gICAqIGV4aXN0cy5cbiAgICpcbiAgICogVGhlIGVuY29kaW5nIG9wdGlvbiBpcyBpZ25vcmVkIGlmIGRhdGEgaXMgYSBidWZmZXIuXG4gICAqIEBwYXJhbSBbU3RyaW5nXSBmaWxlbmFtZVxuICAgKiBAcGFyYW0gW1N0cmluZyB8IEJyb3dzZXJGUy5ub2RlLkJ1ZmZlcl0gZGF0YVxuICAgKiBAcGFyYW0gW09iamVjdD9dIG9wdGlvbnNcbiAgICogQG9wdGlvbiBvcHRpb25zIFtTdHJpbmddIGVuY29kaW5nIERlZmF1bHRzIHRvIGAndXRmOCdgLlxuICAgKiBAb3B0aW9uIG9wdGlvbnMgW051bWJlcl0gbW9kZSBEZWZhdWx0cyB0byBgMDY0NGAuXG4gICAqIEBvcHRpb24gb3B0aW9ucyBbU3RyaW5nXSBmbGFnIERlZmF1bHRzIHRvIGAndydgLlxuICAgKi9cbiAgcHVibGljIHdyaXRlRmlsZVN5bmMoZmlsZW5hbWU6IHN0cmluZywgZGF0YTogYW55LCBvcHRpb25zPzogeyBlbmNvZGluZz86IHN0cmluZzsgbW9kZT86IG51bWJlciB8IHN0cmluZzsgZmxhZz86IHN0cmluZzsgfSk6IHZvaWQ7XG4gIHB1YmxpYyB3cml0ZUZpbGVTeW5jKGZpbGVuYW1lOiBzdHJpbmcsIGRhdGE6IGFueSwgZW5jb2Rpbmc/OiBzdHJpbmcpOiB2b2lkO1xuICBwdWJsaWMgd3JpdGVGaWxlU3luYyhmaWxlbmFtZTogc3RyaW5nLCBkYXRhOiBhbnksIGFyZzM/OiBhbnkpOiB2b2lkIHtcbiAgICB2YXIgb3B0aW9ucyA9IG5vcm1hbGl6ZU9wdGlvbnMoYXJnMywgJ3V0ZjgnLCAndycsIDB4MWE0KTtcbiAgICB2YXIgZmxhZyA9IEZpbGVGbGFnLmdldEZpbGVGbGFnKG9wdGlvbnMuZmxhZyk7XG4gICAgaWYgKCFmbGFnLmlzV3JpdGVhYmxlKCkpIHtcbiAgICAgIHRocm93IG5ldyBBcGlFcnJvcihFcnJvckNvZGUuRUlOVkFMLCAnRmxhZyBwYXNzZWQgdG8gd3JpdGVGaWxlIG11c3QgYWxsb3cgZm9yIHdyaXRpbmcuJyk7XG4gICAgfVxuICAgIHJldHVybiB0aGlzLnJvb3Qud3JpdGVGaWxlU3luYyhub3JtYWxpemVQYXRoKGZpbGVuYW1lKSwgZGF0YSwgb3B0aW9ucy5lbmNvZGluZywgZmxhZywgb3B0aW9ucy5tb2RlKTtcbiAgfVxuXG4gIC8qKlxuICAgKiBBc3luY2hyb25vdXNseSBhcHBlbmQgZGF0YSB0byBhIGZpbGUsIGNyZWF0aW5nIHRoZSBmaWxlIGlmIGl0IG5vdCB5ZXRcbiAgICogZXhpc3RzLlxuICAgKlxuICAgKiBAZXhhbXBsZSBVc2FnZSBleGFtcGxlXG4gICAqICAgZnMuYXBwZW5kRmlsZSgnbWVzc2FnZS50eHQnLCAnZGF0YSB0byBhcHBlbmQnLCBmdW5jdGlvbiAoZXJyKSB7XG4gICAqICAgICBpZiAoZXJyKSB0aHJvdyBlcnI7XG4gICAqICAgICBjb25zb2xlLmxvZygnVGhlIFwiZGF0YSB0byBhcHBlbmRcIiB3YXMgYXBwZW5kZWQgdG8gZmlsZSEnKTtcbiAgICogICB9KTtcbiAgICogQHBhcmFtIFtTdHJpbmddIGZpbGVuYW1lXG4gICAqIEBwYXJhbSBbU3RyaW5nIHwgQnJvd3NlckZTLm5vZGUuQnVmZmVyXSBkYXRhXG4gICAqIEBwYXJhbSBbT2JqZWN0P10gb3B0aW9uc1xuICAgKiBAb3B0aW9uIG9wdGlvbnMgW1N0cmluZ10gZW5jb2RpbmcgRGVmYXVsdHMgdG8gYCd1dGY4J2AuXG4gICAqIEBvcHRpb24gb3B0aW9ucyBbTnVtYmVyXSBtb2RlIERlZmF1bHRzIHRvIGAwNjQ0YC5cbiAgICogQG9wdGlvbiBvcHRpb25zIFtTdHJpbmddIGZsYWcgRGVmYXVsdHMgdG8gYCdhJ2AuXG4gICAqIEBwYXJhbSBbRnVuY3Rpb24oQnJvd3NlckZTLkFwaUVycm9yKV0gY2FsbGJhY2tcbiAgICovXG4gIHB1YmxpYyBhcHBlbmRGaWxlKGZpbGVuYW1lOiBzdHJpbmcsIGRhdGE6IGFueSwgY2I/OiAoZXJyOiBBcGlFcnJvcikgPT4gdm9pZCk6IHZvaWQ7XG4gIHB1YmxpYyBhcHBlbmRGaWxlKGZpbGVuYW1lOiBzdHJpbmcsIGRhdGE6IGFueSwgb3B0aW9ucz86IHsgZW5jb2Rpbmc/OiBzdHJpbmc7IG1vZGU/OiBudW1iZXJ8c3RyaW5nOyBmbGFnPzogc3RyaW5nOyB9LCBjYj86IChlcnI6IEFwaUVycm9yKSA9PiB2b2lkKTogdm9pZDtcbiAgcHVibGljIGFwcGVuZEZpbGUoZmlsZW5hbWU6IHN0cmluZywgZGF0YTogYW55LCBlbmNvZGluZz86IHN0cmluZywgY2I/OiAoZXJyOiBBcGlFcnJvcikgPT4gdm9pZCk6IHZvaWQ7XG4gIHB1YmxpYyBhcHBlbmRGaWxlKGZpbGVuYW1lOiBzdHJpbmcsIGRhdGE6IGFueSwgYXJnMz86IGFueSwgY2I6IChlcnI6IEFwaUVycm9yKSA9PiB2b2lkID0gbm9wQ2IpOiB2b2lkIHtcbiAgICB2YXIgb3B0aW9ucyA9IG5vcm1hbGl6ZU9wdGlvbnMoYXJnMywgJ3V0ZjgnLCAnYScsIDB4MWE0KTtcbiAgICBjYiA9IHR5cGVvZiBhcmczID09PSAnZnVuY3Rpb24nID8gYXJnMyA6IGNiO1xuICAgIHZhciBuZXdDYiA9IHdyYXBDYihjYiwgMSk7XG4gICAgdHJ5IHtcbiAgICAgIHZhciBmbGFnID0gRmlsZUZsYWcuZ2V0RmlsZUZsYWcob3B0aW9ucy5mbGFnKTtcbiAgICAgIGlmICghZmxhZy5pc0FwcGVuZGFibGUoKSkge1xuICAgICAgICByZXR1cm4gbmV3Q2IobmV3IEFwaUVycm9yKEVycm9yQ29kZS5FSU5WQUwsICdGbGFnIHBhc3NlZCB0byBhcHBlbmRGaWxlIG11c3QgYWxsb3cgZm9yIGFwcGVuZGluZy4nKSk7XG4gICAgICB9XG4gICAgICB0aGlzLnJvb3QuYXBwZW5kRmlsZShub3JtYWxpemVQYXRoKGZpbGVuYW1lKSwgZGF0YSwgb3B0aW9ucy5lbmNvZGluZywgZmxhZywgb3B0aW9ucy5tb2RlLCBuZXdDYik7XG4gICAgfSBjYXRjaCAoZSkge1xuICAgICAgbmV3Q2IoZSk7XG4gICAgfVxuICB9XG5cbiAgLyoqXG4gICAqIEFzeW5jaHJvbm91c2x5IGFwcGVuZCBkYXRhIHRvIGEgZmlsZSwgY3JlYXRpbmcgdGhlIGZpbGUgaWYgaXQgbm90IHlldFxuICAgKiBleGlzdHMuXG4gICAqXG4gICAqIEBleGFtcGxlIFVzYWdlIGV4YW1wbGVcbiAgICogICBmcy5hcHBlbmRGaWxlKCdtZXNzYWdlLnR4dCcsICdkYXRhIHRvIGFwcGVuZCcsIGZ1bmN0aW9uIChlcnIpIHtcbiAgICogICAgIGlmIChlcnIpIHRocm93IGVycjtcbiAgICogICAgIGNvbnNvbGUubG9nKCdUaGUgXCJkYXRhIHRvIGFwcGVuZFwiIHdhcyBhcHBlbmRlZCB0byBmaWxlIScpO1xuICAgKiAgIH0pO1xuICAgKiBAcGFyYW0gW1N0cmluZ10gZmlsZW5hbWVcbiAgICogQHBhcmFtIFtTdHJpbmcgfCBCcm93c2VyRlMubm9kZS5CdWZmZXJdIGRhdGFcbiAgICogQHBhcmFtIFtPYmplY3Q/XSBvcHRpb25zXG4gICAqIEBvcHRpb24gb3B0aW9ucyBbU3RyaW5nXSBlbmNvZGluZyBEZWZhdWx0cyB0byBgJ3V0ZjgnYC5cbiAgICogQG9wdGlvbiBvcHRpb25zIFtOdW1iZXJdIG1vZGUgRGVmYXVsdHMgdG8gYDA2NDRgLlxuICAgKiBAb3B0aW9uIG9wdGlvbnMgW1N0cmluZ10gZmxhZyBEZWZhdWx0cyB0byBgJ2EnYC5cbiAgICovXG4gIHB1YmxpYyBhcHBlbmRGaWxlU3luYyhmaWxlbmFtZTogc3RyaW5nLCBkYXRhOiBhbnksIG9wdGlvbnM/OiB7IGVuY29kaW5nPzogc3RyaW5nOyBtb2RlPzogbnVtYmVyIHwgc3RyaW5nOyBmbGFnPzogc3RyaW5nOyB9KTogdm9pZDtcbiAgcHVibGljIGFwcGVuZEZpbGVTeW5jKGZpbGVuYW1lOiBzdHJpbmcsIGRhdGE6IGFueSwgZW5jb2Rpbmc/OiBzdHJpbmcpOiB2b2lkO1xuICBwdWJsaWMgYXBwZW5kRmlsZVN5bmMoZmlsZW5hbWU6IHN0cmluZywgZGF0YTogYW55LCBhcmczPzogYW55KTogdm9pZCB7XG4gICAgdmFyIG9wdGlvbnMgPSBub3JtYWxpemVPcHRpb25zKGFyZzMsICd1dGY4JywgJ2EnLCAweDFhNCk7XG4gICAgdmFyIGZsYWcgPSBGaWxlRmxhZy5nZXRGaWxlRmxhZyhvcHRpb25zLmZsYWcpO1xuICAgIGlmICghZmxhZy5pc0FwcGVuZGFibGUoKSkge1xuICAgICAgdGhyb3cgbmV3IEFwaUVycm9yKEVycm9yQ29kZS5FSU5WQUwsICdGbGFnIHBhc3NlZCB0byBhcHBlbmRGaWxlIG11c3QgYWxsb3cgZm9yIGFwcGVuZGluZy4nKTtcbiAgICB9XG4gICAgcmV0dXJuIHRoaXMucm9vdC5hcHBlbmRGaWxlU3luYyhub3JtYWxpemVQYXRoKGZpbGVuYW1lKSwgZGF0YSwgb3B0aW9ucy5lbmNvZGluZywgZmxhZywgb3B0aW9ucy5tb2RlKTtcbiAgfVxuXG4gIC8vIEZJTEUgREVTQ1JJUFRPUiBNRVRIT0RTXG5cbiAgLyoqXG4gICAqIEFzeW5jaHJvbm91cyBgZnN0YXRgLlxuICAgKiBgZnN0YXQoKWAgaXMgaWRlbnRpY2FsIHRvIGBzdGF0KClgLCBleGNlcHQgdGhhdCB0aGUgZmlsZSB0byBiZSBzdGF0LWVkIGlzXG4gICAqIHNwZWNpZmllZCBieSB0aGUgZmlsZSBkZXNjcmlwdG9yIGBmZGAuXG4gICAqIEBwYXJhbSBbQnJvd3NlckZTLkZpbGVdIGZkXG4gICAqIEBwYXJhbSBbRnVuY3Rpb24oQnJvd3NlckZTLkFwaUVycm9yLCBCcm93c2VyRlMubm9kZS5mcy5TdGF0cyldIGNhbGxiYWNrXG4gICAqL1xuICBwdWJsaWMgZnN0YXQoZmQ6IG51bWJlciwgY2I6IChlcnI6IEFwaUVycm9yLCBzdGF0cz86IFN0YXRzKSA9PiBhbnkgPSBub3BDYik6IHZvaWQge1xuICAgIHZhciBuZXdDYiA9IHdyYXBDYihjYiwgMik7XG4gICAgdHJ5IHtcbiAgICAgIGxldCBmaWxlID0gdGhpcy5mZDJmaWxlKGZkKTtcbiAgICAgIGZpbGUuc3RhdChuZXdDYik7XG4gICAgfSBjYXRjaCAoZSkge1xuICAgICAgbmV3Q2IoZSk7XG4gICAgfVxuICB9XG5cbiAgLyoqXG4gICAqIFN5bmNocm9ub3VzIGBmc3RhdGAuXG4gICAqIGBmc3RhdCgpYCBpcyBpZGVudGljYWwgdG8gYHN0YXQoKWAsIGV4Y2VwdCB0aGF0IHRoZSBmaWxlIHRvIGJlIHN0YXQtZWQgaXNcbiAgICogc3BlY2lmaWVkIGJ5IHRoZSBmaWxlIGRlc2NyaXB0b3IgYGZkYC5cbiAgICogQHBhcmFtIFtCcm93c2VyRlMuRmlsZV0gZmRcbiAgICogQHJldHVybiBbQnJvd3NlckZTLm5vZGUuZnMuU3RhdHNdXG4gICAqL1xuICBwdWJsaWMgZnN0YXRTeW5jKGZkOiBudW1iZXIpOiBTdGF0cyB7XG4gICAgcmV0dXJuIHRoaXMuZmQyZmlsZShmZCkuc3RhdFN5bmMoKTtcbiAgfVxuXG4gIC8qKlxuICAgKiBBc3luY2hyb25vdXMgY2xvc2UuXG4gICAqIEBwYXJhbSBbQnJvd3NlckZTLkZpbGVdIGZkXG4gICAqIEBwYXJhbSBbRnVuY3Rpb24oQnJvd3NlckZTLkFwaUVycm9yKV0gY2FsbGJhY2tcbiAgICovXG4gIHB1YmxpYyBjbG9zZShmZDogbnVtYmVyLCBjYjogKGU/OiBBcGlFcnJvcikgPT4gdm9pZCA9IG5vcENiKTogdm9pZCB7XG4gICAgdmFyIG5ld0NiID0gd3JhcENiKGNiLCAxKTtcbiAgICB0cnkge1xuICAgICAgdGhpcy5mZDJmaWxlKGZkKS5jbG9zZSgoZTogQXBpRXJyb3IpID0+IHtcbiAgICAgICAgaWYgKCFlKSB7XG4gICAgICAgICAgdGhpcy5jbG9zZUZkKGZkKTtcbiAgICAgICAgfVxuICAgICAgICBuZXdDYihlKTtcbiAgICAgIH0pO1xuICAgIH0gY2F0Y2ggKGUpIHtcbiAgICAgIG5ld0NiKGUpO1xuICAgIH1cbiAgfVxuXG4gIC8qKlxuICAgKiBTeW5jaHJvbm91cyBjbG9zZS5cbiAgICogQHBhcmFtIFtCcm93c2VyRlMuRmlsZV0gZmRcbiAgICovXG4gIHB1YmxpYyBjbG9zZVN5bmMoZmQ6IG51bWJlcik6IHZvaWQge1xuICAgIHRoaXMuZmQyZmlsZShmZCkuY2xvc2VTeW5jKCk7XG4gICAgdGhpcy5jbG9zZUZkKGZkKTtcbiAgfVxuXG4gIC8qKlxuICAgKiBBc3luY2hyb25vdXMgZnRydW5jYXRlLlxuICAgKiBAcGFyYW0gW0Jyb3dzZXJGUy5GaWxlXSBmZFxuICAgKiBAcGFyYW0gW051bWJlcl0gbGVuXG4gICAqIEBwYXJhbSBbRnVuY3Rpb24oQnJvd3NlckZTLkFwaUVycm9yKV0gY2FsbGJhY2tcbiAgICovXG4gIHB1YmxpYyBmdHJ1bmNhdGUoZmQ6IG51bWJlciwgY2I/OiAoZXJyPzogQXBpRXJyb3IpID0+IHZvaWQpOiB2b2lkO1xuICBwdWJsaWMgZnRydW5jYXRlKGZkOiBudW1iZXIsIGxlbj86IG51bWJlciwgY2I/OiAoZXJyPzogQXBpRXJyb3IpID0+IHZvaWQpOiB2b2lkO1xuICBwdWJsaWMgZnRydW5jYXRlKGZkOiBudW1iZXIsIGFyZzI/OiBhbnksIGNiOiAoZXJyPzogQXBpRXJyb3IpID0+IHZvaWQgPSBub3BDYik6IHZvaWQge1xuICAgIHZhciBsZW5ndGggPSB0eXBlb2YgYXJnMiA9PT0gJ251bWJlcicgPyBhcmcyIDogMDtcbiAgICBjYiA9IHR5cGVvZiBhcmcyID09PSAnZnVuY3Rpb24nID8gYXJnMiA6IGNiO1xuICAgIHZhciBuZXdDYiA9IHdyYXBDYihjYiwgMSk7XG4gICAgdHJ5IHtcbiAgICAgIGxldCBmaWxlID0gdGhpcy5mZDJmaWxlKGZkKTtcbiAgICAgIGlmIChsZW5ndGggPCAwKSB7XG4gICAgICAgIHRocm93IG5ldyBBcGlFcnJvcihFcnJvckNvZGUuRUlOVkFMKTtcbiAgICAgIH1cbiAgICAgIGZpbGUudHJ1bmNhdGUobGVuZ3RoLCBuZXdDYik7XG4gICAgfSBjYXRjaCAoZSkge1xuICAgICAgbmV3Q2IoZSk7XG4gICAgfVxuICB9XG5cbiAgLyoqXG4gICAqIFN5bmNocm9ub3VzIGZ0cnVuY2F0ZS5cbiAgICogQHBhcmFtIFtCcm93c2VyRlMuRmlsZV0gZmRcbiAgICogQHBhcmFtIFtOdW1iZXJdIGxlblxuICAgKi9cbiAgcHVibGljIGZ0cnVuY2F0ZVN5bmMoZmQ6IG51bWJlciwgbGVuOiBudW1iZXIgPSAwKTogdm9pZCB7XG4gICAgbGV0IGZpbGUgPSB0aGlzLmZkMmZpbGUoZmQpO1xuICAgIGlmIChsZW4gPCAwKSB7XG4gICAgICB0aHJvdyBuZXcgQXBpRXJyb3IoRXJyb3JDb2RlLkVJTlZBTCk7XG4gICAgfVxuICAgIGZpbGUudHJ1bmNhdGVTeW5jKGxlbik7XG4gIH1cblxuICAvKipcbiAgICogQXN5bmNocm9ub3VzIGZzeW5jLlxuICAgKiBAcGFyYW0gW0Jyb3dzZXJGUy5GaWxlXSBmZFxuICAgKiBAcGFyYW0gW0Z1bmN0aW9uKEJyb3dzZXJGUy5BcGlFcnJvcildIGNhbGxiYWNrXG4gICAqL1xuICBwdWJsaWMgZnN5bmMoZmQ6IG51bWJlciwgY2I6IChlcnI/OiBBcGlFcnJvcikgPT4gdm9pZCA9IG5vcENiKTogdm9pZCB7XG4gICAgdmFyIG5ld0NiID0gd3JhcENiKGNiLCAxKTtcbiAgICB0cnkge1xuICAgICAgdGhpcy5mZDJmaWxlKGZkKS5zeW5jKG5ld0NiKTtcbiAgICB9IGNhdGNoIChlKSB7XG4gICAgICBuZXdDYihlKTtcbiAgICB9XG4gIH1cblxuICAvKipcbiAgICogU3luY2hyb25vdXMgZnN5bmMuXG4gICAqIEBwYXJhbSBbQnJvd3NlckZTLkZpbGVdIGZkXG4gICAqL1xuICBwdWJsaWMgZnN5bmNTeW5jKGZkOiBudW1iZXIpOiB2b2lkIHtcbiAgICB0aGlzLmZkMmZpbGUoZmQpLnN5bmNTeW5jKCk7XG4gIH1cblxuICAvKipcbiAgICogQXN5bmNocm9ub3VzIGZkYXRhc3luYy5cbiAgICogQHBhcmFtIFtCcm93c2VyRlMuRmlsZV0gZmRcbiAgICogQHBhcmFtIFtGdW5jdGlvbihCcm93c2VyRlMuQXBpRXJyb3IpXSBjYWxsYmFja1xuICAgKi9cbiAgcHVibGljIGZkYXRhc3luYyhmZDogbnVtYmVyLCBjYjogKGVycj86IEFwaUVycm9yKSA9PiB2b2lkID0gbm9wQ2IpOiB2b2lkIHtcbiAgICB2YXIgbmV3Q2IgPSB3cmFwQ2IoY2IsIDEpO1xuICAgIHRyeSB7XG4gICAgICB0aGlzLmZkMmZpbGUoZmQpLmRhdGFzeW5jKG5ld0NiKTtcbiAgICB9IGNhdGNoIChlKSB7XG4gICAgICBuZXdDYihlKTtcbiAgICB9XG4gIH1cblxuICAvKipcbiAgICogU3luY2hyb25vdXMgZmRhdGFzeW5jLlxuICAgKiBAcGFyYW0gW0Jyb3dzZXJGUy5GaWxlXSBmZFxuICAgKi9cbiAgcHVibGljIGZkYXRhc3luY1N5bmMoZmQ6IG51bWJlcik6IHZvaWQge1xuICAgIHRoaXMuZmQyZmlsZShmZCkuZGF0YXN5bmNTeW5jKCk7XG4gIH1cblxuICAvKipcbiAgICogV3JpdGUgYnVmZmVyIHRvIHRoZSBmaWxlIHNwZWNpZmllZCBieSBgZmRgLlxuICAgKiBOb3RlIHRoYXQgaXQgaXMgdW5zYWZlIHRvIHVzZSBmcy53cml0ZSBtdWx0aXBsZSB0aW1lcyBvbiB0aGUgc2FtZSBmaWxlXG4gICAqIHdpdGhvdXQgd2FpdGluZyBmb3IgdGhlIGNhbGxiYWNrLlxuICAgKiBAcGFyYW0gW0Jyb3dzZXJGUy5GaWxlXSBmZFxuICAgKiBAcGFyYW0gW0Jyb3dzZXJGUy5ub2RlLkJ1ZmZlcl0gYnVmZmVyIEJ1ZmZlciBjb250YWluaW5nIHRoZSBkYXRhIHRvIHdyaXRlIHRvXG4gICAqICAgdGhlIGZpbGUuXG4gICAqIEBwYXJhbSBbTnVtYmVyXSBvZmZzZXQgT2Zmc2V0IGluIHRoZSBidWZmZXIgdG8gc3RhcnQgcmVhZGluZyBkYXRhIGZyb20uXG4gICAqIEBwYXJhbSBbTnVtYmVyXSBsZW5ndGggVGhlIGFtb3VudCBvZiBieXRlcyB0byB3cml0ZSB0byB0aGUgZmlsZS5cbiAgICogQHBhcmFtIFtOdW1iZXJdIHBvc2l0aW9uIE9mZnNldCBmcm9tIHRoZSBiZWdpbm5pbmcgb2YgdGhlIGZpbGUgd2hlcmUgdGhpc1xuICAgKiAgIGRhdGEgc2hvdWxkIGJlIHdyaXR0ZW4uIElmIHBvc2l0aW9uIGlzIG51bGwsIHRoZSBkYXRhIHdpbGwgYmUgd3JpdHRlbiBhdFxuICAgKiAgIHRoZSBjdXJyZW50IHBvc2l0aW9uLlxuICAgKiBAcGFyYW0gW0Z1bmN0aW9uKEJyb3dzZXJGUy5BcGlFcnJvciwgTnVtYmVyLCBCcm93c2VyRlMubm9kZS5CdWZmZXIpXVxuICAgKiAgIGNhbGxiYWNrIFRoZSBudW1iZXIgc3BlY2lmaWVzIHRoZSBudW1iZXIgb2YgYnl0ZXMgd3JpdHRlbiBpbnRvIHRoZSBmaWxlLlxuICAgKi9cbiAgcHVibGljIHdyaXRlKGZkOiBudW1iZXIsIGJ1ZmZlcjogQnVmZmVyLCBvZmZzZXQ6IG51bWJlciwgbGVuZ3RoOiBudW1iZXIsIGNiPzogKGVycjogQXBpRXJyb3IsIHdyaXR0ZW46IG51bWJlciwgYnVmZmVyOiBCdWZmZXIpID0+IHZvaWQpOiB2b2lkO1xuICBwdWJsaWMgd3JpdGUoZmQ6IG51bWJlciwgYnVmZmVyOiBCdWZmZXIsIG9mZnNldDogbnVtYmVyLCBsZW5ndGg6IG51bWJlciwgcG9zaXRpb246IG51bWJlciwgY2I/OiAoZXJyOiBBcGlFcnJvciwgd3JpdHRlbjogbnVtYmVyLCBidWZmZXI6IEJ1ZmZlcikgPT4gdm9pZCk6IHZvaWQ7XG4gIHB1YmxpYyB3cml0ZShmZDogbnVtYmVyLCBkYXRhOiBhbnksIGNiPzogKGVycjogQXBpRXJyb3IsIHdyaXR0ZW46IG51bWJlciwgc3RyOiBzdHJpbmcpID0+IGFueSk6IHZvaWQ7XG4gIHB1YmxpYyB3cml0ZShmZDogbnVtYmVyLCBkYXRhOiBhbnksIHBvc2l0aW9uOiBudW1iZXIsIGNiPzogKGVycjogQXBpRXJyb3IsIHdyaXR0ZW46IG51bWJlciwgc3RyOiBzdHJpbmcpID0+IGFueSk6IHZvaWQ7XG4gIHB1YmxpYyB3cml0ZShmZDogbnVtYmVyLCBkYXRhOiBhbnksIHBvc2l0aW9uOiBudW1iZXIsIGVuY29kaW5nOiBzdHJpbmcsIGNiPzogKGVycjogQXBpRXJyb3IsIHdyaXR0ZW46IG51bWJlciwgc3RyOiBzdHJpbmcpID0+IHZvaWQpOiB2b2lkO1xuICBwdWJsaWMgd3JpdGUoZmQ6IG51bWJlciwgYXJnMjogYW55LCBhcmczPzogYW55LCBhcmc0PzogYW55LCBhcmc1PzogYW55LCBjYjogKGVycjogQXBpRXJyb3IsIHdyaXR0ZW4/OiBudW1iZXIsIGJ1ZmZlcj86IEJ1ZmZlcikgPT4gdm9pZCA9IG5vcENiKTogdm9pZCB7XG4gICAgdmFyIGJ1ZmZlcjogQnVmZmVyLCBvZmZzZXQ6IG51bWJlciwgbGVuZ3RoOiBudW1iZXIsIHBvc2l0aW9uOiBudW1iZXIgPSBudWxsO1xuICAgIGlmICh0eXBlb2YgYXJnMiA9PT0gJ3N0cmluZycpIHtcbiAgICAgIC8vIFNpZ25hdHVyZSAxOiAoZmQsIHN0cmluZywgW3Bvc2l0aW9uPywgW2VuY29kaW5nP11dLCBjYj8pXG4gICAgICB2YXIgZW5jb2RpbmcgPSAndXRmOCc7XG4gICAgICBzd2l0Y2ggKHR5cGVvZiBhcmczKSB7XG4gICAgICAgIGNhc2UgJ2Z1bmN0aW9uJzpcbiAgICAgICAgICAvLyAoZmQsIHN0cmluZywgY2IpXG4gICAgICAgICAgY2IgPSBhcmczO1xuICAgICAgICAgIGJyZWFrO1xuICAgICAgICBjYXNlICdudW1iZXInOlxuICAgICAgICAgIC8vIChmZCwgc3RyaW5nLCBwb3NpdGlvbiwgZW5jb2Rpbmc/LCBjYj8pXG4gICAgICAgICAgcG9zaXRpb24gPSBhcmczO1xuICAgICAgICAgIGVuY29kaW5nID0gdHlwZW9mIGFyZzQgPT09ICdzdHJpbmcnID8gYXJnNCA6ICd1dGY4JztcbiAgICAgICAgICBjYiA9IHR5cGVvZiBhcmc1ID09PSAnZnVuY3Rpb24nID8gYXJnNSA6IGNiO1xuICAgICAgICAgIGJyZWFrO1xuICAgICAgICBkZWZhdWx0OlxuICAgICAgICAgIC8vIC4uLnRyeSB0byBmaW5kIHRoZSBjYWxsYmFjayBhbmQgZ2V0IG91dCBvZiBoZXJlIVxuICAgICAgICAgIGNiID0gdHlwZW9mIGFyZzQgPT09ICdmdW5jdGlvbicgPyBhcmc0IDogdHlwZW9mIGFyZzUgPT09ICdmdW5jdGlvbicgPyBhcmc1IDogY2I7XG4gICAgICAgICAgcmV0dXJuIGNiKG5ldyBBcGlFcnJvcihFcnJvckNvZGUuRUlOVkFMLCAnSW52YWxpZCBhcmd1bWVudHMuJykpO1xuICAgICAgfVxuICAgICAgYnVmZmVyID0gbmV3IEJ1ZmZlcihhcmcyLCBlbmNvZGluZyk7XG4gICAgICBvZmZzZXQgPSAwO1xuICAgICAgbGVuZ3RoID0gYnVmZmVyLmxlbmd0aDtcbiAgICB9IGVsc2Uge1xuICAgICAgLy8gU2lnbmF0dXJlIDI6IChmZCwgYnVmZmVyLCBvZmZzZXQsIGxlbmd0aCwgcG9zaXRpb24/LCBjYj8pXG4gICAgICBidWZmZXIgPSBhcmcyO1xuICAgICAgb2Zmc2V0ID0gYXJnMztcbiAgICAgIGxlbmd0aCA9IGFyZzQ7XG4gICAgICBwb3NpdGlvbiA9IHR5cGVvZiBhcmc1ID09PSAnbnVtYmVyJyA/IGFyZzUgOiBudWxsO1xuICAgICAgY2IgPSB0eXBlb2YgYXJnNSA9PT0gJ2Z1bmN0aW9uJyA/IGFyZzUgOiBjYjtcbiAgICB9XG5cbiAgICB2YXIgbmV3Q2IgPSB3cmFwQ2IoY2IsIDMpO1xuICAgIHRyeSB7XG4gICAgICBsZXQgZmlsZSA9IHRoaXMuZmQyZmlsZShmZCk7XG4gICAgICBpZiAocG9zaXRpb24gPT0gbnVsbCkge1xuICAgICAgICBwb3NpdGlvbiA9IGZpbGUuZ2V0UG9zKCk7XG4gICAgICB9XG4gICAgICBmaWxlLndyaXRlKGJ1ZmZlciwgb2Zmc2V0LCBsZW5ndGgsIHBvc2l0aW9uLCBuZXdDYik7XG4gICAgfSBjYXRjaCAoZSkge1xuICAgICAgbmV3Q2IoZSk7XG4gICAgfVxuICB9XG5cbiAgLyoqXG4gICAqIFdyaXRlIGJ1ZmZlciB0byB0aGUgZmlsZSBzcGVjaWZpZWQgYnkgYGZkYC5cbiAgICogTm90ZSB0aGF0IGl0IGlzIHVuc2FmZSB0byB1c2UgZnMud3JpdGUgbXVsdGlwbGUgdGltZXMgb24gdGhlIHNhbWUgZmlsZVxuICAgKiB3aXRob3V0IHdhaXRpbmcgZm9yIGl0IHRvIHJldHVybi5cbiAgICogQHBhcmFtIFtCcm93c2VyRlMuRmlsZV0gZmRcbiAgICogQHBhcmFtIFtCcm93c2VyRlMubm9kZS5CdWZmZXJdIGJ1ZmZlciBCdWZmZXIgY29udGFpbmluZyB0aGUgZGF0YSB0byB3cml0ZSB0b1xuICAgKiAgIHRoZSBmaWxlLlxuICAgKiBAcGFyYW0gW051bWJlcl0gb2Zmc2V0IE9mZnNldCBpbiB0aGUgYnVmZmVyIHRvIHN0YXJ0IHJlYWRpbmcgZGF0YSBmcm9tLlxuICAgKiBAcGFyYW0gW051bWJlcl0gbGVuZ3RoIFRoZSBhbW91bnQgb2YgYnl0ZXMgdG8gd3JpdGUgdG8gdGhlIGZpbGUuXG4gICAqIEBwYXJhbSBbTnVtYmVyXSBwb3NpdGlvbiBPZmZzZXQgZnJvbSB0aGUgYmVnaW5uaW5nIG9mIHRoZSBmaWxlIHdoZXJlIHRoaXNcbiAgICogICBkYXRhIHNob3VsZCBiZSB3cml0dGVuLiBJZiBwb3NpdGlvbiBpcyBudWxsLCB0aGUgZGF0YSB3aWxsIGJlIHdyaXR0ZW4gYXRcbiAgICogICB0aGUgY3VycmVudCBwb3NpdGlvbi5cbiAgICogQHJldHVybiBbTnVtYmVyXVxuICAgKi9cbiAgcHVibGljIHdyaXRlU3luYyhmZDogbnVtYmVyLCBidWZmZXI6IEJ1ZmZlciwgb2Zmc2V0OiBudW1iZXIsIGxlbmd0aDogbnVtYmVyLCBwb3NpdGlvbj86IG51bWJlcik6IG51bWJlcjtcbiAgcHVibGljIHdyaXRlU3luYyhmZDogbnVtYmVyLCBkYXRhOiBzdHJpbmcsIHBvc2l0aW9uPzogbnVtYmVyLCBlbmNvZGluZz86IHN0cmluZyk6IG51bWJlcjtcbiAgcHVibGljIHdyaXRlU3luYyhmZDogbnVtYmVyLCBhcmcyOiBhbnksIGFyZzM/OiBhbnksIGFyZzQ/OiBhbnksIGFyZzU/OiBhbnkpOiBudW1iZXIge1xuICAgIHZhciBidWZmZXI6IEJ1ZmZlciwgb2Zmc2V0OiBudW1iZXIgPSAwLCBsZW5ndGg6IG51bWJlciwgcG9zaXRpb246IG51bWJlcjtcbiAgICBpZiAodHlwZW9mIGFyZzIgPT09ICdzdHJpbmcnKSB7XG4gICAgICAvLyBTaWduYXR1cmUgMTogKGZkLCBzdHJpbmcsIFtwb3NpdGlvbj8sIFtlbmNvZGluZz9dXSlcbiAgICAgIHBvc2l0aW9uID0gdHlwZW9mIGFyZzMgPT09ICdudW1iZXInID8gYXJnMyA6IG51bGw7XG4gICAgICB2YXIgZW5jb2RpbmcgPSB0eXBlb2YgYXJnNCA9PT0gJ3N0cmluZycgPyBhcmc0IDogJ3V0ZjgnO1xuICAgICAgb2Zmc2V0ID0gMDtcbiAgICAgIGJ1ZmZlciA9IG5ldyBCdWZmZXIoYXJnMiwgZW5jb2RpbmcpO1xuICAgICAgbGVuZ3RoID0gYnVmZmVyLmxlbmd0aDtcbiAgICB9IGVsc2Uge1xuICAgICAgLy8gU2lnbmF0dXJlIDI6IChmZCwgYnVmZmVyLCBvZmZzZXQsIGxlbmd0aCwgcG9zaXRpb24/KVxuICAgICAgYnVmZmVyID0gYXJnMjtcbiAgICAgIG9mZnNldCA9IGFyZzM7XG4gICAgICBsZW5ndGggPSBhcmc0O1xuICAgICAgcG9zaXRpb24gPSB0eXBlb2YgYXJnNSA9PT0gJ251bWJlcicgPyBhcmc1IDogbnVsbDtcbiAgICB9XG5cbiAgICBsZXQgZmlsZSA9IHRoaXMuZmQyZmlsZShmZCk7XG4gICAgaWYgKHBvc2l0aW9uID09IG51bGwpIHtcbiAgICAgIHBvc2l0aW9uID0gZmlsZS5nZXRQb3MoKTtcbiAgICB9XG4gICAgcmV0dXJuIGZpbGUud3JpdGVTeW5jKGJ1ZmZlciwgb2Zmc2V0LCBsZW5ndGgsIHBvc2l0aW9uKTtcbiAgfVxuXG4gIC8qKlxuICAgKiBSZWFkIGRhdGEgZnJvbSB0aGUgZmlsZSBzcGVjaWZpZWQgYnkgYGZkYC5cbiAgICogQHBhcmFtIFtCcm93c2VyRlMuRmlsZV0gZmRcbiAgICogQHBhcmFtIFtCcm93c2VyRlMubm9kZS5CdWZmZXJdIGJ1ZmZlciBUaGUgYnVmZmVyIHRoYXQgdGhlIGRhdGEgd2lsbCBiZVxuICAgKiAgIHdyaXR0ZW4gdG8uXG4gICAqIEBwYXJhbSBbTnVtYmVyXSBvZmZzZXQgVGhlIG9mZnNldCB3aXRoaW4gdGhlIGJ1ZmZlciB3aGVyZSB3cml0aW5nIHdpbGxcbiAgICogICBzdGFydC5cbiAgICogQHBhcmFtIFtOdW1iZXJdIGxlbmd0aCBBbiBpbnRlZ2VyIHNwZWNpZnlpbmcgdGhlIG51bWJlciBvZiBieXRlcyB0byByZWFkLlxuICAgKiBAcGFyYW0gW051bWJlcl0gcG9zaXRpb24gQW4gaW50ZWdlciBzcGVjaWZ5aW5nIHdoZXJlIHRvIGJlZ2luIHJlYWRpbmcgZnJvbVxuICAgKiAgIGluIHRoZSBmaWxlLiBJZiBwb3NpdGlvbiBpcyBudWxsLCBkYXRhIHdpbGwgYmUgcmVhZCBmcm9tIHRoZSBjdXJyZW50IGZpbGVcbiAgICogICBwb3NpdGlvbi5cbiAgICogQHBhcmFtIFtGdW5jdGlvbihCcm93c2VyRlMuQXBpRXJyb3IsIE51bWJlciwgQnJvd3NlckZTLm5vZGUuQnVmZmVyKV1cbiAgICogICBjYWxsYmFjayBUaGUgbnVtYmVyIGlzIHRoZSBudW1iZXIgb2YgYnl0ZXMgcmVhZFxuICAgKi9cbiAgcHVibGljIHJlYWQoZmQ6IG51bWJlciwgbGVuZ3RoOiBudW1iZXIsIHBvc2l0aW9uOiBudW1iZXIsIGVuY29kaW5nOiBzdHJpbmcsIGNiPzogKGVycjogQXBpRXJyb3IsIGRhdGE/OiBzdHJpbmcsIGJ5dGVzUmVhZD86IG51bWJlcikgPT4gdm9pZCk6IHZvaWQ7XG4gIHB1YmxpYyByZWFkKGZkOiBudW1iZXIsIGJ1ZmZlcjogQnVmZmVyLCBvZmZzZXQ6IG51bWJlciwgbGVuZ3RoOiBudW1iZXIsIHBvc2l0aW9uOiBudW1iZXIsIGNiPzogKGVycjogQXBpRXJyb3IsIGJ5dGVzUmVhZD86IG51bWJlciwgYnVmZmVyPzogQnVmZmVyKSA9PiB2b2lkKTogdm9pZDtcbiAgcHVibGljIHJlYWQoZmQ6IG51bWJlciwgYXJnMjogYW55LCBhcmczOiBhbnksIGFyZzQ6IGFueSwgYXJnNT86IGFueSwgY2I6IChlcnI6IEFwaUVycm9yLCBhcmcyPzogYW55LCBhcmczPzogYW55KSA9PiB2b2lkID0gbm9wQ2IpOiB2b2lkIHtcbiAgICB2YXIgcG9zaXRpb246IG51bWJlciwgb2Zmc2V0OiBudW1iZXIsIGxlbmd0aDogbnVtYmVyLCBidWZmZXI6IEJ1ZmZlciwgbmV3Q2I6IChlcnI6IEFwaUVycm9yLCBieXRlc1JlYWQ/OiBudW1iZXIsIGJ1ZmZlcj86IEJ1ZmZlcikgPT4gdm9pZDtcbiAgICBpZiAodHlwZW9mIGFyZzIgPT09ICdudW1iZXInKSB7XG4gICAgICAvLyBsZWdhY3kgaW50ZXJmYWNlXG4gICAgICAvLyAoZmQsIGxlbmd0aCwgcG9zaXRpb24sIGVuY29kaW5nLCBjYWxsYmFjaylcbiAgICAgIGxlbmd0aCA9IGFyZzI7XG4gICAgICBwb3NpdGlvbiA9IGFyZzM7XG4gICAgICB2YXIgZW5jb2RpbmcgPSBhcmc0O1xuICAgICAgY2IgPSB0eXBlb2YgYXJnNSA9PT0gJ2Z1bmN0aW9uJyA/IGFyZzUgOiBjYjtcbiAgICAgIG9mZnNldCA9IDA7XG4gICAgICBidWZmZXIgPSBuZXcgQnVmZmVyKGxlbmd0aCk7XG4gICAgICAvLyBYWFg6IEluZWZmaWNpZW50LlxuICAgICAgLy8gV3JhcCB0aGUgY2Igc28gd2Ugc2hlbHRlciB1cHBlciBsYXllcnMgb2YgdGhlIEFQSSBmcm9tIHRoZXNlXG4gICAgICAvLyBzaGVuYW5pZ2Fucy5cbiAgICAgIG5ld0NiID0gd3JhcENiKChmdW5jdGlvbihlcnI6IGFueSwgYnl0ZXNSZWFkOiBudW1iZXIsIGJ1ZjogQnVmZmVyKSB7XG4gICAgICAgIGlmIChlcnIpIHtcbiAgICAgICAgICByZXR1cm4gY2IoZXJyKTtcbiAgICAgICAgfVxuICAgICAgICBjYihlcnIsIGJ1Zi50b1N0cmluZyhlbmNvZGluZyksIGJ5dGVzUmVhZCk7XG4gICAgICB9KSwgMyk7XG4gICAgfSBlbHNlIHtcbiAgICAgIGJ1ZmZlciA9IGFyZzI7XG4gICAgICBvZmZzZXQgPSBhcmczO1xuICAgICAgbGVuZ3RoID0gYXJnNDtcbiAgICAgIHBvc2l0aW9uID0gYXJnNTtcbiAgICAgIG5ld0NiID0gd3JhcENiKGNiLCAzKTtcbiAgICB9XG5cbiAgICB0cnkge1xuICAgICAgbGV0IGZpbGUgPSB0aGlzLmZkMmZpbGUoZmQpO1xuICAgICAgaWYgKHBvc2l0aW9uID09IG51bGwpIHtcbiAgICAgICAgcG9zaXRpb24gPSBmaWxlLmdldFBvcygpO1xuICAgICAgfVxuICAgICAgZmlsZS5yZWFkKGJ1ZmZlciwgb2Zmc2V0LCBsZW5ndGgsIHBvc2l0aW9uLCBuZXdDYik7XG4gICAgfSBjYXRjaCAoZSkge1xuICAgICAgbmV3Q2IoZSk7XG4gICAgfVxuICB9XG5cbiAgLyoqXG4gICAqIFJlYWQgZGF0YSBmcm9tIHRoZSBmaWxlIHNwZWNpZmllZCBieSBgZmRgLlxuICAgKiBAcGFyYW0gW0Jyb3dzZXJGUy5GaWxlXSBmZFxuICAgKiBAcGFyYW0gW0Jyb3dzZXJGUy5ub2RlLkJ1ZmZlcl0gYnVmZmVyIFRoZSBidWZmZXIgdGhhdCB0aGUgZGF0YSB3aWxsIGJlXG4gICAqICAgd3JpdHRlbiB0by5cbiAgICogQHBhcmFtIFtOdW1iZXJdIG9mZnNldCBUaGUgb2Zmc2V0IHdpdGhpbiB0aGUgYnVmZmVyIHdoZXJlIHdyaXRpbmcgd2lsbFxuICAgKiAgIHN0YXJ0LlxuICAgKiBAcGFyYW0gW051bWJlcl0gbGVuZ3RoIEFuIGludGVnZXIgc3BlY2lmeWluZyB0aGUgbnVtYmVyIG9mIGJ5dGVzIHRvIHJlYWQuXG4gICAqIEBwYXJhbSBbTnVtYmVyXSBwb3NpdGlvbiBBbiBpbnRlZ2VyIHNwZWNpZnlpbmcgd2hlcmUgdG8gYmVnaW4gcmVhZGluZyBmcm9tXG4gICAqICAgaW4gdGhlIGZpbGUuIElmIHBvc2l0aW9uIGlzIG51bGwsIGRhdGEgd2lsbCBiZSByZWFkIGZyb20gdGhlIGN1cnJlbnQgZmlsZVxuICAgKiAgIHBvc2l0aW9uLlxuICAgKiBAcmV0dXJuIFtOdW1iZXJdXG4gICAqL1xuICBwdWJsaWMgcmVhZFN5bmMoZmQ6IG51bWJlciwgbGVuZ3RoOiBudW1iZXIsIHBvc2l0aW9uOiBudW1iZXIsIGVuY29kaW5nOiBzdHJpbmcpOiBzdHJpbmc7XG4gIHB1YmxpYyByZWFkU3luYyhmZDogbnVtYmVyLCBidWZmZXI6IEJ1ZmZlciwgb2Zmc2V0OiBudW1iZXIsIGxlbmd0aDogbnVtYmVyLCBwb3NpdGlvbjogbnVtYmVyKTogbnVtYmVyO1xuICBwdWJsaWMgcmVhZFN5bmMoZmQ6IG51bWJlciwgYXJnMjogYW55LCBhcmczOiBhbnksIGFyZzQ6IGFueSwgYXJnNT86IGFueSk6IGFueSB7XG4gICAgdmFyIHNoZW5hbmlnYW5zID0gZmFsc2U7XG4gICAgdmFyIGJ1ZmZlcjogQnVmZmVyLCBvZmZzZXQ6IG51bWJlciwgbGVuZ3RoOiBudW1iZXIsIHBvc2l0aW9uOiBudW1iZXI7XG4gICAgaWYgKHR5cGVvZiBhcmcyID09PSAnbnVtYmVyJykge1xuICAgICAgbGVuZ3RoID0gYXJnMjtcbiAgICAgIHBvc2l0aW9uID0gYXJnMztcbiAgICAgIHZhciBlbmNvZGluZyA9IGFyZzQ7XG4gICAgICBvZmZzZXQgPSAwO1xuICAgICAgYnVmZmVyID0gbmV3IEJ1ZmZlcihsZW5ndGgpO1xuICAgICAgc2hlbmFuaWdhbnMgPSB0cnVlO1xuICAgIH0gZWxzZSB7XG4gICAgICBidWZmZXIgPSBhcmcyO1xuICAgICAgb2Zmc2V0ID0gYXJnMztcbiAgICAgIGxlbmd0aCA9IGFyZzQ7XG4gICAgICBwb3NpdGlvbiA9IGFyZzU7XG4gICAgfVxuICAgIGxldCBmaWxlID0gdGhpcy5mZDJmaWxlKGZkKTtcbiAgICBpZiAocG9zaXRpb24gPT0gbnVsbCkge1xuICAgICAgcG9zaXRpb24gPSBmaWxlLmdldFBvcygpO1xuICAgIH1cblxuICAgIHZhciBydiA9IGZpbGUucmVhZFN5bmMoYnVmZmVyLCBvZmZzZXQsIGxlbmd0aCwgcG9zaXRpb24pO1xuICAgIGlmICghc2hlbmFuaWdhbnMpIHtcbiAgICAgIHJldHVybiBydjtcbiAgICB9IGVsc2Uge1xuICAgICAgcmV0dXJuIFtidWZmZXIudG9TdHJpbmcoZW5jb2RpbmcpLCBydl07XG4gICAgfVxuICB9XG5cbiAgLyoqXG4gICAqIEFzeW5jaHJvbm91cyBgZmNob3duYC5cbiAgICogQHBhcmFtIFtCcm93c2VyRlMuRmlsZV0gZmRcbiAgICogQHBhcmFtIFtOdW1iZXJdIHVpZFxuICAgKiBAcGFyYW0gW051bWJlcl0gZ2lkXG4gICAqIEBwYXJhbSBbRnVuY3Rpb24oQnJvd3NlckZTLkFwaUVycm9yKV0gY2FsbGJhY2tcbiAgICovXG4gIHB1YmxpYyBmY2hvd24oZmQ6IG51bWJlciwgdWlkOiBudW1iZXIsIGdpZDogbnVtYmVyLCBjYWxsYmFjazogKGU/OiBBcGlFcnJvcikgPT4gdm9pZCA9IG5vcENiKTogdm9pZCB7XG4gICAgdmFyIG5ld0NiID0gd3JhcENiKGNhbGxiYWNrLCAxKTtcbiAgICB0cnkge1xuICAgICAgdGhpcy5mZDJmaWxlKGZkKS5jaG93bih1aWQsIGdpZCwgbmV3Q2IpO1xuICAgIH0gY2F0Y2ggKGUpIHtcbiAgICAgIG5ld0NiKGUpO1xuICAgIH1cbiAgfVxuXG4gIC8qKlxuICAgKiBTeW5jaHJvbm91cyBgZmNob3duYC5cbiAgICogQHBhcmFtIFtCcm93c2VyRlMuRmlsZV0gZmRcbiAgICogQHBhcmFtIFtOdW1iZXJdIHVpZFxuICAgKiBAcGFyYW0gW051bWJlcl0gZ2lkXG4gICAqL1xuICBwdWJsaWMgZmNob3duU3luYyhmZDogbnVtYmVyLCB1aWQ6IG51bWJlciwgZ2lkOiBudW1iZXIpOiB2b2lkIHtcbiAgICB0aGlzLmZkMmZpbGUoZmQpLmNob3duU3luYyh1aWQsIGdpZCk7XG4gIH1cblxuICAvKipcbiAgICogQXN5bmNocm9ub3VzIGBmY2htb2RgLlxuICAgKiBAcGFyYW0gW0Jyb3dzZXJGUy5GaWxlXSBmZFxuICAgKiBAcGFyYW0gW051bWJlcl0gbW9kZVxuICAgKiBAcGFyYW0gW0Z1bmN0aW9uKEJyb3dzZXJGUy5BcGlFcnJvcildIGNhbGxiYWNrXG4gICAqL1xuICBwdWJsaWMgZmNobW9kKGZkOiBudW1iZXIsIG1vZGU6IHN0cmluZyB8IG51bWJlciwgY2I/OiAoZT86IEFwaUVycm9yKSA9PiB2b2lkKTogdm9pZCB7XG4gICAgdmFyIG5ld0NiID0gd3JhcENiKGNiLCAxKTtcbiAgICB0cnkge1xuICAgICAgbGV0IG51bU1vZGUgPSB0eXBlb2YgbW9kZSA9PT0gJ3N0cmluZycgPyBwYXJzZUludChtb2RlLCA4KSA6IG1vZGU7XG4gICAgICB0aGlzLmZkMmZpbGUoZmQpLmNobW9kKG51bU1vZGUsIG5ld0NiKTtcbiAgICB9IGNhdGNoIChlKSB7XG4gICAgICBuZXdDYihlKTtcbiAgICB9XG4gIH1cblxuICAvKipcbiAgICogU3luY2hyb25vdXMgYGZjaG1vZGAuXG4gICAqIEBwYXJhbSBbQnJvd3NlckZTLkZpbGVdIGZkXG4gICAqIEBwYXJhbSBbTnVtYmVyXSBtb2RlXG4gICAqL1xuICBwdWJsaWMgZmNobW9kU3luYyhmZDogbnVtYmVyLCBtb2RlOiBudW1iZXIgfCBzdHJpbmcpOiB2b2lkIHtcbiAgICBsZXQgbnVtTW9kZSA9IHR5cGVvZiBtb2RlID09PSAnc3RyaW5nJyA/IHBhcnNlSW50KG1vZGUsIDgpIDogbW9kZTtcbiAgICB0aGlzLmZkMmZpbGUoZmQpLmNobW9kU3luYyhudW1Nb2RlKTtcbiAgfVxuXG4gIC8qKlxuICAgKiBDaGFuZ2UgdGhlIGZpbGUgdGltZXN0YW1wcyBvZiBhIGZpbGUgcmVmZXJlbmNlZCBieSB0aGUgc3VwcGxpZWQgZmlsZVxuICAgKiBkZXNjcmlwdG9yLlxuICAgKiBAcGFyYW0gW0Jyb3dzZXJGUy5GaWxlXSBmZFxuICAgKiBAcGFyYW0gW0RhdGVdIGF0aW1lXG4gICAqIEBwYXJhbSBbRGF0ZV0gbXRpbWVcbiAgICogQHBhcmFtIFtGdW5jdGlvbihCcm93c2VyRlMuQXBpRXJyb3IpXSBjYWxsYmFja1xuICAgKi9cbiAgcHVibGljIGZ1dGltZXMoZmQ6IG51bWJlciwgYXRpbWU6IG51bWJlciwgbXRpbWU6IG51bWJlciwgY2I6IChlPzogQXBpRXJyb3IpID0+IHZvaWQpOiB2b2lkO1xuICBwdWJsaWMgZnV0aW1lcyhmZDogbnVtYmVyLCBhdGltZTogRGF0ZSwgbXRpbWU6IERhdGUsIGNiOiAoZT86IEFwaUVycm9yKSA9PiB2b2lkKTogdm9pZDtcbiAgcHVibGljIGZ1dGltZXMoZmQ6IG51bWJlciwgYXRpbWU6IGFueSwgbXRpbWU6IGFueSwgY2I6IChlPzogQXBpRXJyb3IpID0+IHZvaWQgPSBub3BDYik6IHZvaWQge1xuICAgIHZhciBuZXdDYiA9IHdyYXBDYihjYiwgMSk7XG4gICAgdHJ5IHtcbiAgICAgIGxldCBmaWxlID0gdGhpcy5mZDJmaWxlKGZkKTtcbiAgICAgIGlmICh0eXBlb2YgYXRpbWUgPT09ICdudW1iZXInKSB7XG4gICAgICAgIGF0aW1lID0gbmV3IERhdGUoYXRpbWUgKiAxMDAwKTtcbiAgICAgIH1cbiAgICAgIGlmICh0eXBlb2YgbXRpbWUgPT09ICdudW1iZXInKSB7XG4gICAgICAgIG10aW1lID0gbmV3IERhdGUobXRpbWUgKiAxMDAwKTtcbiAgICAgIH1cbiAgICAgIGZpbGUudXRpbWVzKGF0aW1lLCBtdGltZSwgbmV3Q2IpO1xuICAgIH0gY2F0Y2ggKGUpIHtcbiAgICAgIG5ld0NiKGUpO1xuICAgIH1cbiAgfVxuXG4gIC8qKlxuICAgKiBDaGFuZ2UgdGhlIGZpbGUgdGltZXN0YW1wcyBvZiBhIGZpbGUgcmVmZXJlbmNlZCBieSB0aGUgc3VwcGxpZWQgZmlsZVxuICAgKiBkZXNjcmlwdG9yLlxuICAgKiBAcGFyYW0gW0Jyb3dzZXJGUy5GaWxlXSBmZFxuICAgKiBAcGFyYW0gW0RhdGVdIGF0aW1lXG4gICAqIEBwYXJhbSBbRGF0ZV0gbXRpbWVcbiAgICovXG4gIHB1YmxpYyBmdXRpbWVzU3luYyhmZDogbnVtYmVyLCBhdGltZTogbnVtYmVyIHwgRGF0ZSwgbXRpbWU6IG51bWJlciB8IERhdGUpOiB2b2lkIHtcbiAgICB0aGlzLmZkMmZpbGUoZmQpLnV0aW1lc1N5bmMobm9ybWFsaXplVGltZShhdGltZSksIG5vcm1hbGl6ZVRpbWUobXRpbWUpKTtcbiAgfVxuXG4gIC8vIERJUkVDVE9SWS1PTkxZIE1FVEhPRFNcblxuICAvKipcbiAgICogQXN5bmNocm9ub3VzIGBybWRpcmAuXG4gICAqIEBwYXJhbSBbU3RyaW5nXSBwYXRoXG4gICAqIEBwYXJhbSBbRnVuY3Rpb24oQnJvd3NlckZTLkFwaUVycm9yKV0gY2FsbGJhY2tcbiAgICovXG4gIHB1YmxpYyBybWRpcihwYXRoOiBzdHJpbmcsIGNiOiAoZT86IEFwaUVycm9yKSA9PiB2b2lkID0gbm9wQ2IpOiB2b2lkIHtcbiAgICB2YXIgbmV3Q2IgPSB3cmFwQ2IoY2IsIDEpO1xuICAgIHRyeSB7XG4gICAgICBwYXRoID0gbm9ybWFsaXplUGF0aChwYXRoKTtcbiAgICAgIHRoaXMucm9vdC5ybWRpcihwYXRoLCBuZXdDYik7XG4gICAgfSBjYXRjaCAoZSkge1xuICAgICAgbmV3Q2IoZSk7XG4gICAgfVxuICB9XG5cbiAgLyoqXG4gICAqIFN5bmNocm9ub3VzIGBybWRpcmAuXG4gICAqIEBwYXJhbSBbU3RyaW5nXSBwYXRoXG4gICAqL1xuICBwdWJsaWMgcm1kaXJTeW5jKHBhdGg6IHN0cmluZyk6IHZvaWQge1xuICAgIHBhdGggPSBub3JtYWxpemVQYXRoKHBhdGgpO1xuICAgIHJldHVybiB0aGlzLnJvb3Qucm1kaXJTeW5jKHBhdGgpO1xuICB9XG5cbiAgLyoqXG4gICAqIEFzeW5jaHJvbm91cyBgbWtkaXJgLlxuICAgKiBAcGFyYW0gW1N0cmluZ10gcGF0aFxuICAgKiBAcGFyYW0gW051bWJlcj9dIG1vZGUgZGVmYXVsdHMgdG8gYDA3NzdgXG4gICAqIEBwYXJhbSBbRnVuY3Rpb24oQnJvd3NlckZTLkFwaUVycm9yKV0gY2FsbGJhY2tcbiAgICovXG4gIHB1YmxpYyBta2RpcihwYXRoOiBzdHJpbmcsIG1vZGU/OiBhbnksIGNiOiAoZT86IEFwaUVycm9yKSA9PiB2b2lkID0gbm9wQ2IpOiB2b2lkIHtcbiAgICBpZiAodHlwZW9mIG1vZGUgPT09ICdmdW5jdGlvbicpIHtcbiAgICAgIGNiID0gbW9kZTtcbiAgICAgIG1vZGUgPSAweDFmZjtcbiAgICB9XG4gICAgdmFyIG5ld0NiID0gd3JhcENiKGNiLCAxKTtcbiAgICB0cnkge1xuICAgICAgcGF0aCA9IG5vcm1hbGl6ZVBhdGgocGF0aCk7XG4gICAgICB0aGlzLnJvb3QubWtkaXIocGF0aCwgbW9kZSwgbmV3Q2IpO1xuICAgIH0gY2F0Y2ggKGUpIHtcbiAgICAgIG5ld0NiKGUpO1xuICAgIH1cbiAgfVxuXG4gIC8qKlxuICAgKiBTeW5jaHJvbm91cyBgbWtkaXJgLlxuICAgKiBAcGFyYW0gW1N0cmluZ10gcGF0aFxuICAgKiBAcGFyYW0gW051bWJlcj9dIG1vZGUgZGVmYXVsdHMgdG8gYDA3NzdgXG4gICAqL1xuICBwdWJsaWMgbWtkaXJTeW5jKHBhdGg6IHN0cmluZywgbW9kZT86IG51bWJlciB8IHN0cmluZyk6IHZvaWQge1xuICAgIHRoaXMucm9vdC5ta2RpclN5bmMobm9ybWFsaXplUGF0aChwYXRoKSwgbm9ybWFsaXplTW9kZShtb2RlLCAweDFmZikpO1xuICB9XG5cbiAgLyoqXG4gICAqIEFzeW5jaHJvbm91cyBgcmVhZGRpcmAuIFJlYWRzIHRoZSBjb250ZW50cyBvZiBhIGRpcmVjdG9yeS5cbiAgICogVGhlIGNhbGxiYWNrIGdldHMgdHdvIGFyZ3VtZW50cyBgKGVyciwgZmlsZXMpYCB3aGVyZSBgZmlsZXNgIGlzIGFuIGFycmF5IG9mXG4gICAqIHRoZSBuYW1lcyBvZiB0aGUgZmlsZXMgaW4gdGhlIGRpcmVjdG9yeSBleGNsdWRpbmcgYCcuJ2AgYW5kIGAnLi4nYC5cbiAgICogQHBhcmFtIFtTdHJpbmddIHBhdGhcbiAgICogQHBhcmFtIFtGdW5jdGlvbihCcm93c2VyRlMuQXBpRXJyb3IsIFN0cmluZ1tdKV0gY2FsbGJhY2tcbiAgICovXG4gIHB1YmxpYyByZWFkZGlyKHBhdGg6IHN0cmluZywgY2I6IChlcnI6IEFwaUVycm9yLCBmaWxlcz86IHN0cmluZ1tdKSA9PiB2b2lkID0gbm9wQ2IpOiB2b2lkIHtcbiAgICB2YXIgbmV3Q2IgPSA8KGVycjogQXBpRXJyb3IsIGZpbGVzPzogc3RyaW5nW10pID0+IHZvaWQ+IHdyYXBDYihjYiwgMik7XG4gICAgdHJ5IHtcbiAgICAgIHBhdGggPSBub3JtYWxpemVQYXRoKHBhdGgpO1xuICAgICAgdGhpcy5yb290LnJlYWRkaXIocGF0aCwgbmV3Q2IpO1xuICAgIH0gY2F0Y2ggKGUpIHtcbiAgICAgIG5ld0NiKGUpO1xuICAgIH1cbiAgfVxuXG4gIC8qKlxuICAgKiBTeW5jaHJvbm91cyBgcmVhZGRpcmAuIFJlYWRzIHRoZSBjb250ZW50cyBvZiBhIGRpcmVjdG9yeS5cbiAgICogQHBhcmFtIFtTdHJpbmddIHBhdGhcbiAgICogQHJldHVybiBbU3RyaW5nW11dXG4gICAqL1xuICBwdWJsaWMgcmVhZGRpclN5bmMocGF0aDogc3RyaW5nKTogc3RyaW5nW10ge1xuICAgIHBhdGggPSBub3JtYWxpemVQYXRoKHBhdGgpO1xuICAgIHJldHVybiB0aGlzLnJvb3QucmVhZGRpclN5bmMocGF0aCk7XG4gIH1cblxuICAvLyBTWU1MSU5LIE1FVEhPRFNcblxuICAvKipcbiAgICogQXN5bmNocm9ub3VzIGBsaW5rYC5cbiAgICogQHBhcmFtIFtTdHJpbmddIHNyY3BhdGhcbiAgICogQHBhcmFtIFtTdHJpbmddIGRzdHBhdGhcbiAgICogQHBhcmFtIFtGdW5jdGlvbihCcm93c2VyRlMuQXBpRXJyb3IpXSBjYWxsYmFja1xuICAgKi9cbiAgcHVibGljIGxpbmsoc3JjcGF0aDogc3RyaW5nLCBkc3RwYXRoOiBzdHJpbmcsIGNiOiAoZT86IEFwaUVycm9yKSA9PiB2b2lkID0gbm9wQ2IpOiB2b2lkIHtcbiAgICB2YXIgbmV3Q2IgPSB3cmFwQ2IoY2IsIDEpO1xuICAgIHRyeSB7XG4gICAgICBzcmNwYXRoID0gbm9ybWFsaXplUGF0aChzcmNwYXRoKTtcbiAgICAgIGRzdHBhdGggPSBub3JtYWxpemVQYXRoKGRzdHBhdGgpO1xuICAgICAgdGhpcy5yb290Lmxpbmsoc3JjcGF0aCwgZHN0cGF0aCwgbmV3Q2IpO1xuICAgIH0gY2F0Y2ggKGUpIHtcbiAgICAgIG5ld0NiKGUpO1xuICAgIH1cbiAgfVxuXG4gIC8qKlxuICAgKiBTeW5jaHJvbm91cyBgbGlua2AuXG4gICAqIEBwYXJhbSBbU3RyaW5nXSBzcmNwYXRoXG4gICAqIEBwYXJhbSBbU3RyaW5nXSBkc3RwYXRoXG4gICAqL1xuICBwdWJsaWMgbGlua1N5bmMoc3JjcGF0aDogc3RyaW5nLCBkc3RwYXRoOiBzdHJpbmcpOiB2b2lkIHtcbiAgICBzcmNwYXRoID0gbm9ybWFsaXplUGF0aChzcmNwYXRoKTtcbiAgICBkc3RwYXRoID0gbm9ybWFsaXplUGF0aChkc3RwYXRoKTtcbiAgICByZXR1cm4gdGhpcy5yb290LmxpbmtTeW5jKHNyY3BhdGgsIGRzdHBhdGgpO1xuICB9XG5cbiAgLyoqXG4gICAqIEFzeW5jaHJvbm91cyBgc3ltbGlua2AuXG4gICAqIEBwYXJhbSBbU3RyaW5nXSBzcmNwYXRoXG4gICAqIEBwYXJhbSBbU3RyaW5nXSBkc3RwYXRoXG4gICAqIEBwYXJhbSBbU3RyaW5nP10gdHlwZSBjYW4gYmUgZWl0aGVyIGAnZGlyJ2Agb3IgYCdmaWxlJ2AgKGRlZmF1bHQgaXMgYCdmaWxlJ2ApXG4gICAqIEBwYXJhbSBbRnVuY3Rpb24oQnJvd3NlckZTLkFwaUVycm9yKV0gY2FsbGJhY2tcbiAgICovXG4gIHB1YmxpYyBzeW1saW5rKHNyY3BhdGg6IHN0cmluZywgZHN0cGF0aDogc3RyaW5nLCBjYj86IChlPzogQXBpRXJyb3IpID0+IHZvaWQpOiB2b2lkO1xuICBwdWJsaWMgc3ltbGluayhzcmNwYXRoOiBzdHJpbmcsIGRzdHBhdGg6IHN0cmluZywgdHlwZT86IHN0cmluZywgY2I/OiAoZT86IEFwaUVycm9yKSA9PiB2b2lkKTogdm9pZDtcbiAgcHVibGljIHN5bWxpbmsoc3JjcGF0aDogc3RyaW5nLCBkc3RwYXRoOiBzdHJpbmcsIGFyZzM/OiBhbnksIGNiOiAoZT86IEFwaUVycm9yKSA9PiB2b2lkID0gbm9wQ2IpOiB2b2lkIHtcbiAgICB2YXIgdHlwZSA9IHR5cGVvZiBhcmczID09PSAnc3RyaW5nJyA/IGFyZzMgOiAnZmlsZSc7XG4gICAgY2IgPSB0eXBlb2YgYXJnMyA9PT0gJ2Z1bmN0aW9uJyA/IGFyZzMgOiBjYjtcbiAgICB2YXIgbmV3Q2IgPSB3cmFwQ2IoY2IsIDEpO1xuICAgIHRyeSB7XG4gICAgICBpZiAodHlwZSAhPT0gJ2ZpbGUnICYmIHR5cGUgIT09ICdkaXInKSB7XG4gICAgICAgIHJldHVybiBuZXdDYihuZXcgQXBpRXJyb3IoRXJyb3JDb2RlLkVJTlZBTCwgXCJJbnZhbGlkIHR5cGU6IFwiICsgdHlwZSkpO1xuICAgICAgfVxuICAgICAgc3JjcGF0aCA9IG5vcm1hbGl6ZVBhdGgoc3JjcGF0aCk7XG4gICAgICBkc3RwYXRoID0gbm9ybWFsaXplUGF0aChkc3RwYXRoKTtcbiAgICAgIHRoaXMucm9vdC5zeW1saW5rKHNyY3BhdGgsIGRzdHBhdGgsIHR5cGUsIG5ld0NiKTtcbiAgICB9IGNhdGNoIChlKSB7XG4gICAgICBuZXdDYihlKTtcbiAgICB9XG4gIH1cblxuICAvKipcbiAgICogU3luY2hyb25vdXMgYHN5bWxpbmtgLlxuICAgKiBAcGFyYW0gW1N0cmluZ10gc3JjcGF0aFxuICAgKiBAcGFyYW0gW1N0cmluZ10gZHN0cGF0aFxuICAgKiBAcGFyYW0gW1N0cmluZz9dIHR5cGUgY2FuIGJlIGVpdGhlciBgJ2RpcidgIG9yIGAnZmlsZSdgIChkZWZhdWx0IGlzIGAnZmlsZSdgKVxuICAgKi9cbiAgcHVibGljIHN5bWxpbmtTeW5jKHNyY3BhdGg6IHN0cmluZywgZHN0cGF0aDogc3RyaW5nLCB0eXBlPzogc3RyaW5nKTogdm9pZCB7XG4gICAgaWYgKHR5cGUgPT0gbnVsbCkge1xuICAgICAgdHlwZSA9ICdmaWxlJztcbiAgICB9IGVsc2UgaWYgKHR5cGUgIT09ICdmaWxlJyAmJiB0eXBlICE9PSAnZGlyJykge1xuICAgICAgdGhyb3cgbmV3IEFwaUVycm9yKEVycm9yQ29kZS5FSU5WQUwsIFwiSW52YWxpZCB0eXBlOiBcIiArIHR5cGUpO1xuICAgIH1cbiAgICBzcmNwYXRoID0gbm9ybWFsaXplUGF0aChzcmNwYXRoKTtcbiAgICBkc3RwYXRoID0gbm9ybWFsaXplUGF0aChkc3RwYXRoKTtcbiAgICByZXR1cm4gdGhpcy5yb290LnN5bWxpbmtTeW5jKHNyY3BhdGgsIGRzdHBhdGgsIHR5cGUpO1xuICB9XG5cbiAgLyoqXG4gICAqIEFzeW5jaHJvbm91cyByZWFkbGluay5cbiAgICogQHBhcmFtIFtTdHJpbmddIHBhdGhcbiAgICogQHBhcmFtIFtGdW5jdGlvbihCcm93c2VyRlMuQXBpRXJyb3IsIFN0cmluZyldIGNhbGxiYWNrXG4gICAqL1xuICBwdWJsaWMgcmVhZGxpbmsocGF0aDogc3RyaW5nLCBjYjogKGVycjogQXBpRXJyb3IsIGxpbmtTdHJpbmc/OiBzdHJpbmcpID0+IGFueSA9IG5vcENiKTogdm9pZCB7XG4gICAgdmFyIG5ld0NiID0gd3JhcENiKGNiLCAyKTtcbiAgICB0cnkge1xuICAgICAgcGF0aCA9IG5vcm1hbGl6ZVBhdGgocGF0aCk7XG4gICAgICB0aGlzLnJvb3QucmVhZGxpbmsocGF0aCwgbmV3Q2IpO1xuICAgIH0gY2F0Y2ggKGUpIHtcbiAgICAgIG5ld0NiKGUpO1xuICAgIH1cbiAgfVxuXG4gIC8qKlxuICAgKiBTeW5jaHJvbm91cyByZWFkbGluay5cbiAgICogQHBhcmFtIFtTdHJpbmddIHBhdGhcbiAgICogQHJldHVybiBbU3RyaW5nXVxuICAgKi9cbiAgcHVibGljIHJlYWRsaW5rU3luYyhwYXRoOiBzdHJpbmcpOiBzdHJpbmcge1xuICAgIHBhdGggPSBub3JtYWxpemVQYXRoKHBhdGgpO1xuICAgIHJldHVybiB0aGlzLnJvb3QucmVhZGxpbmtTeW5jKHBhdGgpO1xuICB9XG5cbiAgLy8gUFJPUEVSVFkgT1BFUkFUSU9OU1xuXG4gIC8qKlxuICAgKiBBc3luY2hyb25vdXMgYGNob3duYC5cbiAgICogQHBhcmFtIFtTdHJpbmddIHBhdGhcbiAgICogQHBhcmFtIFtOdW1iZXJdIHVpZFxuICAgKiBAcGFyYW0gW051bWJlcl0gZ2lkXG4gICAqIEBwYXJhbSBbRnVuY3Rpb24oQnJvd3NlckZTLkFwaUVycm9yKV0gY2FsbGJhY2tcbiAgICovXG4gIHB1YmxpYyBjaG93bihwYXRoOiBzdHJpbmcsIHVpZDogbnVtYmVyLCBnaWQ6IG51bWJlciwgY2I6IChlPzogQXBpRXJyb3IpID0+IHZvaWQgPSBub3BDYik6IHZvaWQge1xuICAgIHZhciBuZXdDYiA9IHdyYXBDYihjYiwgMSk7XG4gICAgdHJ5IHtcbiAgICAgIHBhdGggPSBub3JtYWxpemVQYXRoKHBhdGgpO1xuICAgICAgdGhpcy5yb290LmNob3duKHBhdGgsIGZhbHNlLCB1aWQsIGdpZCwgbmV3Q2IpO1xuICAgIH0gY2F0Y2ggKGUpIHtcbiAgICAgIG5ld0NiKGUpO1xuICAgIH1cbiAgfVxuXG4gIC8qKlxuICAgKiBTeW5jaHJvbm91cyBgY2hvd25gLlxuICAgKiBAcGFyYW0gW1N0cmluZ10gcGF0aFxuICAgKiBAcGFyYW0gW051bWJlcl0gdWlkXG4gICAqIEBwYXJhbSBbTnVtYmVyXSBnaWRcbiAgICovXG4gIHB1YmxpYyBjaG93blN5bmMocGF0aDogc3RyaW5nLCB1aWQ6IG51bWJlciwgZ2lkOiBudW1iZXIpOiB2b2lkIHtcbiAgICBwYXRoID0gbm9ybWFsaXplUGF0aChwYXRoKTtcbiAgICB0aGlzLnJvb3QuY2hvd25TeW5jKHBhdGgsIGZhbHNlLCB1aWQsIGdpZCk7XG4gIH1cblxuICAvKipcbiAgICogQXN5bmNocm9ub3VzIGBsY2hvd25gLlxuICAgKiBAcGFyYW0gW1N0cmluZ10gcGF0aFxuICAgKiBAcGFyYW0gW051bWJlcl0gdWlkXG4gICAqIEBwYXJhbSBbTnVtYmVyXSBnaWRcbiAgICogQHBhcmFtIFtGdW5jdGlvbihCcm93c2VyRlMuQXBpRXJyb3IpXSBjYWxsYmFja1xuICAgKi9cbiAgcHVibGljIGxjaG93bihwYXRoOiBzdHJpbmcsIHVpZDogbnVtYmVyLCBnaWQ6IG51bWJlciwgY2I6IChlPzogQXBpRXJyb3IpID0+IHZvaWQgPSBub3BDYik6IHZvaWQge1xuICAgIHZhciBuZXdDYiA9IHdyYXBDYihjYiwgMSk7XG4gICAgdHJ5IHtcbiAgICAgIHBhdGggPSBub3JtYWxpemVQYXRoKHBhdGgpO1xuICAgICAgdGhpcy5yb290LmNob3duKHBhdGgsIHRydWUsIHVpZCwgZ2lkLCBuZXdDYik7XG4gICAgfSBjYXRjaCAoZSkge1xuICAgICAgbmV3Q2IoZSk7XG4gICAgfVxuICB9XG5cbiAgLyoqXG4gICAqIFN5bmNocm9ub3VzIGBsY2hvd25gLlxuICAgKiBAcGFyYW0gW1N0cmluZ10gcGF0aFxuICAgKiBAcGFyYW0gW051bWJlcl0gdWlkXG4gICAqIEBwYXJhbSBbTnVtYmVyXSBnaWRcbiAgICovXG4gIHB1YmxpYyBsY2hvd25TeW5jKHBhdGg6IHN0cmluZywgdWlkOiBudW1iZXIsIGdpZDogbnVtYmVyKTogdm9pZCB7XG4gICAgcGF0aCA9IG5vcm1hbGl6ZVBhdGgocGF0aCk7XG4gICAgdGhpcy5yb290LmNob3duU3luYyhwYXRoLCB0cnVlLCB1aWQsIGdpZCk7XG4gIH1cblxuICAvKipcbiAgICogQXN5bmNocm9ub3VzIGBjaG1vZGAuXG4gICAqIEBwYXJhbSBbU3RyaW5nXSBwYXRoXG4gICAqIEBwYXJhbSBbTnVtYmVyXSBtb2RlXG4gICAqIEBwYXJhbSBbRnVuY3Rpb24oQnJvd3NlckZTLkFwaUVycm9yKV0gY2FsbGJhY2tcbiAgICovXG4gIHB1YmxpYyBjaG1vZChwYXRoOiBzdHJpbmcsIG1vZGU6IG51bWJlciB8IHN0cmluZywgY2I6IChlPzogQXBpRXJyb3IpID0+IHZvaWQgPSBub3BDYik6IHZvaWQge1xuICAgIHZhciBuZXdDYiA9IHdyYXBDYihjYiwgMSk7XG4gICAgdHJ5IHtcbiAgICAgIGxldCBudW1Nb2RlID0gbm9ybWFsaXplTW9kZShtb2RlLCAtMSk7XG4gICAgICBpZiAobnVtTW9kZSA8IDApIHtcbiAgICAgICAgdGhyb3cgbmV3IEFwaUVycm9yKEVycm9yQ29kZS5FSU5WQUwsIGBJbnZhbGlkIG1vZGUuYCk7XG4gICAgICB9XG4gICAgICB0aGlzLnJvb3QuY2htb2Qobm9ybWFsaXplUGF0aChwYXRoKSwgZmFsc2UsIG51bU1vZGUsIG5ld0NiKTtcbiAgICB9IGNhdGNoIChlKSB7XG4gICAgICBuZXdDYihlKTtcbiAgICB9XG4gIH1cblxuICAvKipcbiAgICogU3luY2hyb25vdXMgYGNobW9kYC5cbiAgICogQHBhcmFtIFtTdHJpbmddIHBhdGhcbiAgICogQHBhcmFtIFtOdW1iZXJdIG1vZGVcbiAgICovXG4gIHB1YmxpYyBjaG1vZFN5bmMocGF0aDogc3RyaW5nLCBtb2RlOiBzdHJpbmd8bnVtYmVyKTogdm9pZCB7XG4gICAgbGV0IG51bU1vZGUgPSBub3JtYWxpemVNb2RlKG1vZGUsIC0xKTtcbiAgICBpZiAobnVtTW9kZSA8IDApIHtcbiAgICAgIHRocm93IG5ldyBBcGlFcnJvcihFcnJvckNvZGUuRUlOVkFMLCBgSW52YWxpZCBtb2RlLmApO1xuICAgIH1cbiAgICBwYXRoID0gbm9ybWFsaXplUGF0aChwYXRoKTtcbiAgICB0aGlzLnJvb3QuY2htb2RTeW5jKHBhdGgsIGZhbHNlLCBudW1Nb2RlKTtcbiAgfVxuXG4gIC8qKlxuICAgKiBBc3luY2hyb25vdXMgYGxjaG1vZGAuXG4gICAqIEBwYXJhbSBbU3RyaW5nXSBwYXRoXG4gICAqIEBwYXJhbSBbTnVtYmVyXSBtb2RlXG4gICAqIEBwYXJhbSBbRnVuY3Rpb24oQnJvd3NlckZTLkFwaUVycm9yKV0gY2FsbGJhY2tcbiAgICovXG4gIHB1YmxpYyBsY2htb2QocGF0aDogc3RyaW5nLCBtb2RlOiBudW1iZXJ8c3RyaW5nLCBjYjogRnVuY3Rpb24gPSBub3BDYik6IHZvaWQge1xuICAgIHZhciBuZXdDYiA9IHdyYXBDYihjYiwgMSk7XG4gICAgdHJ5IHtcbiAgICAgIGxldCBudW1Nb2RlID0gbm9ybWFsaXplTW9kZShtb2RlLCAtMSk7XG4gICAgICBpZiAobnVtTW9kZSA8IDApIHtcbiAgICAgICAgdGhyb3cgbmV3IEFwaUVycm9yKEVycm9yQ29kZS5FSU5WQUwsIGBJbnZhbGlkIG1vZGUuYCk7XG4gICAgICB9XG4gICAgICB0aGlzLnJvb3QuY2htb2Qobm9ybWFsaXplUGF0aChwYXRoKSwgdHJ1ZSwgbnVtTW9kZSwgbmV3Q2IpO1xuICAgIH0gY2F0Y2ggKGUpIHtcbiAgICAgIG5ld0NiKGUpO1xuICAgIH1cbiAgfVxuXG4gIC8qKlxuICAgKiBTeW5jaHJvbm91cyBgbGNobW9kYC5cbiAgICogQHBhcmFtIFtTdHJpbmddIHBhdGhcbiAgICogQHBhcmFtIFtOdW1iZXJdIG1vZGVcbiAgICovXG4gIHB1YmxpYyBsY2htb2RTeW5jKHBhdGg6IHN0cmluZywgbW9kZTogbnVtYmVyfHN0cmluZyk6IHZvaWQge1xuICAgIGxldCBudW1Nb2RlID0gbm9ybWFsaXplTW9kZShtb2RlLCAtMSk7XG4gICAgaWYgKG51bU1vZGUgPCAxKSB7XG4gICAgICB0aHJvdyBuZXcgQXBpRXJyb3IoRXJyb3JDb2RlLkVJTlZBTCwgYEludmFsaWQgbW9kZS5gKTtcbiAgICB9XG4gICAgdGhpcy5yb290LmNobW9kU3luYyhub3JtYWxpemVQYXRoKHBhdGgpLCB0cnVlLCBudW1Nb2RlKTtcbiAgfVxuXG4gIC8qKlxuICAgKiBDaGFuZ2UgZmlsZSB0aW1lc3RhbXBzIG9mIHRoZSBmaWxlIHJlZmVyZW5jZWQgYnkgdGhlIHN1cHBsaWVkIHBhdGguXG4gICAqIEBwYXJhbSBbU3RyaW5nXSBwYXRoXG4gICAqIEBwYXJhbSBbRGF0ZV0gYXRpbWVcbiAgICogQHBhcmFtIFtEYXRlXSBtdGltZVxuICAgKiBAcGFyYW0gW0Z1bmN0aW9uKEJyb3dzZXJGUy5BcGlFcnJvcildIGNhbGxiYWNrXG4gICAqL1xuICBwdWJsaWMgdXRpbWVzKHBhdGg6IHN0cmluZywgYXRpbWU6IG51bWJlcnxEYXRlLCBtdGltZTogbnVtYmVyfERhdGUsIGNiOiAoZT86IEFwaUVycm9yKSA9PiB2b2lkID0gbm9wQ2IpOiB2b2lkIHtcbiAgICB2YXIgbmV3Q2IgPSB3cmFwQ2IoY2IsIDEpO1xuICAgIHRyeSB7XG4gICAgICB0aGlzLnJvb3QudXRpbWVzKG5vcm1hbGl6ZVBhdGgocGF0aCksIG5vcm1hbGl6ZVRpbWUoYXRpbWUpLCBub3JtYWxpemVUaW1lKG10aW1lKSwgbmV3Q2IpO1xuICAgIH0gY2F0Y2ggKGUpIHtcbiAgICAgIG5ld0NiKGUpO1xuICAgIH1cbiAgfVxuXG4gIC8qKlxuICAgKiBDaGFuZ2UgZmlsZSB0aW1lc3RhbXBzIG9mIHRoZSBmaWxlIHJlZmVyZW5jZWQgYnkgdGhlIHN1cHBsaWVkIHBhdGguXG4gICAqIEBwYXJhbSBbU3RyaW5nXSBwYXRoXG4gICAqIEBwYXJhbSBbRGF0ZV0gYXRpbWVcbiAgICogQHBhcmFtIFtEYXRlXSBtdGltZVxuICAgKi9cbiAgcHVibGljIHV0aW1lc1N5bmMocGF0aDogc3RyaW5nLCBhdGltZTogbnVtYmVyfERhdGUsIG10aW1lOiBudW1iZXJ8RGF0ZSk6IHZvaWQge1xuICAgIHRoaXMucm9vdC51dGltZXNTeW5jKG5vcm1hbGl6ZVBhdGgocGF0aCksIG5vcm1hbGl6ZVRpbWUoYXRpbWUpLCBub3JtYWxpemVUaW1lKG10aW1lKSk7XG4gIH1cblxuICAvKipcbiAgICogQXN5bmNocm9ub3VzIGByZWFscGF0aGAuIFRoZSBjYWxsYmFjayBnZXRzIHR3byBhcmd1bWVudHNcbiAgICogYChlcnIsIHJlc29sdmVkUGF0aClgLiBNYXkgdXNlIGBwcm9jZXNzLmN3ZGAgdG8gcmVzb2x2ZSByZWxhdGl2ZSBwYXRocy5cbiAgICpcbiAgICogQGV4YW1wbGUgVXNhZ2UgZXhhbXBsZVxuICAgKiAgIHZhciBjYWNoZSA9IHsnL2V0Yyc6Jy9wcml2YXRlL2V0Yyd9O1xuICAgKiAgIGZzLnJlYWxwYXRoKCcvZXRjL3Bhc3N3ZCcsIGNhY2hlLCBmdW5jdGlvbiAoZXJyLCByZXNvbHZlZFBhdGgpIHtcbiAgICogICAgIGlmIChlcnIpIHRocm93IGVycjtcbiAgICogICAgIGNvbnNvbGUubG9nKHJlc29sdmVkUGF0aCk7XG4gICAqICAgfSk7XG4gICAqXG4gICAqIEBwYXJhbSBbU3RyaW5nXSBwYXRoXG4gICAqIEBwYXJhbSBbT2JqZWN0P10gY2FjaGUgQW4gb2JqZWN0IGxpdGVyYWwgb2YgbWFwcGVkIHBhdGhzIHRoYXQgY2FuIGJlIHVzZWQgdG9cbiAgICogICBmb3JjZSBhIHNwZWNpZmljIHBhdGggcmVzb2x1dGlvbiBvciBhdm9pZCBhZGRpdGlvbmFsIGBmcy5zdGF0YCBjYWxscyBmb3JcbiAgICogICBrbm93biByZWFsIHBhdGhzLlxuICAgKiBAcGFyYW0gW0Z1bmN0aW9uKEJyb3dzZXJGUy5BcGlFcnJvciwgU3RyaW5nKV0gY2FsbGJhY2tcbiAgICovXG4gIHB1YmxpYyByZWFscGF0aChwYXRoOiBzdHJpbmcsIGNiPzogKGVycjogQXBpRXJyb3IsIHJlc29sdmVkUGF0aD86IHN0cmluZykgPT5hbnkpOiB2b2lkO1xuICBwdWJsaWMgcmVhbHBhdGgocGF0aDogc3RyaW5nLCBjYWNoZToge1twYXRoOiBzdHJpbmddOiBzdHJpbmd9LCBjYjogKGVycjogQXBpRXJyb3IsIHJlc29sdmVkUGF0aD86IHN0cmluZykgPT5hbnkpOiB2b2lkO1xuICBwdWJsaWMgcmVhbHBhdGgocGF0aDogc3RyaW5nLCBhcmcyPzogYW55LCBjYjogKGVycjogQXBpRXJyb3IsIHJlc29sdmVkUGF0aD86IHN0cmluZykgPT4gYW55ID0gbm9wQ2IpOiB2b2lkIHtcbiAgICB2YXIgY2FjaGUgPSB0eXBlb2YgYXJnMiA9PT0gJ29iamVjdCcgPyBhcmcyIDoge307XG4gICAgY2IgPSB0eXBlb2YgYXJnMiA9PT0gJ2Z1bmN0aW9uJyA/IGFyZzIgOiBub3BDYjtcbiAgICB2YXIgbmV3Q2IgPSA8KGVycjogQXBpRXJyb3IsIHJlc29sdmVkUGF0aD86IHN0cmluZykgPT5hbnk+IHdyYXBDYihjYiwgMik7XG4gICAgdHJ5IHtcbiAgICAgIHBhdGggPSBub3JtYWxpemVQYXRoKHBhdGgpO1xuICAgICAgdGhpcy5yb290LnJlYWxwYXRoKHBhdGgsIGNhY2hlLCBuZXdDYik7XG4gICAgfSBjYXRjaCAoZSkge1xuICAgICAgbmV3Q2IoZSk7XG4gICAgfVxuICB9XG5cbiAgLyoqXG4gICAqIFN5bmNocm9ub3VzIGByZWFscGF0aGAuXG4gICAqIEBwYXJhbSBbU3RyaW5nXSBwYXRoXG4gICAqIEBwYXJhbSBbT2JqZWN0P10gY2FjaGUgQW4gb2JqZWN0IGxpdGVyYWwgb2YgbWFwcGVkIHBhdGhzIHRoYXQgY2FuIGJlIHVzZWQgdG9cbiAgICogICBmb3JjZSBhIHNwZWNpZmljIHBhdGggcmVzb2x1dGlvbiBvciBhdm9pZCBhZGRpdGlvbmFsIGBmcy5zdGF0YCBjYWxscyBmb3JcbiAgICogICBrbm93biByZWFsIHBhdGhzLlxuICAgKiBAcmV0dXJuIFtTdHJpbmddXG4gICAqL1xuICBwdWJsaWMgcmVhbHBhdGhTeW5jKHBhdGg6IHN0cmluZywgY2FjaGU6IHtbcGF0aDogc3RyaW5nXTogc3RyaW5nfSA9IHt9KTogc3RyaW5nIHtcbiAgICBwYXRoID0gbm9ybWFsaXplUGF0aChwYXRoKTtcbiAgICByZXR1cm4gdGhpcy5yb290LnJlYWxwYXRoU3luYyhwYXRoLCBjYWNoZSk7XG4gIH1cblxuICBwdWJsaWMgd2F0Y2hGaWxlKGZpbGVuYW1lOiBzdHJpbmcsIGxpc3RlbmVyOiAoY3VycjogU3RhdHMsIHByZXY6IFN0YXRzKSA9PiB2b2lkKTogdm9pZDtcbiAgcHVibGljIHdhdGNoRmlsZShmaWxlbmFtZTogc3RyaW5nLCBvcHRpb25zOiB7IHBlcnNpc3RlbnQ/OiBib29sZWFuOyBpbnRlcnZhbD86IG51bWJlcjsgfSwgbGlzdGVuZXI6IChjdXJyOiBTdGF0cywgcHJldjogU3RhdHMpID0+IHZvaWQpOiB2b2lkO1xuICBwdWJsaWMgd2F0Y2hGaWxlKGZpbGVuYW1lOiBzdHJpbmcsIGFyZzI6IGFueSwgbGlzdGVuZXI6IChjdXJyOiBTdGF0cywgcHJldjogU3RhdHMpID0+IHZvaWQgPSBub3BDYik6IHZvaWQge1xuICAgIHRocm93IG5ldyBBcGlFcnJvcihFcnJvckNvZGUuRU5PVFNVUCk7XG4gIH1cblxuICBwdWJsaWMgdW53YXRjaEZpbGUoZmlsZW5hbWU6IHN0cmluZywgbGlzdGVuZXI6IChjdXJyOiBTdGF0cywgcHJldjogU3RhdHMpID0+IHZvaWQgPSBub3BDYik6IHZvaWQge1xuICAgIHRocm93IG5ldyBBcGlFcnJvcihFcnJvckNvZGUuRU5PVFNVUCk7XG4gIH1cblxuICBwdWJsaWMgd2F0Y2goZmlsZW5hbWU6IHN0cmluZywgbGlzdGVuZXI/OiAoZXZlbnQ6IHN0cmluZywgZmlsZW5hbWU6IHN0cmluZykgPT4gYW55KTogX2ZzLkZTV2F0Y2hlcjtcbiAgcHVibGljIHdhdGNoKGZpbGVuYW1lOiBzdHJpbmcsIG9wdGlvbnM6IHsgcGVyc2lzdGVudD86IGJvb2xlYW47IH0sIGxpc3RlbmVyPzogKGV2ZW50OiBzdHJpbmcsIGZpbGVuYW1lOiBzdHJpbmcpID0+IGFueSk6IF9mcy5GU1dhdGNoZXI7XG4gIHB1YmxpYyB3YXRjaChmaWxlbmFtZTogc3RyaW5nLCBhcmcyOiBhbnksIGxpc3RlbmVyOiAoZXZlbnQ6IHN0cmluZywgZmlsZW5hbWU6IHN0cmluZykgPT4gYW55ID0gbm9wQ2IpOiBfZnMuRlNXYXRjaGVyIHtcbiAgICB0aHJvdyBuZXcgQXBpRXJyb3IoRXJyb3JDb2RlLkVOT1RTVVApO1xuICB9XG5cbiAgcHVibGljIEZfT0s6IG51bWJlciA9IDA7XG4gIHB1YmxpYyBSX09LOiBudW1iZXIgPSA0O1xuICBwdWJsaWMgV19PSzogbnVtYmVyID0gMjtcbiAgcHVibGljIFhfT0s6IG51bWJlciA9IDE7XG5cbiAgcHVibGljIGFjY2VzcyhwYXRoOiBzdHJpbmcsIGNhbGxiYWNrOiAoZXJyOiBBcGlFcnJvcikgPT4gdm9pZCk6IHZvaWQ7XG4gIHB1YmxpYyBhY2Nlc3MocGF0aDogc3RyaW5nLCBtb2RlOiBudW1iZXIsIGNhbGxiYWNrOiAoZXJyOiBBcGlFcnJvcikgPT4gdm9pZCk6IHZvaWQ7XG4gIHB1YmxpYyBhY2Nlc3MocGF0aDogc3RyaW5nLCBhcmcyOiBhbnksIGNiOiAoZTogQXBpRXJyb3IpID0+IHZvaWQgPSBub3BDYik6IHZvaWQge1xuICAgIHRocm93IG5ldyBBcGlFcnJvcihFcnJvckNvZGUuRU5PVFNVUCk7XG4gIH1cblxuICBwdWJsaWMgYWNjZXNzU3luYyhwYXRoOiBzdHJpbmcsIG1vZGU/OiBudW1iZXIpOiB2b2lkIHtcbiAgICB0aHJvdyBuZXcgQXBpRXJyb3IoRXJyb3JDb2RlLkVOT1RTVVApO1xuICB9XG5cbiAgcHVibGljIGNyZWF0ZVJlYWRTdHJlYW0ocGF0aDogc3RyaW5nLCBvcHRpb25zPzoge1xuICAgICAgICBmbGFncz86IHN0cmluZztcbiAgICAgICAgZW5jb2Rpbmc/OiBzdHJpbmc7XG4gICAgICAgIGZkPzogbnVtYmVyO1xuICAgICAgICBtb2RlPzogbnVtYmVyO1xuICAgICAgICBhdXRvQ2xvc2U/OiBib29sZWFuO1xuICAgIH0pOiBfZnMuUmVhZFN0cmVhbSB7XG4gICAgdGhyb3cgbmV3IEFwaUVycm9yKEVycm9yQ29kZS5FTk9UU1VQKTtcbiAgfVxuXG4gIHB1YmxpYyBjcmVhdGVXcml0ZVN0cmVhbShwYXRoOiBzdHJpbmcsIG9wdGlvbnM/OiB7XG4gICAgICAgIGZsYWdzPzogc3RyaW5nO1xuICAgICAgICBlbmNvZGluZz86IHN0cmluZztcbiAgICAgICAgZmQ/OiBudW1iZXI7XG4gICAgICAgIG1vZGU/OiBudW1iZXI7XG4gICAgfSk6IF9mcy5Xcml0ZVN0cmVhbSB7XG4gICAgdGhyb3cgbmV3IEFwaUVycm9yKEVycm9yQ29kZS5FTk9UU1VQKTtcbiAgfVxuXG4gIHB1YmxpYyBfd3JhcENiOiAoY2I6IEZ1bmN0aW9uLCBhcmdzOiBudW1iZXIpID0+IEZ1bmN0aW9uID0gd3JhcENiO1xufVxuXG4vLyBUeXBlIGNoZWNraW5nLlxudmFyIF86IHR5cGVvZiBfZnMgPSBuZXcgRlMoKTtcblxuZXhwb3J0IGludGVyZmFjZSBGU01vZHVsZSBleHRlbmRzIEZTIHtcbiAgLyoqXG4gICAqIFJldHJpZXZlIHRoZSBGUyBvYmplY3QgYmFja2luZyB0aGUgZnMgbW9kdWxlLlxuICAgKi9cbiAgZ2V0RlNNb2R1bGUoKTogRlM7XG4gIC8qKlxuICAgKiBTZXQgdGhlIEZTIG9iamVjdCBiYWNraW5nIHRoZSBmcyBtb2R1bGUuXG4gICAqL1xuICBjaGFuZ2VGU01vZHVsZShuZXdGczogRlMpOiB2b2lkO1xuICAvKipcbiAgICogVGhlIEZTIGNvbnN0cnVjdG9yLlxuICAgKi9cbiAgRlM6IHR5cGVvZiBGUztcbn1cbiJdfQ==