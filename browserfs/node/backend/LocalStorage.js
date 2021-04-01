"use strict";
var __extends = (this && this.__extends) || function (d, b) {
    for (var p in b) if (b.hasOwnProperty(p)) d[p] = b[p];
    function __() { this.constructor = d; }
    d.prototype = b === null ? Object.create(b) : (__.prototype = b.prototype, new __());
};
var kvfs = require('../generic/key_value_filesystem');
var api_error_1 = require('../core/api_error');
var global = require('../core/global');
var supportsBinaryString = false, binaryEncoding;
try {
    global.localStorage.setItem("__test__", String.fromCharCode(0xD800));
    supportsBinaryString = global.localStorage.getItem("__test__") === String.fromCharCode(0xD800);
}
catch (e) {
    supportsBinaryString = false;
}
binaryEncoding = supportsBinaryString ? 'binary_string' : 'binary_string_ie';
if (!Buffer.isEncoding(binaryEncoding)) {
    binaryEncoding = "base64";
}
var LocalStorageStore = (function () {
    function LocalStorageStore() {
    }
    LocalStorageStore.prototype.name = function () {
        return 'LocalStorage';
    };
    LocalStorageStore.prototype.clear = function () {
        global.localStorage.clear();
    };
    LocalStorageStore.prototype.beginTransaction = function (type) {
        return new kvfs.SimpleSyncRWTransaction(this);
    };
    LocalStorageStore.prototype.get = function (key) {
        try {
            var data = global.localStorage.getItem(key);
            if (data !== null) {
                return new Buffer(data, binaryEncoding);
            }
        }
        catch (e) {
        }
        return undefined;
    };
    LocalStorageStore.prototype.put = function (key, data, overwrite) {
        try {
            if (!overwrite && global.localStorage.getItem(key) !== null) {
                return false;
            }
            global.localStorage.setItem(key, data.toString(binaryEncoding));
            return true;
        }
        catch (e) {
            throw new api_error_1.ApiError(api_error_1.ErrorCode.ENOSPC, "LocalStorage is full.");
        }
    };
    LocalStorageStore.prototype.del = function (key) {
        try {
            global.localStorage.removeItem(key);
        }
        catch (e) {
            throw new api_error_1.ApiError(api_error_1.ErrorCode.EIO, "Unable to delete key " + key + ": " + e);
        }
    };
    return LocalStorageStore;
}());
exports.LocalStorageStore = LocalStorageStore;
var LocalStorageFileSystem = (function (_super) {
    __extends(LocalStorageFileSystem, _super);
    function LocalStorageFileSystem() {
        _super.call(this, { store: new LocalStorageStore() });
    }
    LocalStorageFileSystem.isAvailable = function () {
        return typeof global.localStorage !== 'undefined';
    };
    return LocalStorageFileSystem;
}(kvfs.SyncKeyValueFileSystem));
exports.__esModule = true;
exports["default"] = LocalStorageFileSystem;
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiTG9jYWxTdG9yYWdlLmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXMiOlsiLi4vLi4vLi4vc3JjL2JhY2tlbmQvTG9jYWxTdG9yYWdlLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiI7Ozs7OztBQUFBLElBQU8sSUFBSSxXQUFXLGlDQUFpQyxDQUFDLENBQUM7QUFDekQsMEJBQWtDLG1CQUFtQixDQUFDLENBQUE7QUFDdEQsSUFBTyxNQUFNLFdBQVcsZ0JBQWdCLENBQUMsQ0FBQztBQUsxQyxJQUFJLG9CQUFvQixHQUFZLEtBQUssRUFDdkMsY0FBc0IsQ0FBQztBQUN6QixJQUFJLENBQUM7SUFDSCxNQUFNLENBQUMsWUFBWSxDQUFDLE9BQU8sQ0FBQyxVQUFVLEVBQUUsTUFBTSxDQUFDLFlBQVksQ0FBQyxNQUFNLENBQUMsQ0FBQyxDQUFDO0lBQ3JFLG9CQUFvQixHQUFHLE1BQU0sQ0FBQyxZQUFZLENBQUMsT0FBTyxDQUFDLFVBQVUsQ0FBQyxLQUFLLE1BQU0sQ0FBQyxZQUFZLENBQUMsTUFBTSxDQUFDLENBQUM7QUFDakcsQ0FBRTtBQUFBLEtBQUssQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUM7SUFFWCxvQkFBb0IsR0FBRyxLQUFLLENBQUM7QUFDL0IsQ0FBQztBQUNELGNBQWMsR0FBRyxvQkFBb0IsR0FBRyxlQUFlLEdBQUcsa0JBQWtCLENBQUM7QUFDN0UsRUFBRSxDQUFDLENBQUMsQ0FBQyxNQUFNLENBQUMsVUFBVSxDQUFDLGNBQWMsQ0FBQyxDQUFDLENBQUMsQ0FBQztJQUd2QyxjQUFjLEdBQUcsUUFBUSxDQUFDO0FBQzVCLENBQUM7QUFLRDtJQUNFO0lBQWdCLENBQUM7SUFFVixnQ0FBSSxHQUFYO1FBQ0UsTUFBTSxDQUFDLGNBQWMsQ0FBQztJQUN4QixDQUFDO0lBRU0saUNBQUssR0FBWjtRQUNFLE1BQU0sQ0FBQyxZQUFZLENBQUMsS0FBSyxFQUFFLENBQUM7SUFDOUIsQ0FBQztJQUVNLDRDQUFnQixHQUF2QixVQUF3QixJQUFZO1FBRWxDLE1BQU0sQ0FBQyxJQUFJLElBQUksQ0FBQyx1QkFBdUIsQ0FBQyxJQUFJLENBQUMsQ0FBQztJQUNoRCxDQUFDO0lBRU0sK0JBQUcsR0FBVixVQUFXLEdBQVc7UUFDcEIsSUFBSSxDQUFDO1lBQ0gsSUFBSSxJQUFJLEdBQUcsTUFBTSxDQUFDLFlBQVksQ0FBQyxPQUFPLENBQUMsR0FBRyxDQUFDLENBQUM7WUFDNUMsRUFBRSxDQUFDLENBQUMsSUFBSSxLQUFLLElBQUksQ0FBQyxDQUFDLENBQUM7Z0JBQ2xCLE1BQU0sQ0FBQyxJQUFJLE1BQU0sQ0FBQyxJQUFJLEVBQUUsY0FBYyxDQUFDLENBQUM7WUFDMUMsQ0FBQztRQUNILENBQUU7UUFBQSxLQUFLLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDO1FBRWIsQ0FBQztRQUVELE1BQU0sQ0FBQyxTQUFTLENBQUM7SUFDbkIsQ0FBQztJQUVNLCtCQUFHLEdBQVYsVUFBVyxHQUFXLEVBQUUsSUFBZ0IsRUFBRSxTQUFrQjtRQUMxRCxJQUFJLENBQUM7WUFDSCxFQUFFLENBQUMsQ0FBQyxDQUFDLFNBQVMsSUFBSSxNQUFNLENBQUMsWUFBWSxDQUFDLE9BQU8sQ0FBQyxHQUFHLENBQUMsS0FBSyxJQUFJLENBQUMsQ0FBQyxDQUFDO2dCQUU1RCxNQUFNLENBQUMsS0FBSyxDQUFDO1lBQ2YsQ0FBQztZQUNELE1BQU0sQ0FBQyxZQUFZLENBQUMsT0FBTyxDQUFDLEdBQUcsRUFBRSxJQUFJLENBQUMsUUFBUSxDQUFDLGNBQWMsQ0FBQyxDQUFDLENBQUM7WUFDaEUsTUFBTSxDQUFDLElBQUksQ0FBQztRQUNkLENBQUU7UUFBQSxLQUFLLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDO1lBQ1gsTUFBTSxJQUFJLG9CQUFRLENBQUMscUJBQVMsQ0FBQyxNQUFNLEVBQUUsdUJBQXVCLENBQUMsQ0FBQztRQUNoRSxDQUFDO0lBQ0gsQ0FBQztJQUVNLCtCQUFHLEdBQVYsVUFBVyxHQUFXO1FBQ3BCLElBQUksQ0FBQztZQUNILE1BQU0sQ0FBQyxZQUFZLENBQUMsVUFBVSxDQUFDLEdBQUcsQ0FBQyxDQUFDO1FBQ3RDLENBQUU7UUFBQSxLQUFLLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDO1lBQ1gsTUFBTSxJQUFJLG9CQUFRLENBQUMscUJBQVMsQ0FBQyxHQUFHLEVBQUUsdUJBQXVCLEdBQUcsR0FBRyxHQUFHLElBQUksR0FBRyxDQUFDLENBQUMsQ0FBQztRQUM5RSxDQUFDO0lBQ0gsQ0FBQztJQUNILHdCQUFDO0FBQUQsQ0FBQyxBQWpERCxJQWlEQztBQWpEWSx5QkFBaUIsb0JBaUQ3QixDQUFBO0FBTUQ7SUFBb0QsMENBQTJCO0lBQzdFO1FBQWdCLGtCQUFNLEVBQUUsS0FBSyxFQUFFLElBQUksaUJBQWlCLEVBQUUsRUFBRSxDQUFDLENBQUM7SUFBQyxDQUFDO0lBQzlDLGtDQUFXLEdBQXpCO1FBQ0UsTUFBTSxDQUFDLE9BQU8sTUFBTSxDQUFDLFlBQVksS0FBSyxXQUFXLENBQUM7SUFDcEQsQ0FBQztJQUNILDZCQUFDO0FBQUQsQ0FBQyxBQUxELENBQW9ELElBQUksQ0FBQyxzQkFBc0IsR0FLOUU7QUFMRDsyQ0FLQyxDQUFBIiwic291cmNlc0NvbnRlbnQiOlsiaW1wb3J0IGt2ZnMgPSByZXF1aXJlKCcuLi9nZW5lcmljL2tleV92YWx1ZV9maWxlc3lzdGVtJyk7XG5pbXBvcnQge0FwaUVycm9yLCBFcnJvckNvZGV9IGZyb20gJy4uL2NvcmUvYXBpX2Vycm9yJztcbmltcG9ydCBnbG9iYWwgPSByZXF1aXJlKCcuLi9jb3JlL2dsb2JhbCcpO1xuXG4vLyBTb21lIHZlcnNpb25zIG9mIEZGIGFuZCBhbGwgdmVyc2lvbnMgb2YgSUUgZG8gbm90IHN1cHBvcnQgdGhlIGZ1bGwgcmFuZ2Ugb2Zcbi8vIDE2LWJpdCBudW1iZXJzIGVuY29kZWQgYXMgY2hhcmFjdGVycywgYXMgdGhleSBlbmZvcmNlIFVURi0xNiByZXN0cmljdGlvbnMuXG4vLyBodHRwOi8vc3RhY2tvdmVyZmxvdy5jb20vcXVlc3Rpb25zLzExMTcwNzE2L2FyZS10aGVyZS1hbnktY2hhcmFjdGVycy10aGF0LWFyZS1ub3QtYWxsb3dlZC1pbi1sb2NhbHN0b3JhZ2UvMTExNzM2NzMjMTExNzM2NzNcbnZhciBzdXBwb3J0c0JpbmFyeVN0cmluZzogYm9vbGVhbiA9IGZhbHNlLFxuICBiaW5hcnlFbmNvZGluZzogc3RyaW5nO1xudHJ5IHtcbiAgZ2xvYmFsLmxvY2FsU3RvcmFnZS5zZXRJdGVtKFwiX190ZXN0X19cIiwgU3RyaW5nLmZyb21DaGFyQ29kZSgweEQ4MDApKTtcbiAgc3VwcG9ydHNCaW5hcnlTdHJpbmcgPSBnbG9iYWwubG9jYWxTdG9yYWdlLmdldEl0ZW0oXCJfX3Rlc3RfX1wiKSA9PT0gU3RyaW5nLmZyb21DaGFyQ29kZSgweEQ4MDApO1xufSBjYXRjaCAoZSkge1xuICAvLyBJRSB0aHJvd3MgYW4gZXhjZXB0aW9uLlxuICBzdXBwb3J0c0JpbmFyeVN0cmluZyA9IGZhbHNlO1xufVxuYmluYXJ5RW5jb2RpbmcgPSBzdXBwb3J0c0JpbmFyeVN0cmluZyA/ICdiaW5hcnlfc3RyaW5nJyA6ICdiaW5hcnlfc3RyaW5nX2llJztcbmlmICghQnVmZmVyLmlzRW5jb2RpbmcoYmluYXJ5RW5jb2RpbmcpKSB7XG4gIC8vIEZhbGxiYWNrIGZvciBub24gQnJvd3NlckZTIGltcGxlbWVudGF0aW9ucyBvZiBidWZmZXIgdGhhdCBsYWNrIGFcbiAgLy8gYmluYXJ5X3N0cmluZyBmb3JtYXQuXG4gIGJpbmFyeUVuY29kaW5nID0gXCJiYXNlNjRcIjtcbn1cblxuLyoqXG4gKiBBIHN5bmNocm9ub3VzIGtleS12YWx1ZSBzdG9yZSBiYWNrZWQgYnkgbG9jYWxTdG9yYWdlLlxuICovXG5leHBvcnQgY2xhc3MgTG9jYWxTdG9yYWdlU3RvcmUgaW1wbGVtZW50cyBrdmZzLlN5bmNLZXlWYWx1ZVN0b3JlLCBrdmZzLlNpbXBsZVN5bmNTdG9yZSB7XG4gIGNvbnN0cnVjdG9yKCkgeyB9XG5cbiAgcHVibGljIG5hbWUoKTogc3RyaW5nIHtcbiAgICByZXR1cm4gJ0xvY2FsU3RvcmFnZSc7XG4gIH1cblxuICBwdWJsaWMgY2xlYXIoKTogdm9pZCB7XG4gICAgZ2xvYmFsLmxvY2FsU3RvcmFnZS5jbGVhcigpO1xuICB9XG5cbiAgcHVibGljIGJlZ2luVHJhbnNhY3Rpb24odHlwZTogc3RyaW5nKToga3Zmcy5TeW5jS2V5VmFsdWVSV1RyYW5zYWN0aW9uIHtcbiAgICAvLyBObyBuZWVkIHRvIGRpZmZlcmVudGlhdGUuXG4gICAgcmV0dXJuIG5ldyBrdmZzLlNpbXBsZVN5bmNSV1RyYW5zYWN0aW9uKHRoaXMpO1xuICB9XG5cbiAgcHVibGljIGdldChrZXk6IHN0cmluZyk6IE5vZGVCdWZmZXIge1xuICAgIHRyeSB7XG4gICAgICB2YXIgZGF0YSA9IGdsb2JhbC5sb2NhbFN0b3JhZ2UuZ2V0SXRlbShrZXkpO1xuICAgICAgaWYgKGRhdGEgIT09IG51bGwpIHtcbiAgICAgICAgcmV0dXJuIG5ldyBCdWZmZXIoZGF0YSwgYmluYXJ5RW5jb2RpbmcpO1xuICAgICAgfVxuICAgIH0gY2F0Y2ggKGUpIHtcblxuICAgIH1cbiAgICAvLyBLZXkgZG9lc24ndCBleGlzdCwgb3IgYSBmYWlsdXJlIG9jY3VycmVkLlxuICAgIHJldHVybiB1bmRlZmluZWQ7XG4gIH1cblxuICBwdWJsaWMgcHV0KGtleTogc3RyaW5nLCBkYXRhOiBOb2RlQnVmZmVyLCBvdmVyd3JpdGU6IGJvb2xlYW4pOiBib29sZWFuIHtcbiAgICB0cnkge1xuICAgICAgaWYgKCFvdmVyd3JpdGUgJiYgZ2xvYmFsLmxvY2FsU3RvcmFnZS5nZXRJdGVtKGtleSkgIT09IG51bGwpIHtcbiAgICAgICAgLy8gRG9uJ3Qgd2FudCB0byBvdmVyd3JpdGUgdGhlIGtleSFcbiAgICAgICAgcmV0dXJuIGZhbHNlO1xuICAgICAgfVxuICAgICAgZ2xvYmFsLmxvY2FsU3RvcmFnZS5zZXRJdGVtKGtleSwgZGF0YS50b1N0cmluZyhiaW5hcnlFbmNvZGluZykpO1xuICAgICAgcmV0dXJuIHRydWU7XG4gICAgfSBjYXRjaCAoZSkge1xuICAgICAgdGhyb3cgbmV3IEFwaUVycm9yKEVycm9yQ29kZS5FTk9TUEMsIFwiTG9jYWxTdG9yYWdlIGlzIGZ1bGwuXCIpO1xuICAgIH1cbiAgfVxuXG4gIHB1YmxpYyBkZWwoa2V5OiBzdHJpbmcpOiB2b2lkIHtcbiAgICB0cnkge1xuICAgICAgZ2xvYmFsLmxvY2FsU3RvcmFnZS5yZW1vdmVJdGVtKGtleSk7XG4gICAgfSBjYXRjaCAoZSkge1xuICAgICAgdGhyb3cgbmV3IEFwaUVycm9yKEVycm9yQ29kZS5FSU8sIFwiVW5hYmxlIHRvIGRlbGV0ZSBrZXkgXCIgKyBrZXkgKyBcIjogXCIgKyBlKTtcbiAgICB9XG4gIH1cbn1cblxuLyoqXG4gKiBBIHN5bmNocm9ub3VzIGZpbGUgc3lzdGVtIGJhY2tlZCBieSBsb2NhbFN0b3JhZ2UuIENvbm5lY3RzIG91clxuICogTG9jYWxTdG9yYWdlU3RvcmUgdG8gb3VyIFN5bmNLZXlWYWx1ZUZpbGVTeXN0ZW0uXG4gKi9cbmV4cG9ydCBkZWZhdWx0IGNsYXNzIExvY2FsU3RvcmFnZUZpbGVTeXN0ZW0gZXh0ZW5kcyBrdmZzLlN5bmNLZXlWYWx1ZUZpbGVTeXN0ZW0ge1xuICBjb25zdHJ1Y3RvcigpIHsgc3VwZXIoeyBzdG9yZTogbmV3IExvY2FsU3RvcmFnZVN0b3JlKCkgfSk7IH1cbiAgcHVibGljIHN0YXRpYyBpc0F2YWlsYWJsZSgpOiBib29sZWFuIHtcbiAgICByZXR1cm4gdHlwZW9mIGdsb2JhbC5sb2NhbFN0b3JhZ2UgIT09ICd1bmRlZmluZWQnO1xuICB9XG59XG4iXX0=