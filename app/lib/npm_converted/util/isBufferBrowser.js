/*
 * Don't edit this file by hand!
 * This file was generated from a npm-package using gulp. 
 * For more information see gulpfile.js in the project root
 */
define(function (require, exports, module) {module.exports = function isBuffer(arg) {
  return arg && typeof arg === 'object'
    && typeof arg.copy === 'function'
    && typeof arg.fill === 'function'
    && typeof arg.readUInt8 === 'function';
}
});
