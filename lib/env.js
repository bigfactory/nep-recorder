var path = require('path');
var mkdirp = require('mkdirp');



var homePath = process.env.HOME || process.env.HOMEPATH || process.env.USERPROFILE;
var tmpPath = path.join(homePath, '/.nep/record/');
var dbFile = path.join(tmpPath, 'session.db');
var cachePath = path.join(tmpPath, 'files/');

mkdirp.sync(cachePath);

exports.dbFile = dbFile;
exports.cachePath = cachePath;
