"use strict";
var __extends = (this && this.__extends) || function (d, b) {
    for (var p in b) if (b.hasOwnProperty(p)) d[p] = b[p];
    function __() { this.constructor = d; }
    d.prototype = b === null ? Object.create(b) : (__.prototype = b.prototype, new __());
};
var api_error_1 = require('./api_error');
var file_flag_1 = require('./file_flag');
var path = require('path');
var BaseFileSystem = (function () {
    function BaseFileSystem() {
    }
    BaseFileSystem.prototype.supportsLinks = function () {
        return false;
    };
    BaseFileSystem.prototype.diskSpace = function (p, cb) {
        cb(0, 0);
    };
    BaseFileSystem.prototype.openFile = function (p, flag, cb) {
        throw new api_error_1.ApiError(api_error_1.ErrorCode.ENOTSUP);
    };
    BaseFileSystem.prototype.createFile = function (p, flag, mode, cb) {
        throw new api_error_1.ApiError(api_error_1.ErrorCode.ENOTSUP);
    };
    BaseFileSystem.prototype.open = function (p, flag, mode, cb) {
        var _this = this;
        var must_be_file = function (e, stats) {
            if (e) {
                switch (flag.pathNotExistsAction()) {
                    case file_flag_1.ActionType.CREATE_FILE:
                        return _this.stat(path.dirname(p), false, function (e, parentStats) {
                            if (e) {
                                cb(e);
                            }
                            else if (!parentStats.isDirectory()) {
                                cb(api_error_1.ApiError.ENOTDIR(path.dirname(p)));
                            }
                            else {
                                _this.createFile(p, flag, mode, cb);
                            }
                        });
                    case file_flag_1.ActionType.THROW_EXCEPTION:
                        return cb(api_error_1.ApiError.ENOENT(p));
                    default:
                        return cb(new api_error_1.ApiError(api_error_1.ErrorCode.EINVAL, 'Invalid FileFlag object.'));
                }
            }
            else {
                if (stats.isDirectory()) {
                    return cb(api_error_1.ApiError.EISDIR(p));
                }
                switch (flag.pathExistsAction()) {
                    case file_flag_1.ActionType.THROW_EXCEPTION:
                        return cb(api_error_1.ApiError.EEXIST(p));
                    case file_flag_1.ActionType.TRUNCATE_FILE:
                        return _this.openFile(p, flag, function (e, fd) {
                            if (e) {
                                cb(e);
                            }
                            else {
                                fd.truncate(0, function () {
                                    fd.sync(function () {
                                        cb(null, fd);
                                    });
                                });
                            }
                        });
                    case file_flag_1.ActionType.NOP:
                        return _this.openFile(p, flag, cb);
                    default:
                        return cb(new api_error_1.ApiError(api_error_1.ErrorCode.EINVAL, 'Invalid FileFlag object.'));
                }
            }
        };
        this.stat(p, false, must_be_file);
    };
    BaseFileSystem.prototype.rename = function (oldPath, newPath, cb) {
        cb(new api_error_1.ApiError(api_error_1.ErrorCode.ENOTSUP));
    };
    BaseFileSystem.prototype.renameSync = function (oldPath, newPath) {
        throw new api_error_1.ApiError(api_error_1.ErrorCode.ENOTSUP);
    };
    BaseFileSystem.prototype.stat = function (p, isLstat, cb) {
        cb(new api_error_1.ApiError(api_error_1.ErrorCode.ENOTSUP));
    };
    BaseFileSystem.prototype.statSync = function (p, isLstat) {
        throw new api_error_1.ApiError(api_error_1.ErrorCode.ENOTSUP);
    };
    BaseFileSystem.prototype.openFileSync = function (p, flag) {
        throw new api_error_1.ApiError(api_error_1.ErrorCode.ENOTSUP);
    };
    BaseFileSystem.prototype.createFileSync = function (p, flag, mode) {
        throw new api_error_1.ApiError(api_error_1.ErrorCode.ENOTSUP);
    };
    BaseFileSystem.prototype.openSync = function (p, flag, mode) {
        var stats;
        try {
            stats = this.statSync(p, false);
        }
        catch (e) {
            switch (flag.pathNotExistsAction()) {
                case file_flag_1.ActionType.CREATE_FILE:
                    var parentStats = this.statSync(path.dirname(p), false);
                    if (!parentStats.isDirectory()) {
                        throw api_error_1.ApiError.ENOTDIR(path.dirname(p));
                    }
                    return this.createFileSync(p, flag, mode);
                case file_flag_1.ActionType.THROW_EXCEPTION:
                    throw api_error_1.ApiError.ENOENT(p);
                default:
                    throw new api_error_1.ApiError(api_error_1.ErrorCode.EINVAL, 'Invalid FileFlag object.');
            }
        }
        if (stats.isDirectory()) {
            throw api_error_1.ApiError.EISDIR(p);
        }
        switch (flag.pathExistsAction()) {
            case file_flag_1.ActionType.THROW_EXCEPTION:
                throw api_error_1.ApiError.EEXIST(p);
            case file_flag_1.ActionType.TRUNCATE_FILE:
                this.unlinkSync(p);
                return this.createFileSync(p, flag, stats.mode);
            case file_flag_1.ActionType.NOP:
                return this.openFileSync(p, flag);
            default:
                throw new api_error_1.ApiError(api_error_1.ErrorCode.EINVAL, 'Invalid FileFlag object.');
        }
    };
    BaseFileSystem.prototype.unlink = function (p, cb) {
        cb(new api_error_1.ApiError(api_error_1.ErrorCode.ENOTSUP));
    };
    BaseFileSystem.prototype.unlinkSync = function (p) {
        throw new api_error_1.ApiError(api_error_1.ErrorCode.ENOTSUP);
    };
    BaseFileSystem.prototype.rmdir = function (p, cb) {
        cb(new api_error_1.ApiError(api_error_1.ErrorCode.ENOTSUP));
    };
    BaseFileSystem.prototype.rmdirSync = function (p) {
        throw new api_error_1.ApiError(api_error_1.ErrorCode.ENOTSUP);
    };
    BaseFileSystem.prototype.mkdir = function (p, mode, cb) {
        cb(new api_error_1.ApiError(api_error_1.ErrorCode.ENOTSUP));
    };
    BaseFileSystem.prototype.mkdirSync = function (p, mode) {
        throw new api_error_1.ApiError(api_error_1.ErrorCode.ENOTSUP);
    };
    BaseFileSystem.prototype.readdir = function (p, cb) {
        cb(new api_error_1.ApiError(api_error_1.ErrorCode.ENOTSUP));
    };
    BaseFileSystem.prototype.readdirSync = function (p) {
        throw new api_error_1.ApiError(api_error_1.ErrorCode.ENOTSUP);
    };
    BaseFileSystem.prototype.exists = function (p, cb) {
        this.stat(p, null, function (err) {
            cb(err == null);
        });
    };
    BaseFileSystem.prototype.existsSync = function (p) {
        try {
            this.statSync(p, true);
            return true;
        }
        catch (e) {
            return false;
        }
    };
    BaseFileSystem.prototype.realpath = function (p, cache, cb) {
        if (this.supportsLinks()) {
            var splitPath = p.split(path.sep);
            for (var i = 0; i < splitPath.length; i++) {
                var addPaths = splitPath.slice(0, i + 1);
                splitPath[i] = path.join.apply(null, addPaths);
            }
        }
        else {
            this.exists(p, function (doesExist) {
                if (doesExist) {
                    cb(null, p);
                }
                else {
                    cb(api_error_1.ApiError.ENOENT(p));
                }
            });
        }
    };
    BaseFileSystem.prototype.realpathSync = function (p, cache) {
        if (this.supportsLinks()) {
            var splitPath = p.split(path.sep);
            for (var i = 0; i < splitPath.length; i++) {
                var addPaths = splitPath.slice(0, i + 1);
                splitPath[i] = path.join.apply(null, addPaths);
            }
        }
        else {
            if (this.existsSync(p)) {
                return p;
            }
            else {
                throw api_error_1.ApiError.ENOENT(p);
            }
        }
    };
    BaseFileSystem.prototype.truncate = function (p, len, cb) {
        this.open(p, file_flag_1.FileFlag.getFileFlag('r+'), 0x1a4, (function (er, fd) {
            if (er) {
                return cb(er);
            }
            fd.truncate(len, (function (er) {
                fd.close((function (er2) {
                    cb(er || er2);
                }));
            }));
        }));
    };
    BaseFileSystem.prototype.truncateSync = function (p, len) {
        var fd = this.openSync(p, file_flag_1.FileFlag.getFileFlag('r+'), 0x1a4);
        try {
            fd.truncateSync(len);
        }
        catch (e) {
            throw e;
        }
        finally {
            fd.closeSync();
        }
    };
    BaseFileSystem.prototype.readFile = function (fname, encoding, flag, cb) {
        var oldCb = cb;
        this.open(fname, flag, 0x1a4, function (err, fd) {
            if (err) {
                return cb(err);
            }
            cb = function (err, arg) {
                fd.close(function (err2) {
                    if (err == null) {
                        err = err2;
                    }
                    return oldCb(err, arg);
                });
            };
            fd.stat(function (err, stat) {
                if (err != null) {
                    return cb(err);
                }
                var buf = new Buffer(stat.size);
                fd.read(buf, 0, stat.size, 0, function (err) {
                    if (err != null) {
                        return cb(err);
                    }
                    else if (encoding === null) {
                        return cb(err, buf);
                    }
                    try {
                        cb(null, buf.toString(encoding));
                    }
                    catch (e) {
                        cb(e);
                    }
                });
            });
        });
    };
    BaseFileSystem.prototype.readFileSync = function (fname, encoding, flag) {
        var fd = this.openSync(fname, flag, 0x1a4);
        try {
            var stat = fd.statSync();
            var buf = new Buffer(stat.size);
            fd.readSync(buf, 0, stat.size, 0);
            fd.closeSync();
            if (encoding === null) {
                return buf;
            }
            return buf.toString(encoding);
        }
        finally {
            fd.closeSync();
        }
    };
    BaseFileSystem.prototype.writeFile = function (fname, data, encoding, flag, mode, cb) {
        var oldCb = cb;
        this.open(fname, flag, 0x1a4, function (err, fd) {
            if (err != null) {
                return cb(err);
            }
            cb = function (err) {
                fd.close(function (err2) {
                    oldCb(err != null ? err : err2);
                });
            };
            try {
                if (typeof data === 'string') {
                    data = new Buffer(data, encoding);
                }
            }
            catch (e) {
                return cb(e);
            }
            fd.write(data, 0, data.length, 0, cb);
        });
    };
    BaseFileSystem.prototype.writeFileSync = function (fname, data, encoding, flag, mode) {
        var fd = this.openSync(fname, flag, mode);
        try {
            if (typeof data === 'string') {
                data = new Buffer(data, encoding);
            }
            fd.writeSync(data, 0, data.length, 0);
        }
        finally {
            fd.closeSync();
        }
    };
    BaseFileSystem.prototype.appendFile = function (fname, data, encoding, flag, mode, cb) {
        var oldCb = cb;
        this.open(fname, flag, mode, function (err, fd) {
            if (err != null) {
                return cb(err);
            }
            cb = function (err) {
                fd.close(function (err2) {
                    oldCb(err != null ? err : err2);
                });
            };
            if (typeof data === 'string') {
                data = new Buffer(data, encoding);
            }
            fd.write(data, 0, data.length, null, cb);
        });
    };
    BaseFileSystem.prototype.appendFileSync = function (fname, data, encoding, flag, mode) {
        var fd = this.openSync(fname, flag, mode);
        try {
            if (typeof data === 'string') {
                data = new Buffer(data, encoding);
            }
            fd.writeSync(data, 0, data.length, null);
        }
        finally {
            fd.closeSync();
        }
    };
    BaseFileSystem.prototype.chmod = function (p, isLchmod, mode, cb) {
        cb(new api_error_1.ApiError(api_error_1.ErrorCode.ENOTSUP));
    };
    BaseFileSystem.prototype.chmodSync = function (p, isLchmod, mode) {
        throw new api_error_1.ApiError(api_error_1.ErrorCode.ENOTSUP);
    };
    BaseFileSystem.prototype.chown = function (p, isLchown, uid, gid, cb) {
        cb(new api_error_1.ApiError(api_error_1.ErrorCode.ENOTSUP));
    };
    BaseFileSystem.prototype.chownSync = function (p, isLchown, uid, gid) {
        throw new api_error_1.ApiError(api_error_1.ErrorCode.ENOTSUP);
    };
    BaseFileSystem.prototype.utimes = function (p, atime, mtime, cb) {
        cb(new api_error_1.ApiError(api_error_1.ErrorCode.ENOTSUP));
    };
    BaseFileSystem.prototype.utimesSync = function (p, atime, mtime) {
        throw new api_error_1.ApiError(api_error_1.ErrorCode.ENOTSUP);
    };
    BaseFileSystem.prototype.link = function (srcpath, dstpath, cb) {
        cb(new api_error_1.ApiError(api_error_1.ErrorCode.ENOTSUP));
    };
    BaseFileSystem.prototype.linkSync = function (srcpath, dstpath) {
        throw new api_error_1.ApiError(api_error_1.ErrorCode.ENOTSUP);
    };
    BaseFileSystem.prototype.symlink = function (srcpath, dstpath, type, cb) {
        cb(new api_error_1.ApiError(api_error_1.ErrorCode.ENOTSUP));
    };
    BaseFileSystem.prototype.symlinkSync = function (srcpath, dstpath, type) {
        throw new api_error_1.ApiError(api_error_1.ErrorCode.ENOTSUP);
    };
    BaseFileSystem.prototype.readlink = function (p, cb) {
        cb(new api_error_1.ApiError(api_error_1.ErrorCode.ENOTSUP));
    };
    BaseFileSystem.prototype.readlinkSync = function (p) {
        throw new api_error_1.ApiError(api_error_1.ErrorCode.ENOTSUP);
    };
    return BaseFileSystem;
}());
exports.BaseFileSystem = BaseFileSystem;
var SynchronousFileSystem = (function (_super) {
    __extends(SynchronousFileSystem, _super);
    function SynchronousFileSystem() {
        _super.apply(this, arguments);
    }
    SynchronousFileSystem.prototype.supportsSynch = function () {
        return true;
    };
    SynchronousFileSystem.prototype.rename = function (oldPath, newPath, cb) {
        try {
            this.renameSync(oldPath, newPath);
            cb();
        }
        catch (e) {
            cb(e);
        }
    };
    SynchronousFileSystem.prototype.stat = function (p, isLstat, cb) {
        try {
            cb(null, this.statSync(p, isLstat));
        }
        catch (e) {
            cb(e);
        }
    };
    SynchronousFileSystem.prototype.open = function (p, flags, mode, cb) {
        try {
            cb(null, this.openSync(p, flags, mode));
        }
        catch (e) {
            cb(e);
        }
    };
    SynchronousFileSystem.prototype.unlink = function (p, cb) {
        try {
            this.unlinkSync(p);
            cb();
        }
        catch (e) {
            cb(e);
        }
    };
    SynchronousFileSystem.prototype.rmdir = function (p, cb) {
        try {
            this.rmdirSync(p);
            cb();
        }
        catch (e) {
            cb(e);
        }
    };
    SynchronousFileSystem.prototype.mkdir = function (p, mode, cb) {
        try {
            this.mkdirSync(p, mode);
            cb();
        }
        catch (e) {
            cb(e);
        }
    };
    SynchronousFileSystem.prototype.readdir = function (p, cb) {
        try {
            cb(null, this.readdirSync(p));
        }
        catch (e) {
            cb(e);
        }
    };
    SynchronousFileSystem.prototype.chmod = function (p, isLchmod, mode, cb) {
        try {
            this.chmodSync(p, isLchmod, mode);
            cb();
        }
        catch (e) {
            cb(e);
        }
    };
    SynchronousFileSystem.prototype.chown = function (p, isLchown, uid, gid, cb) {
        try {
            this.chownSync(p, isLchown, uid, gid);
            cb();
        }
        catch (e) {
            cb(e);
        }
    };
    SynchronousFileSystem.prototype.utimes = function (p, atime, mtime, cb) {
        try {
            this.utimesSync(p, atime, mtime);
            cb();
        }
        catch (e) {
            cb(e);
        }
    };
    SynchronousFileSystem.prototype.link = function (srcpath, dstpath, cb) {
        try {
            this.linkSync(srcpath, dstpath);
            cb();
        }
        catch (e) {
            cb(e);
        }
    };
    SynchronousFileSystem.prototype.symlink = function (srcpath, dstpath, type, cb) {
        try {
            this.symlinkSync(srcpath, dstpath, type);
            cb();
        }
        catch (e) {
            cb(e);
        }
    };
    SynchronousFileSystem.prototype.readlink = function (p, cb) {
        try {
            cb(null, this.readlinkSync(p));
        }
        catch (e) {
            cb(e);
        }
    };
    return SynchronousFileSystem;
}(BaseFileSystem));
exports.SynchronousFileSystem = SynchronousFileSystem;
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiZmlsZV9zeXN0ZW0uanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyIuLi8uLi8uLi9zcmMvY29yZS9maWxlX3N5c3RlbS50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiOzs7Ozs7QUFBQSwwQkFBa0MsYUFBYSxDQUFDLENBQUE7QUFHaEQsMEJBQW1DLGFBQWEsQ0FBQyxDQUFBO0FBQ2pELElBQU8sSUFBSSxXQUFXLE1BQU0sQ0FBQyxDQUFDO0FBcWU5QjtJQUFBO0lBb1pBLENBQUM7SUFuWlEsc0NBQWEsR0FBcEI7UUFDRSxNQUFNLENBQUMsS0FBSyxDQUFDO0lBQ2YsQ0FBQztJQUNNLGtDQUFTLEdBQWhCLFVBQWlCLENBQVMsRUFBRSxFQUF3QztRQUNsRSxFQUFFLENBQUMsQ0FBQyxFQUFFLENBQUMsQ0FBQyxDQUFDO0lBQ1gsQ0FBQztJQU1NLGlDQUFRLEdBQWYsVUFBZ0IsQ0FBUyxFQUFFLElBQWMsRUFBRSxFQUEyQztRQUNwRixNQUFNLElBQUksb0JBQVEsQ0FBQyxxQkFBUyxDQUFDLE9BQU8sQ0FBQyxDQUFDO0lBQ3hDLENBQUM7SUFLTSxtQ0FBVSxHQUFqQixVQUFrQixDQUFTLEVBQUUsSUFBYyxFQUFFLElBQVksRUFBRSxFQUEyQztRQUNwRyxNQUFNLElBQUksb0JBQVEsQ0FBQyxxQkFBUyxDQUFDLE9BQU8sQ0FBQyxDQUFDO0lBQ3hDLENBQUM7SUFDTSw2QkFBSSxHQUFYLFVBQVksQ0FBUyxFQUFFLElBQWEsRUFBRSxJQUFZLEVBQUUsRUFBOEM7UUFBbEcsaUJBcURDO1FBcERDLElBQUksWUFBWSxHQUFHLFVBQUMsQ0FBVyxFQUFFLEtBQWE7WUFDNUMsRUFBRSxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQztnQkFFTixNQUFNLENBQUMsQ0FBQyxJQUFJLENBQUMsbUJBQW1CLEVBQUUsQ0FBQyxDQUFDLENBQUM7b0JBQ25DLEtBQUssc0JBQVUsQ0FBQyxXQUFXO3dCQUV6QixNQUFNLENBQUMsS0FBSSxDQUFDLElBQUksQ0FBQyxJQUFJ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QVk7UUFDeEQsSUFBSSxDQUFDO1lBQ0gsSUFBSSxDQUFDLFFBQVEsQ0FBQyxPQUFPLEVBQUUsT0FBTyxDQUFDLENBQUM7WUFDaEMsRUFBRSxFQUFFLENBQUM7UUFDUCxDQUFFO1FBQUEsS0FBSyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQztZQUNYLEVBQUUsQ0FBQyxDQUFDLENBQUMsQ0FBQztRQUNSLENBQUM7SUFDSCxDQUFDO0lBRU0sdUNBQU8sR0FBZCxVQUFlLE9BQWUsRUFBRSxPQUFlLEVBQUUsSUFBWSxFQUFFLEVBQVk7UUFDekUsSUFBSSxDQUFDO1lBQ0gsSUFBSSxDQUFDLFdBQVcsQ0FBQyxPQUFPLEVBQUUsT0FBTyxFQUFFLElBQUksQ0FBQyxDQUFDO1lBQ3pDLEVBQUUsRUFBRSxDQUFDO1FBQ1AsQ0FBRTtRQUFBLEtBQUssQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUM7WUFDWCxFQUFFLENBQUMsQ0FBQyxDQUFDLENBQUM7UUFDUixDQUFDO0lBQ0gsQ0FBQztJQUVNLHdDQUFRLEdBQWYsVUFBZ0IsQ0FBUyxFQUFFLEVBQVk7UUFDckMsSUFBSSxDQUFDO1lBQ0gsRUFBRSxDQUFDLElBQUksRUFBRSxJQUFJLENBQUMsWUFBWSxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUM7UUFDakMsQ0FBRTtRQUFBLEtBQUssQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUM7WUFDWCxFQUFFLENBQUMsQ0FBQyxDQUFDLENBQUM7UUFDUixDQUFDO0lBQ0gsQ0FBQztJQUNILDRCQUFDO0FBQUQsQ0FBQyxBQXJIRCxDQUEyQyxjQUFjLEdBcUh4RDtBQXJIWSw2QkFBcUIsd0JBcUhqQyxDQUFBIiwic291cmNlc0NvbnRlbnQiOlsiaW1wb3J0IHtBcGlFcnJvciwgRXJyb3JDb2RlfSBmcm9tICcuL2FwaV9lcnJvcic7XG5pbXBvcnQgU3RhdHMgZnJvbSAnLi9ub2RlX2ZzX3N0YXRzJztcbmltcG9ydCBmaWxlID0gcmVxdWlyZSgnLi9maWxlJyk7XG5pbXBvcnQge0ZpbGVGbGFnLCBBY3Rpb25UeXBlfSBmcm9tICcuL2ZpbGVfZmxhZyc7XG5pbXBvcnQgcGF0aCA9IHJlcXVpcmUoJ3BhdGgnKTtcblxuLyoqXG4gKiBJbnRlcmZhY2UgZm9yIGEgZmlsZXN5c3RlbS4gKipBbGwqKiBCcm93c2VyRlMgRmlsZVN5c3RlbXMgc2hvdWxkIGltcGxlbWVudFxuICogdGhpcyBpbnRlcmZhY2UuXG4gKlxuICogQmVsb3csIHdlIGRlbm90ZSBlYWNoIEFQSSBtZXRob2QgYXMgKipDb3JlKiosICoqU3VwcGxlbWVudGFsKiosIG9yXG4gKiAqKk9wdGlvbmFsKiouXG4gKlxuICogIyMjIENvcmUgTWV0aG9kc1xuICpcbiAqICoqQ29yZSoqIEFQSSBtZXRob2RzICpuZWVkKiB0byBiZSBpbXBsZW1lbnRlZCBmb3IgYmFzaWMgcmVhZC93cml0ZVxuICogZnVuY3Rpb25hbGl0eS5cbiAqXG4gKiBOb3RlIHRoYXQgcmVhZC1vbmx5IEZpbGVTeXN0ZW1zIGNhbiBjaG9vc2UgdG8gbm90IGltcGxlbWVudCBjb3JlIG1ldGhvZHNcbiAqIHRoYXQgbXV0YXRlIGZpbGVzIG9yIG1ldGFkYXRhLiBUaGUgZGVmYXVsdCBpbXBsZW1lbnRhdGlvbiB3aWxsIHBhc3MgYVxuICogTk9UX1NVUFBPUlRFRCBlcnJvciB0byB0aGUgY2FsbGJhY2suXG4gKlxuICogIyMjIFN1cHBsZW1lbnRhbCBNZXRob2RzXG4gKlxuICogKipTdXBwbGVtZW50YWwqKiBBUEkgbWV0aG9kcyBkbyBub3QgbmVlZCB0byBiZSBpbXBsZW1lbnRlZCBieSBhIGZpbGVzeXN0ZW0uXG4gKiBUaGUgZGVmYXVsdCBpbXBsZW1lbnRhdGlvbiBpbXBsZW1lbnRzIGFsbCBvZiB0aGUgc3VwcGxlbWVudGFsIEFQSSBtZXRob2RzIGluXG4gKiB0ZXJtcyBvZiB0aGUgKipjb3JlKiogQVBJIG1ldGhvZHMuXG4gKlxuICogTm90ZSB0aGF0IGEgZmlsZSBzeXN0ZW0gbWF5IGNob29zZSB0byBpbXBsZW1lbnQgc3VwcGxlbWVudGFsIG1ldGhvZHMgZm9yXG4gKiBlZmZpY2llbmN5IHJlYXNvbnMuXG4gKlxuICogVGhlIGNvZGUgZm9yIHNvbWUgc3VwcGxlbWVudGFsIG1ldGhvZHMgd2FzIGFkYXB0ZWQgZGlyZWN0bHkgZnJvbSBOb2RlSlMnc1xuICogZnMuanMgc291cmNlIGNvZGUuXG4gKlxuICogIyMjIE9wdGlvbmFsIE1ldGhvZHNcbiAqXG4gKiAqKk9wdGlvbmFsKiogQVBJIG1ldGhvZHMgcHJvdmlkZSBmdW5jdGlvbmFsaXR5IHRoYXQgbWF5IG5vdCBiZSBhdmFpbGFibGUgaW5cbiAqIGFsbCBmaWxlc3lzdGVtcy4gRm9yIGV4YW1wbGUsIGFsbCBzeW1saW5rL2hhcmRsaW5rLXJlbGF0ZWQgQVBJIG1ldGhvZHMgZmFsbFxuICogdW5kZXIgdGhpcyBjYXRlZ29yeS5cbiAqXG4gKiBUaGUgZGVmYXVsdCBpbXBsZW1lbnRhdGlvbiB3aWxsIHBhc3MgYSBOT1RfU1VQUE9SVEVEIGVycm9yIHRvIHRoZSBjYWxsYmFjay5cbiAqXG4gKiAjIyMgQXJndW1lbnQgQXNzdW1wdGlvbnNcbiAqXG4gKiBZb3UgY2FuIGFzc3VtZSB0aGUgZm9sbG93aW5nIGFib3V0IGFyZ3VtZW50cyBwYXNzZWQgdG8gZWFjaCBBUEkgbWV0aG9kOlxuICpcbiAqICogKipFdmVyeSBwYXRoIGlzIGFuIGFic29sdXRlIHBhdGguKiogTWVhbmluZywgYC5gLCBgLi5gLCBhbmQgb3RoZXIgaXRlbXNcbiAqICAgYXJlIHJlc29sdmVkIGludG8gYW4gYWJzb2x1dGUgZm9ybS5cbiAqICogKipBbGwgYXJndW1lbnRzIGFyZSBwcmVzZW50LioqIEFueSBvcHRpb25hbCBhcmd1bWVudHMgYXQgdGhlIE5vZGUgQVBJIGxldmVsXG4gKiAgIGhhdmUgYmVlbiBwYXNzZWQgaW4gd2l0aCB0aGVpciBkZWZhdWx0IHZhbHVlcy5cbiAqICogKipUaGUgY2FsbGJhY2sgd2lsbCByZXNldCB0aGUgc3RhY2sgZGVwdGguKiogV2hlbiB5b3VyIGZpbGVzeXN0ZW0gY2FsbHMgdGhlXG4gKiAgIGNhbGxiYWNrIHdpdGggdGhlIHJlcXVlc3RlZCBpbmZvcm1hdGlvbiwgaXQgd2lsbCB1c2UgYHNldEltbWVkaWF0ZWAgdG9cbiAqICAgcmVzZXQgdGhlIEphdmFTY3JpcHQgc3RhY2sgZGVwdGggYmVmb3JlIGNhbGxpbmcgdGhlIHVzZXItc3VwcGxpZWQgY2FsbGJhY2suXG4gKiBAY2xhc3MgRmlsZVN5c3RlbVxuICovXG5leHBvcnQgaW50ZXJmYWNlIEZpbGVTeXN0ZW0ge1xuICAvKipcbiAgICogKipPcHRpb25hbCoqOiBSZXR1cm5zIHRoZSBuYW1lIG9mIHRoZSBmaWxlIHN5c3RlbS5cbiAgICogQG1ldGhvZCBGaWxlU3lzdGVtI2dldE5hbWVcbiAgICogQHJldHVybiB7c3RyaW5nfVxuICAgKi9cbiAgZ2V0TmFtZSgpOiBzdHJpbmc7XG4gIC8qKlxuICAgKiAqKk9wdGlvbmFsKio6IFBhc3NlcyB0aGUgZm9sbG93aW5nIGluZm9ybWF0aW9uIHRvIHRoZSBjYWxsYmFjazpcbiAgICpcbiAgICogKiBUb3RhbCBudW1iZXIgb2YgYnl0ZXMgYXZhaWxhYmxlIG9uIHRoaXMgZmlsZSBzeXN0ZW0uXG4gICAqICogbnVtYmVyIG9mIGZyZWUgYnl0ZXMgYXZhaWxhYmxlIG9uIHRoaXMgZmlsZSBzeXN0ZW0uXG4gICAqXG4gICAqIEBtZXRob2QgRmlsZVN5c3RlbSNkaXNrU3BhY2VcbiAgICogQHRvZG8gVGhpcyBpbmZvIGlzIG5vdCBhdmFpbGFibGUgdGhyb3VnaCB0aGUgTm9kZSBBUEkuIFBlcmhhcHMgd2UgY291bGQgZG8gYVxuICAgKiAgIHBvbHlmaWxsIG9mIGRpc2tzcGFjZS5qcywgb3IgYWRkIGEgbmV3IE5vZGUgQVBJIGZ1bmN0aW9uLlxuICAgKiBAcGFyYW0ge3N0cmluZ30gcGF0aCBUaGUgcGF0aCB0byB0aGUgbG9jYXRpb24gdGhhdCBpcyBiZWluZyBxdWVyaWVkLiBPbmx5XG4gICAqICAgdXNlZnVsIGZvciBmaWxlc3lzdGVtcyB0aGF0IHN1cHBvcnQgbW91bnQgcG9pbnRzLlxuICAgKiBAcGFyYW0ge0ZpbGVTeXN0ZW1+ZGlza1NwYWNlQ2FsbGJhY2t9IGNiXG4gICAqL1xuICBkaXNrU3BhY2UocDogc3RyaW5nLCBjYjogKHRvdGFsOiBudW1iZXIsIGZyZWU6IG51bWJlcikgPT4gYW55KTogdm9pZDtcbiAgLyoqXG4gICAqICoqQ29yZSoqOiBJcyB0aGlzIGZpbGVzeXN0ZW0gcmVhZC1vbmx5P1xuICAgKiBAbWV0aG9kIEZpbGVTeXN0ZW0jaXNSZWFkT25seVxuICAgKiBAcmV0dXJuIHtib29sZWFufSBUcnVlIGlmIHRoaXMgRmlsZVN5c3RlbSBpcyBpbmhlcmVudGx5IHJlYWQtb25seS5cbiAgICovXG4gIGlzUmVhZE9ubHkoKTogYm9vbGVhbjtcbiAgLyoqXG4gICAqICoqQ29yZSoqOiBEb2VzIHRoZSBmaWxlc3lzdGVtIHN1cHBvcnQgb3B0aW9uYWwgc3ltbGluay9oYXJkbGluay1yZWxhdGVkXG4gICAqICAgY29tbWFuZHM/XG4gICAqIEBtZXRob2QgRmlsZVN5c3RlbSNzdXBwb3J0c0xpbmtzXG4gICAqIEByZXR1cm4ge2Jvb2xlYW59IFRydWUgaWYgdGhlIEZpbGVTeXN0ZW0gc3VwcG9ydHMgdGhlIG9wdGlvbmFsXG4gICAqICAgc3ltbGluay9oYXJkbGluay1yZWxhdGVkIGNvbW1hbmRzLlxuICAgKi9cbiAgc3VwcG9ydHNMaW5rcygpOiBib29sZWFuO1xuICAvKipcbiAgICogKipDb3JlKio6IERvZXMgdGhlIGZpbGVzeXN0ZW0gc3VwcG9ydCBvcHRpb25hbCBwcm9wZXJ0eS1yZWxhdGVkIGNvbW1hbmRzP1xuICAgKiBAbWV0aG9kIEZpbGVTeXN0ZW0jc3VwcG9ydHNQcm9wc1xuICAgKiBAcmV0dXJuIHtib29sZWFufSBUcnVlIGlmIHRoZSBGaWxlU3lzdGVtIHN1cHBvcnRzIHRoZSBvcHRpb25hbFxuICAgKiAgIHByb3BlcnR5LXJlbGF0ZWQgY29tbWFuZHMgKHBlcm1pc3Npb25zLCB1dGltZXMsIGV0YykuXG4gICAqL1xuICBzdXBwb3J0c1Byb3BzKCk6IGJvb2xlYW47XG4gIC8qKlxuICAgKiAqKkNvcmUqKjogRG9lcyB0aGUgZmlsZXN5c3RlbSBzdXBwb3J0IHRoZSBvcHRpb25hbCBzeW5jaHJvbm91cyBpbnRlcmZhY2U/XG4gICAqIEBtZXRob2QgRmlsZVN5c3RlbSNzdXBwb3J0c1N5bmNoXG4gICAqIEByZXR1cm4ge2Jvb2xlYW59IFRydWUgaWYgdGhlIEZpbGVTeXN0ZW0gc3VwcG9ydHMgc3luY2hyb25vdXMgb3BlcmF0aW9ucy5cbiAgICovXG4gIHN1cHBvcnRzU3luY2goKTogYm9vbGVhbjtcbiAgLy8gKipDT1JFIEFQSSBNRVRIT0RTKipcbiAgLy8gRmlsZSBvciBkaXJlY3Rvcnkgb3BlcmF0aW9uc1xuICAvKipcbiAgICogKipDb3JlKio6IEFzeW5jaHJvbm91cyByZW5hbWUuIE5vIGFyZ3VtZW50cyBvdGhlciB0aGFuIGEgcG9zc2libGUgZXhjZXB0aW9uXG4gICAqIGFyZSBnaXZlbiB0byB0aGUgY29tcGxldGlvbiBjYWxsYmFjay5cbiAgICogQG1ldGhvZCBGaWxlU3lzdGVtI3JlbmFtZVxuICAgKiBAcGFyYW0ge3N0cmluZ30gb2xkUGF0aFxuICAgKiBAcGFyYW0ge3N0cmluZ30gbmV3UGF0aFxuICAgKiBAcGFyYW0ge0ZpbGVTeXN0ZW1+bm9kZUNhbGxiYWNrfSBjYlxuICAgKi9cbiAgcmVuYW1lKG9sZFBhdGg6IHN0cmluZywgbmV3UGF0aDogc3RyaW5nLCBjYjogKGVycj86IEFwaUVycm9yKSA9PiB2b2lkKTogdm9pZDtcbiAgLyoqXG4gICAqICoqQ29yZSoqOiBTeW5jaHJvbm91cyByZW5hbWUuXG4gICAqIEBtZXRob2QgRmlsZVN5c3RlbSNyZW5hbWVTeW5jXG4gICAqIEBwYXJhbSB7c3RyaW5nfSBvbGRQYXRoXG4gICAqIEBwYXJhbSB7c3RyaW5nfSBuZXdQYXRoXG4gICAqL1xuICByZW5hbWVTeW5jKG9sZFBhdGg6IHN0cmluZywgbmV3UGF0aDogc3RyaW5nKTogdm9pZDtcbiAgLyoqXG4gICAqICoqQ29yZSoqOiBBc3luY2hyb25vdXMgYHN0YXRgIG9yIGBsc3RhdGAuXG4gICAqIEBtZXRob2QgRmlsZVN5c3RlbSNzdGF0XG4gICAqIEBwYXJhbSB7c3RyaW5nfSBwYXRoXG4gICAqIEBwYXJhbSB7Ym9vbGVhbn0gaXNMc3RhdCBUcnVlIGlmIHRoaXMgaXMgYGxzdGF0YCwgZmFsc2UgaWYgdGhpcyBpcyByZWd1bGFyXG4gICAqICAgYHN0YXRgLlxuICAgKiBAcGFyYW0ge0ZpbGVTeXN0ZW1+bm9kZVN0YXRzQ2FsbGJhY2t9IGNiXG4gICAqL1xuICBzdGF0KHA6IHN0cmluZywgaXNMc3RhdDogYm9vbGVhbiwgY2I6IChlcnI6IEFwaUVycm9yLCBzdGF0PzogU3RhdHMpID0+IHZvaWQpOiB2b2lkO1xuICAvKipcbiAgICogKipDb3JlKio6IFN5bmNocm9ub3VzIGBzdGF0YCBvciBgbHN0YXRgLlxuICAgKiBAbWV0aG9kIEZpbGVTeXN0ZW0jc3RhdFN5bmNcbiAgICogQHBhcmFtIHtzdHJpbmd9IHBhdGhcbiAgICogQHBhcmFtIHtib29sZWFufSBpc0xzdGF0IFRydWUgaWYgdGhpcyBpcyBgbHN0YXRgLCBmYWxzZSBpZiB0aGlzIGlzIHJlZ3VsYXJcbiAgICogICBgc3RhdGAuXG4gICAqIEByZXR1cm4ge0Jyb3dzZXJGUy5ub2RlLmZzLlN0YXRzfVxuICAgKi9cbiAgc3RhdFN5bmMocDogc3RyaW5nLCBpc0xzdGF0OiBib29sZWFuKTogU3RhdHM7XG4gIC8vIEZpbGUgb3BlcmF0aW9uc1xuICAvKipcbiAgICogKipDb3JlKio6IEFzeW5jaHJvbm91cyBmaWxlIG9wZW4uXG4gICAqIEBzZWUgaHR0cDovL3d3dy5tYW5wYWdlei5jb20vbWFuLzIvb3Blbi9cbiAgICogQG1ldGhvZCBGaWxlU3lzdGVtI29wZW5cbiAgICogQHBhcmFtIHtzdHJpbmd9IHBhdGhcbiAgICogQHBhcmFtIHtCcm93c2VyRlMuRmlsZU1vZGV9IGZsYWdzIEhhbmRsZXMgdGhlIGNvbXBsZXhpdHkgb2YgdGhlIHZhcmlvdXMgZmlsZVxuICAgKiAgIG1vZGVzLiBTZWUgaXRzIEFQSSBmb3IgbW9yZSBkZXRhaWxzLlxuICAgKiBAcGFyYW0ge251bWJlcn0gbW9kZSBNb2RlIHRvIHVzZSB0byBvcGVuIHRoZSBmaWxlLiBDYW4gYmUgaWdub3JlZCBpZiB0aGVcbiAgICogICBmaWxlc3lzdGVtIGRvZXNuJ3Qgc3VwcG9ydCBwZXJtaXNzaW9ucy5cbiAgICogQHBhcmFtIHtGaWxlU3lzdGVtfmZpbGVDYWxsYmFja30gY2JcbiAgICovXG4gIG9wZW4ocDogc3RyaW5nLCBmbGFnOkZpbGVGbGFnLCBtb2RlOiBudW1iZXIsIGNiOiAoZXJyOiBBcGlFcnJvciwgZmQ/OiBmaWxlLkZpbGUpID0+IGFueSk6IHZvaWQ7XG4gIC8qKlxuICAgKiAqKkNvcmUqKjogU3luY2hyb25vdXMgZmlsZSBvcGVuLlxuICAgKiBAc2VlIGh0dHA6Ly93d3cubWFucGFnZXouY29tL21hbi8yL29wZW4vXG4gICAqIEBtZXRob2QgRmlsZVN5c3RlbSNvcGVuU3luY1xuICAgKiBAcGFyYW0ge3N0cmluZ30gcGF0aFxuICAgKiBAcGFyYW0ge0Jyb3dzZXJGUy5GaWxlTW9kZX0gZmxhZ3MgSGFuZGxlcyB0aGUgY29tcGxleGl0eSBvZiB0aGUgdmFyaW91cyBmaWxlXG4gICAqICAgbW9kZXMuIFNlZSBpdHMgQVBJIGZvciBtb3JlIGRldGFpbHMuXG4gICAqIEBwYXJhbSB7bnVtYmVyfSBtb2RlIE1vZGUgdG8gdXNlIHRvIG9wZW4gdGhlIGZpbGUuIENhbiBiZSBpZ25vcmVkIGlmIHRoZVxuICAgKiAgIGZpbGVzeXN0ZW0gZG9lc24ndCBzdXBwb3J0IHBlcm1pc3Npb25zLlxuICAgKiBAcmV0dXJuIHtCcm93c2VyRlMuRmlsZX1cbiAgICovXG4gIG9wZW5TeW5jKHA6IHN0cmluZywgZmxhZzogRmlsZUZsYWcsIG1vZGU6IG51bWJlcik6IGZpbGUuRmlsZTtcbiAgLyoqXG4gICAqICoqQ29yZSoqOiBBc3luY2hyb25vdXMgYHVubGlua2AuXG4gICAqIEBtZXRob2QgRmlsZVN5c3RlbSN1bmxpbmtcbiAgICogQHBhcmFtIFtzdHJpbmddIHBhdGhcbiAgICogQHBhcmFtIFtGaWxlU3lzdGVtfm5vZGVDYWxsYmFja10gY2JcbiAgICovXG4gIHVubGluayhwOiBzdHJpbmcsIGNiOiBGdW5jdGlvbik6IHZvaWQ7XG4gIC8qKlxuICAgKiAqKkNvcmUqKjogU3luY2hyb25vdXMgYHVubGlua2AuXG4gICAqIEBtZXRob2QgRmlsZVN5c3RlbSN1bmxpbmtTeW5jXG4gICAqIEBwYXJhbSB7c3RyaW5nfSBwYXRoXG4gICAqL1xuICB1bmxpbmtTeW5jKHA6IHN0cmluZyk6IHZvaWQ7XG4gIC8vIERpcmVjdG9yeSBvcGVyYXRpb25zXG4gIC8qKlxuICAgKiAqKkNvcmUqKjogQXN5bmNocm9ub3VzIGBybWRpcmAuXG4gICAqIEBtZXRob2QgRmlsZVN5c3RlbSNybWRpclxuICAgKiBAcGFyYW0ge3N0cmluZ30gcGF0aFxuICAgKiBAcGFyYW0ge0ZpbGVTeXN0ZW1+bm9kZUNhbGxiYWNrfSBjYlxuICAgKi9cbiAgcm1kaXIocDogc3RyaW5nLCBjYjogRnVuY3Rpb24pOiB2b2lkO1xuICAvKipcbiAgICogKipDb3JlKio6IFN5bmNocm9ub3VzIGBybWRpcmAuXG4gICAqIEBtZXRob2QgRmlsZVN5c3RlbSNybWRpclN5bmNcbiAgICogQHBhcmFtIHtzdHJpbmd9IHBhdGhcbiAgICovXG4gIHJtZGlyU3luYyhwOiBzdHJpbmcpOiB2b2lkO1xuICAvKipcbiAgICogKipDb3JlKio6IEFzeW5jaHJvbm91cyBgbWtkaXJgLlxuICAgKiBAbWV0aG9kIEZpbGVTeXN0ZW0jbWtkaXJcbiAgICogQHBhcmFtIHtzdHJpbmd9IHBhdGhcbiAgICogQHBhcmFtIHtudW1iZXI/fSBtb2RlIE1vZGUgdG8gbWFrZSB0aGUgZGlyZWN0b3J5IHVzaW5nLiBDYW4gYmUgaWdub3JlZCBpZlxuICAgKiAgIHRoZSBmaWxlc3lzdGVtIGRvZXNuJ3Qgc3VwcG9ydCBwZXJtaXNzaW9ucy5cbiAgICogQHBhcmFtIHtGaWxlU3lzdGVtfm5vZGVDYWxsYmFja30gY2JcbiAgICovXG4gIG1rZGlyKHA6IHN0cmluZywgbW9kZTogbnVtYmVyLCBjYjogRnVuY3Rpb24pOiB2b2lkO1xuICAvKipcbiAgICogKipDb3JlKio6IFN5bmNocm9ub3VzIGBta2RpcmAuXG4gICAqIEBtZXRob2QgRmlsZVN5c3RlbSNta2RpclN5bmNcbiAgICogQHBhcmFtIHtzdHJpbmd9IHBhdGhcbiAgICogQHBhcmFtIHtudW1iZXJ9IG1vZGUgTW9kZSB0byBtYWtlIHRoZSBkaXJlY3RvcnkgdXNpbmcuIENhbiBiZSBpZ25vcmVkIGlmXG4gICAqICAgdGhlIGZpbGVzeXN0ZW0gZG9lc24ndCBzdXBwb3J0IHBlcm1pc3Npb25zLlxuICAgKi9cbiAgbWtkaXJTeW5jKHA6IHN0cmluZywgbW9kZTogbnVtYmVyKTogdm9pZDtcbiAgLyoqXG4gICAqICoqQ29yZSoqOiBBc3luY2hyb25vdXMgYHJlYWRkaXJgLiBSZWFkcyB0aGUgY29udGVudHMgb2YgYSBkaXJlY3RvcnkuXG4gICAqXG4gICAqIFRoZSBjYWxsYmFjayBnZXRzIHR3byBhcmd1bWVudHMgYChlcnIsIGZpbGVzKWAgd2hlcmUgYGZpbGVzYCBpcyBhbiBhcnJheSBvZlxuICAgKiB0aGUgbmFtZXMgb2YgdGhlIGZpbGVzIGluIHRoZSBkaXJlY3RvcnkgZXhjbHVkaW5nIGAnLidgIGFuZCBgJy4uJ2AuXG4gICAqIEBtZXRob2QgRmlsZVN5c3RlbSNyZWFkZGlyXG4gICAqIEBwYXJhbSB7c3RyaW5nfSBwYXRoXG4gICAqIEBwYXJhbSB7RmlsZVN5c3RlbX5yZWFkZGlyQ2FsbGJhY2t9IGNiXG4gICAqL1xuICByZWFkZGlyKHA6IHN0cmluZywgY2I6IChlcnI6IEFwaUVycm9yLCBmaWxlcz86IHN0cmluZ1tdKSA9PiB2b2lkKTogdm9pZDtcbiAgLyoqXG4gICAqICoqQ29yZSoqOiBTeW5jaHJvbm91cyBgcmVhZGRpcmAuIFJlYWRzIHRoZSBjb250ZW50cyBvZiBhIGRpcmVjdG9yeS5cbiAgICogQG1ldGhvZCBGaWxlU3lzdGVtI3JlYWRkaXJTeW5jXG4gICAqIEBwYXJhbSB7c3RyaW5nfSBwYXRoXG4gICAqIEByZXR1cm4ge3N0cmluZ1tdfVxuICAgKi9cbiAgcmVhZGRpclN5bmMocDogc3RyaW5nKTogc3RyaW5nW107XG4gIC8vICoqU1VQUExFTUVOVEFMIElOVEVSRkFDRSBNRVRIT0RTKipcbiAgLy8gRmlsZSBvciBkaXJlY3Rvcnkgb3BlcmF0aW9uc1xuICAvKipcbiAgICogKipTdXBwbGVtZW50YWwqKjogVGVzdCB3aGV0aGVyIG9yIG5vdCB0aGUgZ2l2ZW4gcGF0aCBleGlzdHMgYnkgY2hlY2tpbmcgd2l0aFxuICAgKiB0aGUgZmlsZSBzeXN0ZW0uIFRoZW4gY2FsbCB0aGUgY2FsbGJhY2sgYXJndW1lbnQgd2l0aCBlaXRoZXIgdHJ1ZSBvciBmYWxzZS5cbiAgICogQG1ldGhvZCBGaWxlU3lzdGVtI2V4aXN0c1xuICAgKiBAcGFyYW0ge3N0cmluZ30gcGF0aFxuICAgKiBAcGFyYW0ge0ZpbGVTeXN0ZW1+ZXhpc3RzQ2FsbGJhY2t9IGNiXG4gICAqL1xuICBleGlzdHMocDogc3RyaW5nLCBjYjogKGV4aXN0czogYm9vbGVhbikgPT4gdm9pZCk6IHZvaWQ7XG4gIC8qKlxuICAgKiAqKlN1cHBsZW1lbnRhbCoqOiBUZXN0IHdoZXRoZXIgb3Igbm90IHRoZSBnaXZlbiBwYXRoIGV4aXN0cyBieSBjaGVja2luZyB3aXRoXG4gICAqIHRoZSBmaWxlIHN5c3RlbS5cbiAgICogQG1ldGhvZCBGaWxlU3lzdGVtI2V4aXN0c1N5bmNcbiAgICogQHBhcmFtIHtzdHJpbmd9IHBhdGhcbiAgICogQHJldHVybiB7Ym9vbGVhbn1cbiAgICovXG4gIGV4aXN0c1N5bmMocDogc3RyaW5nKTogYm9vbGVhbjtcbiAgLyoqXG4gICAqICoqU3VwcGxlbWVudGFsKio6IEFzeW5jaHJvbm91cyBgcmVhbHBhdGhgLiBUaGUgY2FsbGJhY2sgZ2V0cyB0d28gYXJndW1lbnRzXG4gICAqIGAoZXJyLCByZXNvbHZlZFBhdGgpYC5cbiAgICpcbiAgICogTm90ZSB0aGF0IHRoZSBOb2RlIEFQSSB3aWxsIHJlc29sdmUgYHBhdGhgIHRvIGFuIGFic29sdXRlIHBhdGguXG4gICAqIEBtZXRob2QgRmlsZVN5c3RlbSNyZWFscGF0aFxuICAgKiBAcGFyYW0ge3N0cmluZ30gcGF0aFxuICAgKiBAcGFyYW0ge09iamVjdH0gY2FjaGUgQW4gb2JqZWN0IGxpdGVyYWwgb2YgbWFwcGVkIHBhdGhzIHRoYXQgY2FuIGJlIHVzZWQgdG9cbiAgICogICBmb3JjZSBhIHNwZWNpZmljIHBhdGggcmVzb2x1dGlvbiBvciBhdm9pZCBhZGRpdGlvbmFsIGBmcy5zdGF0YCBjYWxscyBmb3JcbiAgICogICBrbm93biByZWFsIHBhdGhzLiBJZiBub3Qgc3VwcGxpZWQgYnkgdGhlIHVzZXIsIGl0J2xsIGJlIGFuIGVtcHR5IG9iamVjdC5cbiAgICogQHBhcmFtIHtGaWxlU3lzdGVtfnBhdGhDYWxsYmFja30gY2JcbiAgICovXG4gIHJlYWxwYXRoKHA6IHN0cmluZywgY2FjaGU6IHtbcGF0aDogc3RyaW5nXTogc3RyaW5nfSwgY2I6IChlcnI6IEFwaUVycm9yLCByZXNvbHZlZFBhdGg/OiBzdHJpbmcpID0+IGFueSk6IHZvaWQ7XG4gIC8qKlxuICAgKiAqKlN1cHBsZW1lbnRhbCoqOiBTeW5jaHJvbm91cyBgcmVhbHBhdGhgLlxuICAgKlxuICAgKiBOb3RlIHRoYXQgdGhlIE5vZGUgQVBJIHdpbGwgcmVzb2x2ZSBgcGF0aGAgdG8gYW4gYWJzb2x1dGUgcGF0aC5cbiAgICogQG1ldGhvZCBGaWxlU3lzdGVtI3JlYWxwYXRoU3luY1xuICAgKiBAcGFyYW0ge3N0cmluZ30gcGF0aFxuICAgKiBAcGFyYW0ge09iamVjdH0gY2FjaGUgQW4gb2JqZWN0IGxpdGVyYWwgb2YgbWFwcGVkIHBhdGhzIHRoYXQgY2FuIGJlIHVzZWQgdG9cbiAgICogICBmb3JjZSBhIHNwZWNpZmljIHBhdGggcmVzb2x1dGlvbiBvciBhdm9pZCBhZGRpdGlvbmFsIGBmcy5zdGF0YCBjYWxscyBmb3JcbiAgICogICBrbm93biByZWFsIHBhdGhzLiBJZiBub3Qgc3VwcGxpZWQgYnkgdGhlIHVzZXIsIGl0J2xsIGJlIGFuIGVtcHR5IG9iamVjdC5cbiAgICogQHJldHVybiB7c3RyaW5nfVxuICAgKi9cbiAgcmVhbHBhdGhTeW5jKHA6IHN0cmluZywgY2FjaGU6IHtbcGF0aDogc3RyaW5nXTogc3RyaW5nfSk6IHN0cmluZztcbiAgLy8gRmlsZSBvcGVyYXRpb25zXG4gIC8qKlxuICAgKlxuICAgKiAqKlN1cHBsZW1lbnRhbCoqOiBBc3luY2hyb25vdXMgYHRydW5jYXRlYC5cbiAgICogQG1ldGhvZCBGaWxlU3lzdGVtI3RydW5jYXRlXG4gICAqIEBwYXJhbSB7c3RyaW5nfSBwYXRoXG4gICAqIEBwYXJhbSB7bnVtYmVyfSBsZW5cbiAgICogQHBhcmFtIHtGaWxlU3lzdGVtfm5vZGVDYWxsYmFja30gY2JcbiAgICovXG4gIHRydW5jYXRlKHA6IHN0cmluZywgbGVuOiBudW1iZXIsIGNiOiBGdW5jdGlvbik6IHZvaWQ7XG4gIC8qKlxuICAgKiAqKlN1cHBsZW1lbnRhbCoqOiBTeW5jaHJvbm91cyBgdHJ1bmNhdGVgLlxuICAgKiBAbWV0aG9kIEZpbGVTeXN0ZW0jdHJ1bmNhdGVTeW5jXG4gICAqIEBwYXJhbSB7c3RyaW5nfSBwYXRoXG4gICAqIEBwYXJhbSB7bnVtYmVyfSBsZW5cbiAgICovXG4gIHRydW5jYXRlU3luYyhwOiBzdHJpbmcsIGxlbjogbnVtYmVyKTogdm9pZDtcbiAgLyoqXG4gICAqICoqU3VwcGxlbWVudGFsKio6IEFzeW5jaHJvbm91c2x5IHJlYWRzIHRoZSBlbnRpcmUgY29udGVudHMgb2YgYSBmaWxlLlxuICAgKiBAbWV0aG9kIEZpbGVTeXN0ZW0jcmVhZEZpbGVcbiAgICogQHBhcmFtIHtzdHJpbmd9IGZpbGVuYW1lXG4gICAqIEBwYXJhbSB7c3RyaW5nfSBlbmNvZGluZyBJZiBub24tbnVsbCwgdGhlIGZpbGUncyBjb250ZW50cyBzaG91bGQgYmUgZGVjb2RlZFxuICAgKiAgIGludG8gYSBzdHJpbmcgdXNpbmcgdGhhdCBlbmNvZGluZy4gT3RoZXJ3aXNlLCBpZiBlbmNvZGluZyBpcyBudWxsLCBmZXRjaFxuICAgKiAgIHRoZSBmaWxlJ3MgY29udGVudHMgYXMgYSBCdWZmZXIuXG4gICAqIEBwYXJhbSB7QnJvd3NlckZTLkZpbGVNb2RlfSBmbGFnXG4gICAqIEBwYXJhbSB7RmlsZVN5c3RlbX5yZWFkQ2FsbGJhY2t9IGNiIElmIG5vIGVuY29kaW5nIGlzIHNwZWNpZmllZCwgdGhlbiB0aGVcbiAgICogICByYXcgYnVmZmVyIGlzIHJldHVybmVkLlxuICAgKi9cbiAgcmVhZEZpbGUoZm5hbWU6IHN0cmluZywgZW5jb2Rpbmc6IHN0cmluZywgZmxhZzogRmlsZUZsYWcsIGNiOiAoZXJyOiBBcGlFcnJvciwgZGF0YT86IGFueSkgPT4gdm9pZCk6IHZvaWQ7XG4gIC8qKlxuICAgKiAqKlN1cHBsZW1lbnRhbCoqOiBTeW5jaHJvbm91c2x5IHJlYWRzIHRoZSBlbnRpcmUgY29udGVudHMgb2YgYSBmaWxlLlxuICAgKiBAbWV0aG9kIEZpbGVTeXN0ZW0jcmVhZEZpbGVTeW5jXG4gICAqIEBwYXJhbSB7c3RyaW5nfSBmaWxlbmFtZVxuICAgKiBAcGFyYW0ge3N0cmluZ30gZW5jb2RpbmcgSWYgbm9uLW51bGwsIHRoZSBmaWxlJ3MgY29udGVudHMgc2hvdWxkIGJlIGRlY29kZWRcbiAgICogICBpbnRvIGEgc3RyaW5nIHVzaW5nIHRoYXQgZW5jb2RpbmcuIE90aGVyd2lzZSwgaWYgZW5jb2RpbmcgaXMgbnVsbCwgZmV0Y2hcbiAgICogICB0aGUgZmlsZSdzIGNvbnRlbnRzIGFzIGEgQnVmZmVyLlxuICAgKiBAcGFyYW0ge0Jyb3dzZXJGUy5GaWxlTW9kZX0gZmxhZ1xuICAgKiBAcmV0dXJuIHsoc3RyaW5nfEJyb3dzZXJGUy5CdWZmZXIpfVxuICAgKi9cbiAgcmVhZEZpbGVTeW5jKGZuYW1lOiBzdHJpbmcsIGVuY29kaW5nOiBzdHJpbmcsIGZsYWc6IEZpbGVGbGFnKTogYW55O1xuICAvKipcbiAgICogKipTdXBwbGVtZW50YWwqKjogQXN5bmNocm9ub3VzbHkgd3JpdGVzIGRhdGEgdG8gYSBmaWxlLCByZXBsYWNpbmcgdGhlIGZpbGVcbiAgICogaWYgaXQgYWxyZWFkeSBleGlzdHMuXG4gICAqXG4gICAqIFRoZSBlbmNvZGluZyBvcHRpb24gaXMgaWdub3JlZCBpZiBkYXRhIGlzIGEgYnVmZmVyLlxuICAgKiBAbWV0aG9kIEZpbGVTeXN0ZW0jd3JpdGVGaWxlXG4gICAqIEBwYXJhbSB7c3RyaW5nfSBmaWxlbmFtZVxuICAgKiBAcGFyYW0geyhzdHJpbmcgfCBCcm93c2VyRlMubm9kZS5CdWZmZXIpfSBkYXRhXG4gICAqIEBwYXJhbSB7c3RyaW5nfSBlbmNvZGluZ1xuICAgKiBAcGFyYW0ge0Jyb3dzZXJGUy5GaWxlTW9kZX0gZmxhZ1xuICAgKiBAcGFyYW0ge251bWJlcn0gbW9kZVxuICAgKiBAcGFyYW0ge0ZpbGVTeXN0ZW1+bm9kZUNhbGxiYWNrfSBjYlxuICAgKi9cbiAgd3JpdGVGaWxlKGZuYW1lOiBzdHJpbmcsIGRhdGE6IGFueSwgZW5jb2Rpbmc6IHN0cmluZywgZmxhZzogRmlsZUZsYWcsIG1vZGU6IG51bWJlciwgY2I6IChlcnI6IEFwaUVycm9yKSA9PiB2b2lkKTogdm9pZDtcbiAgLyoqXG4gICAqICoqU3VwcGxlbWVudGFsKio6IFN5bmNocm9ub3VzbHkgd3JpdGVzIGRhdGEgdG8gYSBmaWxlLCByZXBsYWNpbmcgdGhlIGZpbGVcbiAgICogaWYgaXQgYWxyZWFkeSBleGlzdHMuXG4gICAqXG4gICAqIFRoZSBlbmNvZGluZyBvcHRpb24gaXMgaWdub3JlZCBpZiBkYXRhIGlzIGEgYnVmZmVyLlxuICAgKiBAbWV0aG9kIEZpbGVTeXN0ZW0jd3JpdGVGaWxlU3luY1xuICAgKiBAcGFyYW0ge3N0cmluZ30gZmlsZW5hbWVcbiAgICogQHBhcmFtIHsoc3RyaW5nIHwgQnJvd3NlckZTLm5vZGUuQnVmZmVyKX0gZGF0YVxuICAgKiBAcGFyYW0ge3N0cmluZ30gZW5jb2RpbmdcbiAgICogQHBhcmFtIHtCcm93c2VyRlMuRmlsZU1vZGV9IGZsYWdcbiAgICogQHBhcmFtIHtudW1iZXJ9IG1vZGVcbiAgICovXG4gIHdyaXRlRmlsZVN5bmMoZm5hbWU6IHN0cmluZywgZGF0YTogYW55LCBlbmNvZGluZzogc3RyaW5nLCBmbGFnOiBGaWxlRmxhZywgbW9kZTogbnVtYmVyKTogdm9pZDtcbiAgLyoqXG4gICAqICoqU3VwcGxlbWVudGFsKio6IEFzeW5jaHJvbm91c2x5IGFwcGVuZCBkYXRhIHRvIGEgZmlsZSwgY3JlYXRpbmcgdGhlIGZpbGUgaWZcbiAgICogaXQgbm90IHlldCBleGlzdHMuXG4gICAqIEBtZXRob2QgRmlsZVN5c3RlbSNhcHBlbmRGaWxlXG4gICAqIEBwYXJhbSB7c3RyaW5nfSBmaWxlbmFtZVxuICAgKiBAcGFyYW0geyhzdHJpbmcgfCBCcm93c2VyRlMubm9kZS5CdWZmZXIpfSBkYXRhXG4gICAqIEBwYXJhbSB7c3RyaW5nfSBlbmNvZGluZ1xuICAgKiBAcGFyYW0ge0Jyb3dzZXJGUy5GaWxlTW9kZX0gZmxhZ1xuICAgKiBAcGFyYW0ge251bWJlcn0gbW9kZVxuICAgKiBAcGFyYW0ge0ZpbGVTeXN0ZW1+bm9kZUNhbGxiYWNrfSBjYlxuICAgKi9cbiAgYXBwZW5kRmlsZShmbmFtZTogc3RyaW5nLCBkYXRhOiBhbnksIGVuY29kaW5nOiBzdHJpbmcsIGZsYWc6IEZpbGVGbGFnLCBtb2RlOiBudW1iZXIsIGNiOiAoZXJyOiBBcGlFcnJvcikgPT4gdm9pZCk6IHZvaWQ7XG4gIC8qKlxuICAgKiAqKlN1cHBsZW1lbnRhbCoqOiBTeW5jaHJvbm91c2x5IGFwcGVuZCBkYXRhIHRvIGEgZmlsZSwgY3JlYXRpbmcgdGhlIGZpbGUgaWZcbiAgICogaXQgbm90IHlldCBleGlzdHMuXG4gICAqIEBtZXRob2QgRmlsZVN5c3RlbSNhcHBlbmRGaWxlU3luY1xuICAgKiBAcGFyYW0ge3N0cmluZ30gZmlsZW5hbWVcbiAgICogQHBhcmFtIHsoc3RyaW5nIHwgQnJvd3NlckZTLm5vZGUuQnVmZmVyKX0gZGF0YVxuICAgKiBAcGFyYW0ge3N0cmluZ30gZW5jb2RpbmdcbiAgICogQHBhcmFtIHtCcm93c2VyRlMuRmlsZU1vZGV9IGZsYWdcbiAgICogQHBhcmFtIHtudW1iZXJ9IG1vZGVcbiAgICovXG4gIGFwcGVuZEZpbGVTeW5jKGZuYW1lOiBzdHJpbmcsIGRhdGE6IGFueSwgZW5jb2Rpbmc6IHN0cmluZywgZmxhZzogRmlsZUZsYWcsIG1vZGU6IG51bWJlcik6IHZvaWQ7XG4gIC8vICoqT1BUSU9OQUwgSU5URVJGQUNFIE1FVEhPRFMqKlxuICAvLyBQcm9wZXJ0eSBvcGVyYXRpb25zXG4gIC8vIFRoaXMgaXNuJ3QgYWx3YXlzIHBvc3NpYmxlIG9uIHNvbWUgZmlsZXN5c3RlbSB0eXBlcyAoZS5nLiBEcm9wYm94KS5cbiAgLyoqXG4gICAqICoqT3B0aW9uYWwqKjogQXN5bmNocm9ub3VzIGBjaG1vZGAgb3IgYGxjaG1vZGAuXG4gICAqIEBtZXRob2QgRmlsZVN5c3RlbSNjaG1vZFxuICAgKiBAcGFyYW0ge3N0cmluZ30gcGF0aFxuICAgKiBAcGFyYW0ge2Jvb2xlYW59IGlzTGNobW9kIGBUcnVlYCBpZiBgbGNobW9kYCwgZmFsc2UgaWYgYGNobW9kYC4gSGFzIG5vXG4gICAqICAgYmVhcmluZyBvbiByZXN1bHQgaWYgbGlua3MgYXJlbid0IHN1cHBvcnRlZC5cbiAgICogQHBhcmFtIHtudW1iZXJ9IG1vZGVcbiAgICogQHBhcmFtIHtGaWxlU3lzdGVtfm5vZGVDYWxsYmFja30gY2JcbiAgICovXG4gIGNobW9kKHA6IHN0cmluZywgaXNMY2htb2Q6IGJvb2xlYW4sIG1vZGU6IG51bWJlciwgY2I6IEZ1bmN0aW9uKTogdm9pZDtcbiAgLyoqXG4gICAqICoqT3B0aW9uYWwqKjogU3luY2hyb25vdXMgYGNobW9kYCBvciBgbGNobW9kYC5cbiAgICogQG1ldGhvZCBGaWxlU3lzdGVtI2NobW9kU3luY1xuICAgKiBAcGFyYW0ge3N0cmluZ30gcGF0aFxuICAgKiBAcGFyYW0ge2Jvb2xlYW59IGlzTGNobW9kIGBUcnVlYCBpZiBgbGNobW9kYCwgZmFsc2UgaWYgYGNobW9kYC4gSGFzIG5vXG4gICAqICAgYmVhcmluZyBvbiByZXN1bHQgaWYgbGlua3MgYXJlbid0IHN1cHBvcnRlZC5cbiAgICogQHBhcmFtIHtudW1iZXJ9IG1vZGVcbiAgICovXG4gIGNobW9kU3luYyhwOiBzdHJpbmcsIGlzTGNobW9kOiBib29sZWFuLCBtb2RlOiBudW1iZXIpOiB2b2lkO1xuICAvKipcbiAgICogKipPcHRpb25hbCoqOiBBc3luY2hyb25vdXMgYGNob3duYCBvciBgbGNob3duYC5cbiAgICogQG1ldGhvZCBGaWxlU3lzdGVtI2Nob3duXG4gICAqIEBwYXJhbSB7c3RyaW5nfSBwYXRoXG4gICAqIEBwYXJhbSB7Ym9vbGVhbn0gaXNMY2hvd24gYFRydWVgIGlmIGBsY2hvd25gLCBmYWxzZSBpZiBgY2hvd25gLiBIYXMgbm9cbiAgICogICBiZWFyaW5nIG9uIHJlc3VsdCBpZiBsaW5rcyBhcmVuJ3Qgc3VwcG9ydGVkLlxuICAgKiBAcGFyYW0ge251bWJlcn0gdWlkXG4gICAqIEBwYXJhbSB7bnVtYmVyfSBnaWRcbiAgICogQHBhcmFtIHtGaWxlU3lzdGVtfm5vZGVDYWxsYmFja30gY2JcbiAgICovXG4gIGNob3duKHA6IHN0cmluZywgaXNMY2hvd246IGJvb2xlYW4sIHVpZDogbnVtYmVyLCBnaWQ6IG51bWJlciwgY2I6IEZ1bmN0aW9uKTogdm9pZDtcbiAgLyoqXG4gICAqICoqT3B0aW9uYWwqKjogU3luY2hyb25vdXMgYGNob3duYCBvciBgbGNob3duYC5cbiAgICogQG1ldGhvZCBGaWxlU3lzdGVtI2Nob3duU3luY1xuICAgKiBAcGFyYW0ge3N0cmluZ30gcGF0aFxuICAgKiBAcGFyYW0ge2Jvb2xlYW59IGlzTGNob3duIGBUcnVlYCBpZiBgbGNob3duYCwgZmFsc2UgaWYgYGNob3duYC4gSGFzIG5vXG4gICAqICAgYmVhcmluZyBvbiByZXN1bHQgaWYgbGlua3MgYXJlbid0IHN1cHBvcnRlZC5cbiAgICogQHBhcmFtIHtudW1iZXJ9IHVpZFxuICAgKiBAcGFyYW0ge251bWJlcn0gZ2lkXG4gICAqL1xuICBjaG93blN5bmMocDogc3RyaW5nLCBpc0xjaG93bjogYm9vbGVhbiwgdWlkOiBudW1iZXIsIGdpZDogbnVtYmVyKTogdm9pZDtcbiAgLyoqXG4gICAqICoqT3B0aW9uYWwqKjogQ2hhbmdlIGZpbGUgdGltZXN0YW1wcyBvZiB0aGUgZmlsZSByZWZlcmVuY2VkIGJ5IHRoZSBzdXBwbGllZFxuICAgKiBwYXRoLlxuICAgKiBAbWV0aG9kIEZpbGVTeXN0ZW0jdXRpbWVzXG4gICAqIEBwYXJhbSB7c3RyaW5nfSBwYXRoXG4gICAqIEBwYXJhbSB7RGF0ZX0gYXRpbWVcbiAgICogQHBhcmFtIHtEYXRlfSBtdGltZVxuICAgKiBAcGFyYW0ge0ZpbGVTeXN0ZW1+bm9kZUNhbGxiYWNrfSBjYlxuICAgKi9cbiAgdXRpbWVzKHA6IHN0cmluZywgYXRpbWU6IERhdGUsIG10aW1lOiBEYXRlLCBjYjogRnVuY3Rpb24pOiB2b2lkO1xuICAvKipcbiAgICogKipPcHRpb25hbCoqOiBDaGFuZ2UgZmlsZSB0aW1lc3RhbXBzIG9mIHRoZSBmaWxlIHJlZmVyZW5jZWQgYnkgdGhlIHN1cHBsaWVkXG4gICAqIHBhdGguXG4gICAqIEBtZXRob2QgRmlsZVN5c3RlbSN1dGltZXNTeW5jXG4gICAqIEBwYXJhbSB7c3RyaW5nfSBwYXRoXG4gICAqIEBwYXJhbSB7RGF0ZX0gYXRpbWVcbiAgICogQHBhcmFtIHtEYXRlfSBtdGltZVxuICAgKi9cbiAgdXRpbWVzU3luYyhwOiBzdHJpbmcsIGF0aW1lOiBEYXRlLCBtdGltZTogRGF0ZSk6IHZvaWQ7XG4gIC8vIFN5bWxpbmsgb3BlcmF0aW9uc1xuICAvLyBTeW1saW5rcyBhcmVuJ3QgYWx3YXlzIHN1cHBvcnRlZC5cbiAgLyoqXG4gICAqICoqT3B0aW9uYWwqKjogQXN5bmNocm9ub3VzIGBsaW5rYC5cbiAgICogQG1ldGhvZCBGaWxlU3lzdGVtI2xpbmtcbiAgICogQHBhcmFtIHtzdHJpbmd9IHNyY3BhdGhcbiAgICogQHBhcmFtIHtzdHJpbmd9IGRzdHBhdGhcbiAgICogQHBhcmFtIHtGaWxlU3lzdGVtfm5vZGVDYWxsYmFja30gY2JcbiAgICovXG4gIGxpbmsoc3JjcGF0aDogc3RyaW5nLCBkc3RwYXRoOiBzdHJpbmcsIGNiOiBGdW5jdGlvbik6IHZvaWQ7XG4gIC8qKlxuICAgKiAqKk9wdGlvbmFsKio6IFN5bmNocm9ub3VzIGBsaW5rYC5cbiAgICogQG1ldGhvZCBGaWxlU3lzdGVtI2xpbmtTeW5jXG4gICAqIEBwYXJhbSB7c3RyaW5nfSBzcmNwYXRoXG4gICAqIEBwYXJhbSB7c3RyaW5nfSBkc3RwYXRoXG4gICAqL1xuICBsaW5rU3luYyhzcmNwYXRoOiBzdHJpbmcsIGRzdHBhdGg6IHN0cmluZyk6IHZvaWQ7XG4gIC8qKlxuICAgKiAqKk9wdGlvbmFsKio6IEFzeW5jaHJvbm91cyBgc3ltbGlua2AuXG4gICAqIEBtZXRob2QgRmlsZVN5c3RlbSNzeW1saW5rXG4gICAqIEBwYXJhbSB7c3RyaW5nfSBzcmNwYXRoXG4gICAqIEBwYXJhbSB7c3RyaW5nfSBkc3RwYXRoXG4gICAqIEBwYXJhbSB7c3RyaW5nfSB0eXBlIGNhbiBiZSBlaXRoZXIgYCdkaXInYCBvciBgJ2ZpbGUnYFxuICAgKiBAcGFyYW0ge0ZpbGVTeXN0ZW1+bm9kZUNhbGxiYWNrfSBjYlxuICAgKi9cbiAgc3ltbGluayhzcmNwYXRoOiBzdHJpbmcsIGRzdHBhdGg6IHN0cmluZywgdHlwZTogc3RyaW5nLCBjYjogRnVuY3Rpb24pOiB2b2lkO1xuICAvKipcbiAgICogKipPcHRpb25hbCoqOiBTeW5jaHJvbm91cyBgc3ltbGlua2AuXG4gICAqIEBtZXRob2QgRmlsZVN5c3RlbSNzeW1saW5rU3luY1xuICAgKiBAcGFyYW0ge3N0cmluZ30gc3JjcGF0aFxuICAgKiBAcGFyYW0ge3N0cmluZ30gZHN0cGF0aFxuICAgKiBAcGFyYW0ge3N0cmluZ30gdHlwZSBjYW4gYmUgZWl0aGVyIGAnZGlyJ2Agb3IgYCdmaWxlJ2BcbiAgICovXG4gIHN5bWxpbmtTeW5jKHNyY3BhdGg6IHN0cmluZywgZHN0cGF0aDogc3RyaW5nLCB0eXBlOiBzdHJpbmcpOiB2b2lkO1xuICAvKipcbiAgICogKipPcHRpb25hbCoqOiBBc3luY2hyb25vdXMgcmVhZGxpbmsuXG4gICAqIEBtZXRob2QgRmlsZVN5c3RlbSNyZWFkbGlua1xuICAgKiBAcGFyYW0ge3N0cmluZ30gcGF0aFxuICAgKiBAcGFyYW0ge0ZpbGVTeXN0ZW1+cGF0aENhbGxiYWNrfSBjYWxsYmFja1xuICAgKi9cbiAgcmVhZGxpbmsocDogc3RyaW5nLCBjYjogRnVuY3Rpb24pOiB2b2lkO1xuICAvKipcbiAgICogKipPcHRpb25hbCoqOiBTeW5jaHJvbm91cyByZWFkbGluay5cbiAgICogQG1ldGhvZCBGaWxlU3lzdGVtI3JlYWRsaW5rU3luY1xuICAgKiBAcGFyYW0ge3N0cmluZ30gcGF0aFxuICAgKi9cbiAgcmVhZGxpbmtTeW5jKHA6IHN0cmluZyk6IHN0cmluZztcbn1cblxuLyoqXG4gKiBDb250YWlucyB0eXBpbmdzIGZvciBzdGF0aWMgZnVuY3Rpb25zIG9uIHRoZSBmaWxlIHN5c3RlbSBjb25zdHJ1Y3Rvci5cbiAqL1xuZXhwb3J0IGludGVyZmFjZSBGaWxlU3lzdGVtQ29uc3RydWN0b3Ige1xuICAvKipcbiAgICogKipDb3JlKio6IFJldHVybnMgJ3RydWUnIGlmIHRoaXMgZmlsZXN5c3RlbSBpcyBhdmFpbGFibGUgaW4gdGhlIGN1cnJlbnRcbiAgICogZW52aXJvbm1lbnQuIEZvciBleGFtcGxlLCBhIGBsb2NhbFN0b3JhZ2VgLWJhY2tlZCBmaWxlc3lzdGVtIHdpbGwgcmV0dXJuXG4gICAqICdmYWxzZScgaWYgdGhlIGJyb3dzZXIgZG9lcyBub3Qgc3VwcG9ydCB0aGF0IEFQSS5cbiAgICpcbiAgICogRGVmYXVsdHMgdG8gJ2ZhbHNlJywgYXMgdGhlIEZpbGVTeXN0ZW0gYmFzZSBjbGFzcyBpc24ndCB1c2FibGUgYWxvbmUuXG4gICAqIEBtZXRob2QgRmlsZVN5c3RlbS5pc0F2YWlsYWJsZVxuICAgKiBAcmV0dXJuIHtib29sZWFufVxuICAgKi9cbiAgaXNBdmFpbGFibGUoKTogYm9vbGVhbjtcbn1cblxuLyoqXG4gKiBCYXNpYyBmaWxlc3lzdGVtIGNsYXNzLiBNb3N0IGZpbGVzeXN0ZW1zIHNob3VsZCBleHRlbmQgdGhpcyBjbGFzcywgYXMgaXRcbiAqIHByb3ZpZGVzIGRlZmF1bHQgaW1wbGVtZW50YXRpb25zIGZvciBhIGhhbmRmdWwgb2YgbWV0aG9kcy5cbiAqL1xuZXhwb3J0IGNsYXNzIEJhc2VGaWxlU3lzdGVtIHtcbiAgcHVibGljIHN1cHBvcnRzTGlua3MoKTogYm9vbGVhbiB7XG4gICAgcmV0dXJuIGZhbHNlO1xuICB9XG4gIHB1YmxpYyBkaXNrU3BhY2UocDogc3RyaW5nLCBjYjogKHRvdGFsOiBudW1iZXIsIGZyZWU6IG51bWJlcikgPT4gYW55KTogdm9pZCB7XG4gICAgY2IoMCwgMCk7XG4gIH1cbiAgLyoqXG4gICAqIE9wZW5zIHRoZSBmaWxlIGF0IHBhdGggcCB3aXRoIHRoZSBnaXZlbiBmbGFnLiBUaGUgZmlsZSBtdXN0IGV4aXN0LlxuICAgKiBAcGFyYW0gcCBUaGUgcGF0aCB0byBvcGVuLlxuICAgKiBAcGFyYW0gZmxhZyBUaGUgZmxhZyB0byB1c2Ugd2hlbiBvcGVuaW5nIHRoZSBmaWxlLlxuICAgKi9cbiAgcHVibGljIG9wZW5GaWxlKHA6IHN0cmluZywgZmxhZzogRmlsZUZsYWcsIGNiOiAoZTogQXBpRXJyb3IsIGZpbGU/OiBmaWxlLkZpbGUpID0+IHZvaWQpOiB2b2lkIHtcbiAgICB0aHJvdyBuZXcgQXBpRXJyb3IoRXJyb3JDb2RlLkVOT1RTVVApO1xuICB9XG4gIC8qKlxuICAgKiBDcmVhdGUgdGhlIGZpbGUgYXQgcGF0aCBwIHdpdGggdGhlIGdpdmVuIG1vZGUuIFRoZW4sIG9wZW4gaXQgd2l0aCB0aGUgZ2l2ZW5cbiAgICogZmxhZy5cbiAgICovXG4gIHB1YmxpYyBjcmVhdGVGaWxlKHA6IHN0cmluZywgZmxhZzogRmlsZUZsYWcsIG1vZGU6IG51bWJlciwgY2I6IChlOiBBcGlFcnJvciwgZmlsZT86IGZpbGUuRmlsZSkgPT4gdm9pZCk6IHZvaWQge1xuICAgIHRocm93IG5ldyBBcGlFcnJvcihFcnJvckNvZGUuRU5PVFNVUCk7XG4gIH1cbiAgcHVibGljIG9wZW4ocDogc3RyaW5nLCBmbGFnOkZpbGVGbGFnLCBtb2RlOiBudW1iZXIsIGNiOiAoZXJyOiBBcGlFcnJvciwgZmQ/OiBmaWxlLkJhc2VGaWxlKSA9PiBhbnkpOiB2b2lkIHtcbiAgICB2YXIgbXVzdF9iZV9maWxlID0gKGU6IEFwaUVycm9yLCBzdGF0cz86IFN0YXRzKTogdm9pZCA9PiB7XG4gICAgICBpZiAoZSkge1xuICAgICAgICAvLyBGaWxlIGRvZXMgbm90IGV4aXN0LlxuICAgICAgICBzd2l0Y2ggKGZsYWcucGF0aE5vdEV4aXN0c0FjdGlvbigpKSB7XG4gICAgICAgICAgY2FzZSBBY3Rpb25UeXBlLkNSRUFURV9GSUxFOlxuICAgICAgICAgICAgLy8gRW5zdXJlIHBhcmVudCBleGlzdHMuXG4gICAgICAgICAgICByZXR1cm4gdGhpcy5zdGF0KHBhdGguZGlybmFtZShwKSwgZmFsc2UsIChlOiBBcGlFcnJvciwgcGFyZW50U3RhdHM/OiBTdGF0cykgPT4ge1xuICAgICAgICAgICAgICBpZiAoZSkge1xuICAgICAgICAgICAgICAgIGNiKGUpO1xuICAgICAgICAgICAgICB9IGVsc2UgaWYgKCFwYXJlbnRTdGF0cy5pc0RpcmVjdG9yeSgpKSB7XG4gICAgICAgICAgICAgICAgY2IoQXBpRXJyb3IuRU5PVERJUihwYXRoLmRpcm5hbWUocCkpKTtcbiAgICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICB0aGlzLmNyZWF0ZUZpbGUocCwgZmxhZywgbW9kZSwgY2IpO1xuICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9KTtcbiAgICAgICAgICBjYXNlIEFjdGlvblR5cGUuVEhST1dfRVhDRVBUSU9OOlxuICAgICAgICAgICAgcmV0dXJuIGNiKEFwaUVycm9yLkVOT0VOVChwKSk7XG4gICAgICAgICAgZGVmYXVsdDpcbiAgICAgICAgICAgIHJldHVybiBjYihuZXcgQXBpRXJyb3IoRXJyb3JDb2RlLkVJTlZBTCwgJ0ludmFsaWQgRmlsZUZsYWcgb2JqZWN0LicpKTtcbiAgICAgICAgfVxuICAgICAgfSBlbHNlIHtcbiAgICAgICAgLy8gRmlsZSBleGlzdHMuXG4gICAgICAgIGlmIChzdGF0cy5pc0RpcmVjdG9yeSgpKSB7XG4gICAgICAgICAgcmV0dXJuIGNiKEFwaUVycm9yLkVJU0RJUihwKSk7XG4gICAgICAgIH1cbiAgICAgICAgc3dpdGNoIChmbGFnLnBhdGhFeGlzdHNBY3Rpb24oKSkge1xuICAgICAgICAgIGNhc2UgQWN0aW9uVHlwZS5USFJPV19FWENFUFRJT046XG4gICAgICAgICAgICByZXR1cm4gY2IoQXBpRXJyb3IuRUVYSVNUKHApKTtcbiAgICAgICAgICBjYXNlIEFjdGlvblR5cGUuVFJVTkNBVEVfRklMRTpcbiAgICAgICAgICAgIC8vIE5PVEU6IEluIGEgcHJldmlvdXMgaW1wbGVtZW50YXRpb24sIHdlIGRlbGV0ZWQgdGhlIGZpbGUgYW5kXG4gICAgICAgICAgICAvLyByZS1jcmVhdGVkIGl0LiBIb3dldmVyLCB0aGlzIGNyZWF0ZWQgYSByYWNlIGNvbmRpdGlvbiBpZiBhbm90aGVyXG4gICAgICAgICAgICAvLyBhc3luY2hyb25vdXMgcmVxdWVzdCB3YXMgdHJ5aW5nIHRvIHJlYWQgdGhlIGZpbGUsIGFzIHRoZSBmaWxlXG4gICAgICAgICAgICAvLyB3b3VsZCBub3QgZXhpc3QgZm9yIGEgc21hbGwgcGVyaW9kIG9mIHRpbWUuXG4gICAgICAgICAgICByZXR1cm4gdGhpcy5vcGVuRmlsZShwLCBmbGFnLCAoZTogQXBpRXJyb3IsIGZkPzogZmlsZS5GaWxlKTogdm9pZCA9PiB7XG4gICAgICAgICAgICAgIGlmIChlKSB7XG4gICAgICAgICAgICAgICAgY2IoZSk7XG4gICAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgZmQudHJ1bmNhdGUoMCwgKCkgPT4ge1xuICAgICAgICAgICAgICAgICAgZmQuc3luYygoKSA9PiB7XG4gICAgICAgICAgICAgICAgICAgIGNiKG51bGwsIGZkKTtcbiAgICAgICAgICAgICAgICAgIH0pO1xuICAgICAgICAgICAgICAgIH0pO1xuICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9KTtcbiAgICAgICAgICBjYXNlIEFjdGlvblR5cGUuTk9QOlxuICAgICAgICAgICAgcmV0dXJuIHRoaXMub3BlbkZpbGUocCwgZmxhZywgY2IpO1xuICAgICAgICAgIGRlZmF1bHQ6XG4gICAgICAgICAgICByZXR1cm4gY2IobmV3IEFwaUVycm9yKEVycm9yQ29kZS5FSU5WQUwsICdJbnZhbGlkIEZpbGVGbGFnIG9iamVjdC4nKSk7XG4gICAgICAgIH1cbiAgICAgIH1cbiAgICB9O1xuICAgIHRoaXMuc3RhdChwLCBmYWxzZSwgbXVzdF9iZV9maWxlKTtcbiAgfVxuICBwdWJsaWMgcmVuYW1lKG9sZFBhdGg6IHN0cmluZywgbmV3UGF0aDogc3RyaW5nLCBjYjogKGVycj86IEFwaUVycm9yKSA9PiB2b2lkKTogdm9pZCB7XG4gICAgY2IobmV3IEFwaUVycm9yKEVycm9yQ29kZS5FTk9UU1VQKSk7XG4gIH1cbiAgcHVibGljIHJlbmFtZVN5bmMob2xkUGF0aDogc3RyaW5nLCBuZXdQYXRoOiBzdHJpbmcpOiB2b2lkIHtcbiAgICB0aHJvdyBuZXcgQXBpRXJyb3IoRXJyb3JDb2RlLkVOT1RTVVApO1xuICB9XG4gIHB1YmxpYyBzdGF0KHA6IHN0cmluZywgaXNMc3RhdDogYm9vbGVhbiwgY2I6IChlcnI6IEFwaUVycm9yLCBzdGF0PzogU3RhdHMpID0+IHZvaWQpOiB2b2lkIHtcbiAgICBjYihuZXcgQXBpRXJyb3IoRXJyb3JDb2RlLkVOT1RTVVApKTtcbiAgfVxuICBwdWJsaWMgc3RhdFN5bmMocDogc3RyaW5nLCBpc0xzdGF0OiBib29sZWFuKTogU3RhdHMge1xuICAgIHRocm93IG5ldyBBcGlFcnJvcihFcnJvckNvZGUuRU5PVFNVUCk7XG4gIH1cbiAgLyoqXG4gICAqIE9wZW5zIHRoZSBmaWxlIGF0IHBhdGggcCB3aXRoIHRoZSBnaXZlbiBmbGFnLiBUaGUgZmlsZSBtdXN0IGV4aXN0LlxuICAgKiBAcGFyYW0gcCBUaGUgcGF0aCB0byBvcGVuLlxuICAgKiBAcGFyYW0gZmxhZyBUaGUgZmxhZyB0byB1c2Ugd2hlbiBvcGVuaW5nIHRoZSBmaWxlLlxuICAgKiBAcmV0dXJuIEEgRmlsZSBvYmplY3QgY29ycmVzcG9uZGluZyB0byB0aGUgb3BlbmVkIGZpbGUuXG4gICAqL1xuICBwdWJsaWMgb3BlbkZpbGVTeW5jKHA6IHN0cmluZywgZmxhZzogRmlsZUZsYWcpOiBmaWxlLkZpbGUge1xuICAgIHRocm93IG5ldyBBcGlFcnJvcihFcnJvckNvZGUuRU5PVFNVUCk7XG4gIH1cbiAgLyoqXG4gICAqIENyZWF0ZSB0aGUgZmlsZSBhdCBwYXRoIHAgd2l0aCB0aGUgZ2l2ZW4gbW9kZS4gVGhlbiwgb3BlbiBpdCB3aXRoIHRoZSBnaXZlblxuICAgKiBmbGFnLlxuICAgKi9cbiAgcHVibGljIGNyZWF0ZUZpbGVTeW5jKHA6IHN0cmluZywgZmxhZzogRmlsZUZsYWcsIG1vZGU6IG51bWJlcik6IGZpbGUuRmlsZSB7XG4gICAgdGhyb3cgbmV3IEFwaUVycm9yKEVycm9yQ29kZS5FTk9UU1VQKTtcbiAgfVxuICBwdWJsaWMgb3BlblN5bmMocDogc3RyaW5nLCBmbGFnOiBGaWxlRmxhZywgbW9kZTogbnVtYmVyKTogZmlsZS5GaWxlIHtcbiAgICAvLyBDaGVjayBpZiB0aGUgcGF0aCBleGlzdHMsIGFuZCBpcyBhIGZpbGUuXG4gICAgdmFyIHN0YXRzOiBTdGF0cztcbiAgICB0cnkge1xuICAgICAgc3RhdHMgPSB0aGlzLnN0YXRTeW5jKHAsIGZhbHNlKTtcbiAgICB9IGNhdGNoIChlKSB7XG4gICAgICAvLyBGaWxlIGRvZXMgbm90IGV4aXN0LlxuICAgICAgc3dpdGNoIChmbGFnLnBhdGhOb3RFeGlzdHNBY3Rpb24oKSkge1xuICAgICAgICBjYXNlIEFjdGlvblR5cGUuQ1JFQVRFX0ZJTEU6XG4gICAgICAgICAgLy8gRW5zdXJlIHBhcmVudCBleGlzdHMuXG4gICAgICAgICAgdmFyIHBhcmVudFN0YXRzID0gdGhpcy5zdGF0U3luYyhwYXRoLmRpcm5hbWUocCksIGZhbHNlKTtcbiAgICAgICAgICBpZiAoIXBhcmVudFN0YXRzLmlzRGlyZWN0b3J5KCkpIHtcbiAgICAgICAgICAgIHRocm93IEFwaUVycm9yLkVOT1RESVIocGF0aC5kaXJuYW1lKHApKTtcbiAgICAgICAgICB9XG4gICAgICAgICAgcmV0dXJuIHRoaXMuY3JlYXRlRmlsZVN5bmMocCwgZmxhZywgbW9kZSk7XG4gICAgICAgIGNhc2UgQWN0aW9uVHlwZS5USFJPV19FWENFUFRJT046XG4gICAgICAgICAgdGhyb3cgQXBpRXJyb3IuRU5PRU5UKHApO1xuICAgICAgICBkZWZhdWx0OlxuICAgICAgICAgIHRocm93IG5ldyBBcGlFcnJvcihFcnJvckNvZGUuRUlOVkFMLCAnSW52YWxpZCBGaWxlRmxhZyBvYmplY3QuJyk7XG4gICAgICB9XG4gICAgfVxuXG4gICAgLy8gRmlsZSBleGlzdHMuXG4gICAgaWYgKHN0YXRzLmlzRGlyZWN0b3J5KCkpIHtcbiAgICAgIHRocm93IEFwaUVycm9yLkVJU0RJUihwKTtcbiAgICB9XG4gICAgc3dpdGNoIChmbGFnLnBhdGhFeGlzdHNBY3Rpb24oKSkge1xuICAgICAgY2FzZSBBY3Rpb25UeXBlLlRIUk9XX0VYQ0VQVElPTjpcbiAgICAgICAgdGhyb3cgQXBpRXJyb3IuRUVYSVNUKHApO1xuICAgICAgY2FzZSBBY3Rpb25UeXBlLlRSVU5DQVRFX0ZJTEU6XG4gICAgICAgIC8vIERlbGV0ZSBmaWxlLlxuICAgICAgICB0aGlzLnVubGlua1N5bmMocCk7XG4gICAgICAgIC8vIENyZWF0ZSBmaWxlLiBVc2UgdGhlIHNhbWUgbW9kZSBhcyB0aGUgb2xkIGZpbGUuXG4gICAgICAgIC8vIE5vZGUgaXRzZWxmIG1vZGlmaWVzIHRoZSBjdGltZSB3aGVuIHRoaXMgb2NjdXJzLCBzbyB0aGlzIGFjdGlvblxuICAgICAgICAvLyB3aWxsIHByZXNlcnZlIHRoYXQgYmVoYXZpb3IgaWYgdGhlIHVuZGVybHlpbmcgZmlsZSBzeXN0ZW1cbiAgICAgICAgLy8gc3VwcG9ydHMgdGhvc2UgcHJvcGVydGllcy5cbiAgICAgICAgcmV0dXJuIHRoaXMuY3JlYXRlRmlsZVN5bmMocCwgZmxhZywgc3RhdHMubW9kZSk7XG4gICAgICBjYXNlIEFjdGlvblR5cGUuTk9QOlxuICAgICAgICByZXR1cm4gdGhpcy5vcGVuRmlsZVN5bmMocCwgZmxhZyk7XG4gICAgICBkZWZhdWx0OlxuICAgICAgICB0aHJvdyBuZXcgQXBpRXJyb3IoRXJyb3JDb2RlLkVJTlZBTCwgJ0ludmFsaWQgRmlsZUZsYWcgb2JqZWN0LicpO1xuICAgIH1cbiAgfVxuICBwdWJsaWMgdW5saW5rKHA6IHN0cmluZywgY2I6IEZ1bmN0aW9uKTogdm9pZCB7XG4gICAgY2IobmV3IEFwaUVycm9yKEVycm9yQ29kZS5FTk9UU1VQKSk7XG4gIH1cbiAgcHVibGljIHVubGlua1N5bmMocDogc3RyaW5nKTogdm9pZCB7XG4gICAgdGhyb3cgbmV3IEFwaUVycm9yKEVycm9yQ29kZS5FTk9UU1VQKTtcbiAgfVxuICBwdWJsaWMgcm1kaXIocDogc3RyaW5nLCBjYjogRnVuY3Rpb24pOiB2b2lkIHtcbiAgICBjYihuZXcgQXBpRXJyb3IoRXJyb3JDb2RlLkVOT1RTVVApKTtcbiAgfVxuICBwdWJsaWMgcm1kaXJTeW5jKHA6IHN0cmluZyk6IHZvaWQge1xuICAgIHRocm93IG5ldyBBcGlFcnJvcihFcnJvckNvZGUuRU5PVFNVUCk7XG4gIH1cbiAgcHVibGljIG1rZGlyKHA6IHN0cmluZywgbW9kZTogbnVtYmVyLCBjYjogRnVuY3Rpb24pOiB2b2lkIHtcbiAgICBjYihuZXcgQXBpRXJyb3IoRXJyb3JDb2RlLkVOT1RTVVApKTtcbiAgfVxuICBwdWJsaWMgbWtkaXJTeW5jKHA6IHN0cmluZywgbW9kZTogbnVtYmVyKTogdm9pZCB7XG4gICAgdGhyb3cgbmV3IEFwaUVycm9yKEVycm9yQ29kZS5FTk9UU1VQKTtcbiAgfVxuICBwdWJsaWMgcmVhZGRpcihwOiBzdHJpbmcsIGNiOiAoZXJyOiBBcGlFcnJvciwgZmlsZXM/OiBzdHJpbmdbXSkgPT4gdm9pZCk6IHZvaWQge1xuICAgIGNiKG5ldyBBcGlFcnJvcihFcnJvckNvZGUuRU5PVFNVUCkpO1xuICB9XG4gIHB1YmxpYyByZWFkZGlyU3luYyhwOiBzdHJpbmcpOiBzdHJpbmdbXSB7XG4gICAgdGhyb3cgbmV3IEFwaUVycm9yKEVycm9yQ29kZS5FTk9UU1VQKTtcbiAgfVxuICBwdWJsaWMgZXhpc3RzKHA6IHN0cmluZywgY2I6IChleGlzdHM6IGJvb2xlYW4pID0+IHZvaWQpOiB2b2lkIHtcbiAgICB0aGlzLnN0YXQocCwgbnVsbCwgZnVuY3Rpb24oZXJyKSB7XG4gICAgICBjYihlcnIgPT0gbnVsbCk7XG4gICAgfSk7XG4gIH1cbiAgcHVibGljIGV4aXN0c1N5bmMocDogc3RyaW5nKTogYm9vbGVhbiB7XG4gICAgdHJ5IHtcbiAgICAgIHRoaXMuc3RhdFN5bmMocCwgdHJ1ZSk7XG4gICAgICByZXR1cm4gdHJ1ZTtcbiAgICB9IGNhdGNoIChlKSB7XG4gICAgICByZXR1cm4gZmFsc2U7XG4gICAgfVxuICB9XG4gIHB1YmxpYyByZWFscGF0aChwOiBzdHJpbmcsIGNhY2hlOiB7W3BhdGg6IHN0cmluZ106IHN0cmluZ30sIGNiOiAoZXJyOiBBcGlFcnJvciwgcmVzb2x2ZWRQYXRoPzogc3RyaW5nKSA9PiBhbnkpOiB2b2lkIHtcbiAgICBpZiAodGhpcy5zdXBwb3J0c0xpbmtzKCkpIHtcbiAgICAgIC8vIFRoZSBwYXRoIGNvdWxkIGNvbnRhaW4gc3ltbGlua3MuIFNwbGl0IHVwIHRoZSBwYXRoLFxuICAgICAgLy8gcmVzb2x2ZSBhbnkgc3ltbGlua3MsIHJldHVybiB0aGUgcmVzb2x2ZWQgc3RyaW5nLlxuICAgICAgdmFyIHNwbGl0UGF0aCA9IHAuc3BsaXQocGF0aC5zZXApO1xuICAgICAgLy8gVE9ETzogU2ltcGxlciB0byBqdXN0IHBhc3MgdGhyb3VnaCBmaWxlLCBmaW5kIHNlcCBhbmQgc3VjaC5cbiAgICAgIGZvciAodmFyIGkgPSAwOyBpIDwgc3BsaXRQYXRoLmxlbmd0aDsgaSsrKSB7XG4gICAgICAgIHZhciBhZGRQYXRocyA9IHNwbGl0UGF0aC5zbGljZSgwLCBpICsgMSk7XG4gICAgICAgIHNwbGl0UGF0aFtpXSA9IHBhdGguam9pbi5hcHBseShudWxsLCBhZGRQYXRocyk7XG4gICAgICB9XG4gICAgfSBlbHNlIHtcbiAgICAgIC8vIE5vIHN5bWxpbmtzLiBXZSBqdXN0IG5lZWQgdG8gdmVyaWZ5IHRoYXQgaXQgZXhpc3RzLlxuICAgICAgdGhpcy5leGlzdHMocCwgZnVuY3Rpb24oZG9lc0V4aXN0KSB7XG4gICAgICAgIGlmIChkb2VzRXhpc3QpIHtcbiAgICAgICAgICBjYihudWxsLCBwKTtcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICBjYihBcGlFcnJvci5FTk9FTlQocCkpO1xuICAgICAgICB9XG4gICAgICB9KTtcbiAgICB9XG4gIH1cbiAgcHVibGljIHJlYWxwYXRoU3luYyhwOiBzdHJpbmcsIGNhY2hlOiB7W3BhdGg6IHN0cmluZ106IHN0cmluZ30pOiBzdHJpbmcge1xuICAgIGlmICh0aGlzLnN1cHBvcnRzTGlua3MoKSkge1xuICAgICAgLy8gVGhlIHBhdGggY291bGQgY29udGFpbiBzeW1saW5rcy4gU3BsaXQgdXAgdGhlIHBhdGgsXG4gICAgICAvLyByZXNvbHZlIGFueSBzeW1saW5rcywgcmV0dXJuIHRoZSByZXNvbHZlZCBzdHJpbmcuXG4gICAgICB2YXIgc3BsaXRQYXRoID0gcC5zcGxpdChwYXRoLnNlcCk7XG4gICAgICAvLyBUT0RPOiBTaW1wbGVyIHRvIGp1c3QgcGFzcyB0aHJvdWdoIGZpbGUsIGZpbmQgc2VwIGFuZCBzdWNoLlxuICAgICAgZm9yICh2YXIgaSA9IDA7IGkgPCBzcGxpdFBhdGgubGVuZ3RoOyBpKyspIHtcbiAgICAgICAgdmFyIGFkZFBhdGhzID0gc3BsaXRQYXRoLnNsaWNlKDAsIGkgKyAxKTtcbiAgICAgICAgc3BsaXRQYXRoW2ldID0gcGF0aC5qb2luLmFwcGx5KG51bGwsIGFkZFBhdGhzKTtcbiAgICAgIH1cbiAgICB9IGVsc2Uge1xuICAgICAgLy8gTm8gc3ltbGlua3MuIFdlIGp1c3QgbmVlZCB0byB2ZXJpZnkgdGhhdCBpdCBleGlzdHMuXG4gICAgICBpZiAodGhpcy5leGlzdHNTeW5jKHApKSB7XG4gICAgICAgIHJldHVybiBwO1xuICAgICAgfSBlbHNlIHtcbiAgICAgICAgdGhyb3cgQXBpRXJyb3IuRU5PRU5UKHApO1xuICAgICAgfVxuICAgIH1cbiAgfVxuICBwdWJsaWMgdHJ1bmNhdGUocDogc3RyaW5nLCBsZW46IG51bWJlciwgY2I6IEZ1bmN0aW9uKTogdm9pZCB7XG4gICAgdGhpcy5vcGVuKHAsIEZpbGVGbGFnLmdldEZpbGVGbGFnKCdyKycpLCAweDFhNCwgKGZ1bmN0aW9uKGVyOiBBcGlFcnJvciwgZmQ/OiBmaWxlLkZpbGUpIHtcbiAgICAgIGlmIChlcikge1xuICAgICAgICByZXR1cm4gY2IoZXIpO1xuICAgICAgfVxuICAgICAgZmQudHJ1bmNhdGUobGVuLCAoZnVuY3Rpb24oZXI6IGFueSkge1xuICAgICAgICBmZC5jbG9zZSgoZnVuY3Rpb24oZXIyOiBhbnkpIHtcbiAgICAgICAgICBjYihlciB8fCBlcjIpO1xuICAgICAgICB9KSk7XG4gICAgICB9KSk7XG4gICAgfSkpO1xuICB9XG4gIHB1YmxpYyB0cnVuY2F0ZVN5bmMocDogc3RyaW5nLCBsZW46IG51bWJlcik6IHZvaWQge1xuICAgIHZhciBmZCA9IHRoaXMub3BlblN5bmMocCwgRmlsZUZsYWcuZ2V0RmlsZUZsYWcoJ3IrJyksIDB4MWE0KTtcbiAgICAvLyBOZWVkIHRvIHNhZmVseSBjbG9zZSBGRCwgcmVnYXJkbGVzcyBvZiB3aGV0aGVyIG9yIG5vdCB0cnVuY2F0ZSBzdWNjZWVkcy5cbiAgICB0cnkge1xuICAgICAgZmQudHJ1bmNhdGVTeW5jKGxlbik7XG4gICAgfSBjYXRjaCAoZSkge1xuICAgICAgdGhyb3cgZTtcbiAgICB9IGZpbmFsbHkge1xuICAgICAgZmQuY2xvc2VTeW5jKCk7XG4gICAgfVxuICB9XG4gIHB1YmxpYyByZWFkRmlsZShmbmFtZTogc3RyaW5nLCBlbmNvZGluZzogc3RyaW5nLCBmbGFnOiBGaWxlRmxhZywgY2I6IChlcnI6IEFwaUVycm9yLCBkYXRhPzogYW55KSA9PiB2b2lkKTogdm9pZCB7XG4gICAgLy8gV3JhcCBjYiBpbiBmaWxlIGNsb3NpbmcgY29kZS5cbiAgICB2YXIgb2xkQ2IgPSBjYjtcbiAgICAvLyBHZXQgZmlsZS5cbiAgICB0aGlzLm9wZW4oZm5hbWUsIGZsYWcsIDB4MWE0LCBmdW5jdGlvbihlcnI6IEFwaUVycm9yLCBmZD86IGZpbGUuRmlsZSkge1xuICAgICAgaWYgKGVycikge1xuICAgICAgICByZXR1cm4gY2IoZXJyKTtcbiAgICAgIH1cbiAgICAgIGNiID0gZnVuY3Rpb24oZXJyOiBBcGlFcnJvciwgYXJnPzogZmlsZS5GaWxlKSB7XG4gICAgICAgIGZkLmNsb3NlKGZ1bmN0aW9uKGVycjI6IGFueSkge1xuICAgICAgICAgIGlmIChlcnIgPT0gbnVsbCkge1xuICAgICAgICAgICAgZXJyID0gZXJyMjtcbiAgICAgICAgICB9XG4gICAgICAgICAgcmV0dXJuIG9sZENiKGVyciwgYXJnKTtcbiAgICAgICAgfSk7XG4gICAgICB9O1xuICAgICAgZmQuc3RhdChmdW5jdGlvbihlcnI6IEFwaUVycm9yLCBzdGF0PzogU3RhdHMpIHtcbiAgICAgICAgaWYgKGVyciAhPSBudWxsKSB7XG4gICAgICAgICAgcmV0dXJuIGNiKGVycik7XG4gICAgICAgIH1cbiAgICAgICAgLy8gQWxsb2NhdGUgYnVmZmVyLlxuICAgICAgICB2YXIgYnVmID0gbmV3IEJ1ZmZlcihzdGF0LnNpemUpO1xuICAgICAgICBmZC5yZWFkKGJ1ZiwgMCwgc3RhdC5zaXplLCAwLCBmdW5jdGlvbihlcnIpIHtcbiAgICAgICAgICBpZiAoZXJyICE9IG51bGwpIHtcbiAgICAgICAgICAgIHJldHVybiBjYihlcnIpO1xuICAgICAgICAgIH0gZWxzZSBpZiAoZW5jb2RpbmcgPT09IG51bGwpIHtcbiAgICAgICAgICAgIHJldHVybiBjYihlcnIsIGJ1Zik7XG4gICAgICAgICAgfVxuICAgICAgICAgIHRyeSB7XG4gICAgICAgICAgICBjYihudWxsLCBidWYudG9TdHJpbmcoZW5jb2RpbmcpKTtcbiAgICAgICAgICB9IGNhdGNoIChlKSB7XG4gICAgICAgICAgICBjYihlKTtcbiAgICAgICAgICB9XG4gICAgICAgIH0pO1xuICAgICAgfSk7XG4gICAgfSk7XG4gIH1cbiAgcHVibGljIHJlYWRGaWxlU3luYyhmbmFtZTogc3RyaW5nLCBlbmNvZGluZzogc3RyaW5nLCBmbGFnOiBGaWxlRmxhZyk6IGFueSB7XG4gICAgLy8gR2V0IGZpbGUuXG4gICAgdmFyIGZkID0gdGhpcy5vcGVuU3luYyhmbmFtZSwgZmxhZywgMHgxYTQpO1xuICAgIHRyeSB7XG4gICAgICB2YXIgc3RhdCA9IGZkLnN0YXRTeW5jKCk7XG4gICAgICAvLyBBbGxvY2F0ZSBidWZmZXIuXG4gICAgICB2YXIgYnVmID0gbmV3IEJ1ZmZlcihzdGF0LnNpemUpO1xuICAgICAgZmQucmVhZFN5bmMoYnVmLCAwLCBzdGF0LnNpemUsIDApO1xuICAgICAgZmQuY2xvc2VTeW5jKCk7XG4gICAgICBpZiAoZW5jb2RpbmcgPT09IG51bGwpIHtcbiAgICAgICAgcmV0dXJuIGJ1ZjtcbiAgICAgIH1cbiAgICAgIHJldHVybiBidWYudG9TdHJpbmcoZW5jb2RpbmcpO1xuICAgIH0gZmluYWxseSB7XG4gICAgICBmZC5jbG9zZVN5bmMoKTtcbiAgICB9XG4gIH1cbiAgcHVibGljIHdyaXRlRmlsZShmbmFtZTogc3RyaW5nLCBkYXRhOiBhbnksIGVuY29kaW5nOiBzdHJpbmcsIGZsYWc6IEZpbGVGbGFnLCBtb2RlOiBudW1iZXIsIGNiOiAoZXJyOiBBcGlFcnJvcikgPT4gdm9pZCk6IHZvaWQge1xuICAgIC8vIFdyYXAgY2IgaW4gZmlsZSBjbG9zaW5nIGNvZGUuXG4gICAgdmFyIG9sZENiID0gY2I7XG4gICAgLy8gR2V0IGZpbGUuXG4gICAgdGhpcy5vcGVuKGZuYW1lLCBmbGFnLCAweDFhNCwgZnVuY3Rpb24oZXJyOiBBcGlFcnJvciwgZmQ/OmZpbGUuRmlsZSkge1xuICAgICAgaWYgKGVyciAhPSBudWxsKSB7XG4gICAgICAgIHJldHVybiBjYihlcnIpO1xuICAgICAgfVxuICAgICAgY2IgPSBmdW5jdGlvbihlcnI6IEFwaUVycm9yKSB7XG4gICAgICAgIGZkLmNsb3NlKGZ1bmN0aW9uKGVycjI6IGFueSkge1xuICAgICAgICAgIG9sZENiKGVyciAhPSBudWxsID8gZXJyIDogZXJyMik7XG4gICAgICAgIH0pO1xuICAgICAgfTtcblxuICAgICAgdHJ5IHtcbiAgICAgICAgaWYgKHR5cGVvZiBkYXRhID09PSAnc3RyaW5nJykge1xuICAgICAgICAgIGRhdGEgPSBuZXcgQnVmZmVyKGRhdGEsIGVuY29kaW5nKTtcbiAgICAgICAgfVxuICAgICAgfSBjYXRjaCAoZSkge1xuICAgICAgICByZXR1cm4gY2IoZSk7XG4gICAgICB9XG4gICAgICAvLyBXcml0ZSBpbnRvIGZpbGUuXG4gICAgICBmZC53cml0ZShkYXRhLCAwLCBkYXRhLmxlbmd0aCwgMCwgY2IpO1xuICAgIH0pO1xuICB9XG4gIHB1YmxpYyB3cml0ZUZpbGVTeW5jKGZuYW1lOiBzdHJpbmcsIGRhdGE6IGFueSwgZW5jb2Rpbmc6IHN0cmluZywgZmxhZzogRmlsZUZsYWcsIG1vZGU6IG51bWJlcik6IHZvaWQge1xuICAgIC8vIEdldCBmaWxlLlxuICAgIHZhciBmZCA9IHRoaXMub3BlblN5bmMoZm5hbWUsIGZsYWcsIG1vZGUpO1xuICAgIHRyeSB7XG4gICAgICBpZiAodHlwZW9mIGRhdGEgPT09ICdzdHJpbmcnKSB7XG4gICAgICAgIGRhdGEgPSBuZXcgQnVmZmVyKGRhdGEsIGVuY29kaW5nKTtcbiAgICAgIH1cbiAgICAgIC8vIFdyaXRlIGludG8gZmlsZS5cbiAgICAgIGZkLndyaXRlU3luYyhkYXRhLCAwLCBkYXRhLmxlbmd0aCwgMCk7XG4gICAgfSBmaW5hbGx5IHtcbiAgICAgIGZkLmNsb3NlU3luYygpO1xuICAgIH1cbiAgfVxuICBwdWJsaWMgYXBwZW5kRmlsZShmbmFtZTogc3RyaW5nLCBkYXRhOiBhbnksIGVuY29kaW5nOiBzdHJpbmcsIGZsYWc6IEZpbGVGbGFnLCBtb2RlOiBudW1iZXIsIGNiOiAoZXJyOiBBcGlFcnJvcikgPT4gdm9pZCk6IHZvaWQge1xuICAgIC8vIFdyYXAgY2IgaW4gZmlsZSBjbG9zaW5nIGNvZGUuXG4gICAgdmFyIG9sZENiID0gY2I7XG4gICAgdGhpcy5vcGVuKGZuYW1lLCBmbGFnLCBtb2RlLCBmdW5jdGlvbihlcnI6IEFwaUVycm9yLCBmZD86IGZpbGUuRmlsZSkge1xuICAgICAgaWYgKGVyciAhPSBudWxsKSB7XG4gICAgICAgIHJldHVybiBjYihlcnIpO1xuICAgICAgfVxuICAgICAgY2IgPSBmdW5jdGlvbihlcnI6IEFwaUVycm9yKSB7XG4gICAgICAgIGZkLmNsb3NlKGZ1bmN0aW9uKGVycjI6IGFueSkge1xuICAgICAgICAgIG9sZENiKGVyciAhPSBudWxsID8gZXJyIDogZXJyMik7XG4gICAgICAgIH0pO1xuICAgICAgfTtcbiAgICAgIGlmICh0eXBlb2YgZGF0YSA9PT0gJ3N0cmluZycpIHtcbiAgICAgICAgZGF0YSA9IG5ldyBCdWZmZXIoZGF0YSwgZW5jb2RpbmcpO1xuICAgICAgfVxuICAgICAgZmQud3JpdGUoZGF0YSwgMCwgZGF0YS5sZW5ndGgsIG51bGwsIGNiKTtcbiAgICB9KTtcbiAgfVxuICBwdWJsaWMgYXBwZW5kRmlsZVN5bmMoZm5hbWU6IHN0cmluZywgZGF0YTogYW55LCBlbmNvZGluZzogc3RyaW5nLCBmbGFnOiBGaWxlRmxhZywgbW9kZTogbnVtYmVyKTogdm9pZCB7XG4gICAgdmFyIGZkID0gdGhpcy5vcGVuU3luYyhmbmFtZSwgZmxhZywgbW9kZSk7XG4gICAgdHJ5IHtcbiAgICAgIGlmICh0eXBlb2YgZGF0YSA9PT0gJ3N0cmluZycpIHtcbiAgICAgICAgZGF0YSA9IG5ldyBCdWZmZXIoZGF0YSwgZW5jb2RpbmcpO1xuICAgICAgfVxuICAgICAgZmQud3JpdGVTeW5jKGRhdGEsIDAsIGRhdGEubGVuZ3RoLCBudWxsKTtcbiAgICB9IGZpbmFsbHkge1xuICAgICAgZmQuY2xvc2VTeW5jKCk7XG4gICAgfVxuICB9XG4gIHB1YmxpYyBjaG1vZChwOiBzdHJpbmcsIGlzTGNobW9kOiBib29sZWFuLCBtb2RlOiBudW1iZXIsIGNiOiBGdW5jdGlvbik6IHZvaWQge1xuICAgIGNiKG5ldyBBcGlFcnJvcihFcnJvckNvZGUuRU5PVFNVUCkpO1xuICB9XG4gIHB1YmxpYyBjaG1vZFN5bmMocDogc3RyaW5nLCBpc0xjaG1vZDogYm9vbGVhbiwgbW9kZTogbnVtYmVyKSB7XG4gICAgdGhyb3cgbmV3IEFwaUVycm9yKEVycm9yQ29kZS5FTk9UU1VQKTtcbiAgfVxuICBwdWJsaWMgY2hvd24ocDogc3RyaW5nLCBpc0xjaG93bjogYm9vbGVhbiwgdWlkOiBudW1iZXIsIGdpZDogbnVtYmVyLCBjYjogRnVuY3Rpb24pOiB2b2lkIHtcbiAgICBjYihuZXcgQXBpRXJyb3IoRXJyb3JDb2RlLkVOT1RTVVApKTtcbiAgfVxuICBwdWJsaWMgY2hvd25TeW5jKHA6IHN0cmluZywgaXNMY2hvd246IGJvb2xlYW4sIHVpZDogbnVtYmVyLCBnaWQ6IG51bWJlcik6IHZvaWQge1xuICAgIHRocm93IG5ldyBBcGlFcnJvcihFcnJvckNvZGUuRU5PVFNVUCk7XG4gIH1cbiAgcHVibGljIHV0aW1lcyhwOiBzdHJpbmcsIGF0aW1lOiBEYXRlLCBtdGltZTogRGF0ZSwgY2I6IEZ1bmN0aW9uKTogdm9pZCB7XG4gICAgY2IobmV3IEFwaUVycm9yKEVycm9yQ29kZS5FTk9UU1VQKSk7XG4gIH1cbiAgcHVibGljIHV0aW1lc1N5bmMocDogc3RyaW5nLCBhdGltZTogRGF0ZSwgbXRpbWU6IERhdGUpOiB2b2lkIHtcbiAgICB0aHJvdyBuZXcgQXBpRXJyb3IoRXJyb3JDb2RlLkVOT1RTVVApO1xuICB9XG4gIHB1YmxpYyBsaW5rKHNyY3BhdGg6IHN0cmluZywgZHN0cGF0aDogc3RyaW5nLCBjYjogRnVuY3Rpb24pOiB2b2lkIHtcbiAgICBjYihuZXcgQXBpRXJyb3IoRXJyb3JDb2RlLkVOT1RTVVApKTtcbiAgfVxuICBwdWJsaWMgbGlua1N5bmMoc3JjcGF0aDogc3RyaW5nLCBkc3RwYXRoOiBzdHJpbmcpOiB2b2lkIHtcbiAgICB0aHJvdyBuZXcgQXBpRXJyb3IoRXJyb3JDb2RlLkVOT1RTVVApO1xuICB9XG4gIHB1YmxpYyBzeW1saW5rKHNyY3BhdGg6IHN0cmluZywgZHN0cGF0aDogc3RyaW5nLCB0eXBlOiBzdHJpbmcsIGNiOiBGdW5jdGlvbik6IHZvaWQge1xuICAgIGNiKG5ldyBBcGlFcnJvcihFcnJvckNvZGUuRU5PVFNVUCkpO1xuICB9XG4gIHB1YmxpYyBzeW1saW5rU3luYyhzcmNwYXRoOiBzdHJpbmcsIGRzdHBhdGg6IHN0cmluZywgdHlwZTogc3RyaW5nKTogdm9pZCB7XG4gICAgdGhyb3cgbmV3IEFwaUVycm9yKEVycm9yQ29kZS5FTk9UU1VQKTtcbiAgfVxuICBwdWJsaWMgcmVhZGxpbmsocDogc3RyaW5nLCBjYjogRnVuY3Rpb24pOiB2b2lkIHtcbiAgICBjYihuZXcgQXBpRXJyb3IoRXJyb3JDb2RlLkVOT1RTVVApKTtcbiAgfVxuICBwdWJsaWMgcmVhZGxpbmtTeW5jKHA6IHN0cmluZyk6IHN0cmluZyB7XG4gICAgdGhyb3cgbmV3IEFwaUVycm9yKEVycm9yQ29kZS5FTk9UU1VQKTtcbiAgfVxufVxuXG4vKipcbiAqIEltcGxlbWVudHMgdGhlIGFzeW5jaHJvbm91cyBBUEkgaW4gdGVybXMgb2YgdGhlIHN5bmNocm9ub3VzIEFQSS5cbiAqIEBjbGFzcyBTeW5jaHJvbm91c0ZpbGVTeXN0ZW1cbiAqL1xuZXhwb3J0IGNsYXNzIFN5bmNocm9ub3VzRmlsZVN5c3RlbSBleHRlbmRzIEJhc2VGaWxlU3lzdGVtIHtcbiAgcHVibGljIHN1cHBvcnRzU3luY2goKTogYm9vbGVhbiB7XG4gICAgcmV0dXJuIHRydWU7XG4gIH1cblxuICBwdWJsaWMgcmVuYW1lKG9sZFBhdGg6IHN0cmluZywgbmV3UGF0aDogc3RyaW5nLCBjYjogRnVuY3Rpb24pOiB2b2lkIHtcbiAgICB0cnkge1xuICAgICAgdGhpcy5yZW5hbWVTeW5jKG9sZFBhdGgsIG5ld1BhdGgpO1xuICAgICAgY2IoKTtcbiAgICB9IGNhdGNoIChlKSB7XG4gICAgICBjYihlKTtcbiAgICB9XG4gIH1cblxuICBwdWJsaWMgc3RhdChwOiBzdHJpbmcsIGlzTHN0YXQ6IGJvb2xlYW4sIGNiOiBGdW5jdGlvbik6IHZvaWQge1xuICAgIHRyeSB7XG4gICAgICBjYihudWxsLCB0aGlzLnN0YXRTeW5jKHAsIGlzTHN0YXQpKTtcbiAgICB9IGNhdGNoIChlKSB7XG4gICAgICBjYihlKTtcbiAgICB9XG4gIH1cblxuICBwdWJsaWMgb3BlbihwOiBzdHJpbmcsIGZsYWdzOiBGaWxlRmxhZywgbW9kZTogbnVtYmVyLCBjYjogRnVuY3Rpb24pOiB2b2lkIHtcbiAgICB0cnkge1xuICAgICAgY2IobnVsbCwgdGhpcy5vcGVuU3luYyhwLCBmbGFncywgbW9kZSkpO1xuICAgIH0gY2F0Y2ggKGUpIHtcbiAgICAgIGNiKGUpO1xuICAgIH1cbiAgfVxuXG4gIHB1YmxpYyB1bmxpbmsocDogc3RyaW5nLCBjYjogRnVuY3Rpb24pOiB2b2lkIHtcbiAgICB0cnkge1xuICAgICAgdGhpcy51bmxpbmtTeW5jKHApO1xuICAgICAgY2IoKTtcbiAgICB9IGNhdGNoIChlKSB7XG4gICAgICBjYihlKTtcbiAgICB9XG4gIH1cblxuICBwdWJsaWMgcm1kaXIocDogc3RyaW5nLCBjYjogRnVuY3Rpb24pOiB2b2lkIHtcbiAgICB0cnkge1xuICAgICAgdGhpcy5ybWRpclN5bmMocCk7XG4gICAgICBjYigpO1xuICAgIH0gY2F0Y2ggKGUpIHtcbiAgICAgIGNiKGUpO1xuICAgIH1cbiAgfVxuXG4gIHB1YmxpYyBta2RpcihwOiBzdHJpbmcsIG1vZGU6IG51bWJlciwgY2I6IEZ1bmN0aW9uKTogdm9pZCB7XG4gICAgdHJ5IHtcbiAgICAgIHRoaXMubWtkaXJTeW5jKHAsIG1vZGUpO1xuICAgICAgY2IoKTtcbiAgICB9IGNhdGNoIChlKSB7XG4gICAgICBjYihlKTtcbiAgICB9XG4gIH1cblxuICBwdWJsaWMgcmVhZGRpcihwOiBzdHJpbmcsIGNiOiBGdW5jdGlvbik6IHZvaWQge1xuICAgIHRyeSB7XG4gICAgICBjYihudWxsLCB0aGlzLnJlYWRkaXJTeW5jKHApKTtcbiAgICB9IGNhdGNoIChlKSB7XG4gICAgICBjYihlKTtcbiAgICB9XG4gIH1cblxuICBwdWJsaWMgY2htb2QocDogc3RyaW5nLCBpc0xjaG1vZDogYm9vbGVhbiwgbW9kZTogbnVtYmVyLCBjYjogRnVuY3Rpb24pOiB2b2lkIHtcbiAgICB0cnkge1xuICAgICAgdGhpcy5jaG1vZFN5bmMocCwgaXNMY2htb2QsIG1vZGUpO1xuICAgICAgY2IoKTtcbiAgICB9IGNhdGNoIChlKSB7XG4gICAgICBjYihlKTtcbiAgICB9XG4gIH1cblxuICBwdWJsaWMgY2hvd24ocDogc3RyaW5nLCBpc0xjaG93bjogYm9vbGVhbiwgdWlkOiBudW1iZXIsIGdpZDogbnVtYmVyLCBjYjogRnVuY3Rpb24pOiB2b2lkIHtcbiAgICB0cnkge1xuICAgICAgdGhpcy5jaG93blN5bmMocCwgaXNMY2hvd24sIHVpZCwgZ2lkKTtcbiAgICAgIGNiKCk7XG4gICAgfSBjYXRjaCAoZSkge1xuICAgICAgY2IoZSk7XG4gICAgfVxuICB9XG5cbiAgcHVibGljIHV0aW1lcyhwOiBzdHJpbmcsIGF0aW1lOiBEYXRlLCBtdGltZTogRGF0ZSwgY2I6IEZ1bmN0aW9uKTogdm9pZCB7XG4gICAgdHJ5IHtcbiAgICAgIHRoaXMudXRpbWVzU3luYyhwLCBhdGltZSwgbXRpbWUpO1xuICAgICAgY2IoKTtcbiAgICB9IGNhdGNoIChlKSB7XG4gICAgICBjYihlKTtcbiAgICB9XG4gIH1cblxuICBwdWJsaWMgbGluayhzcmNwYXRoOiBzdHJpbmcsIGRzdHBhdGg6IHN0cmluZywgY2I6IEZ1bmN0aW9uKTogdm9pZCB7XG4gICAgdHJ5IHtcbiAgICAgIHRoaXMubGlua1N5bmMoc3JjcGF0aCwgZHN0cGF0aCk7XG4gICAgICBjYigpO1xuICAgIH0gY2F0Y2ggKGUpIHtcbiAgICAgIGNiKGUpO1xuICAgIH1cbiAgfVxuXG4gIHB1YmxpYyBzeW1saW5rKHNyY3BhdGg6IHN0cmluZywgZHN0cGF0aDogc3RyaW5nLCB0eXBlOiBzdHJpbmcsIGNiOiBGdW5jdGlvbik6IHZvaWQge1xuICAgIHRyeSB7XG4gICAgICB0aGlzLnN5bWxpbmtTeW5jKHNyY3BhdGgsIGRzdHBhdGgsIHR5cGUpO1xuICAgICAgY2IoKTtcbiAgICB9IGNhdGNoIChlKSB7XG4gICAgICBjYihlKTtcbiAgICB9XG4gIH1cblxuICBwdWJsaWMgcmVhZGxpbmsocDogc3RyaW5nLCBjYjogRnVuY3Rpb24pOiB2b2lkIHtcbiAgICB0cnkge1xuICAgICAgY2IobnVsbCwgdGhpcy5yZWFkbGlua1N5bmMocCkpO1xuICAgIH0gY2F0Y2ggKGUpIHtcbiAgICAgIGNiKGUpO1xuICAgIH1cbiAgfVxufVxuIl19