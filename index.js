
var fs = require('fs');
var path = require('path');
var util = require('util');
var events = require('events');
var Buffer = require('buffer').Buffer;
var Busboy = require('busboy');
var Datastore = require('nedb');
var rimraf = require('rimraf');
var mkdirp = require('mkdirp');
var streamCopy = require('stream-copy').copy;
var env = require('./lib/env');

var counter = 1;


exports.create = function(){
    return new Recorder();
};


function Recorder() {
    events.EventEmitter.call(this);
    this.cachePath = env.cachePath;
    this.dbFile = env.dbFile;
}

util.inherits(Recorder, events.EventEmitter);

Recorder.prototype.init = function(){
    
    mkdirp.sync(this.cachePath);
    this.db = new Datastore({ 
        filename: this.dbFile, 
        autoload: true 
    });

};


Recorder.prototype.getRecord = function(id, callback){
    this.db.findOne({ id: id }, callback);
};


Recorder.prototype.getResponseBodyStat = function(id){
    var resFile = path.join(this.cachePath, id+'.res');
    return fs.statSync(resFile);
};


Recorder.prototype.saveRequest = function(req, callback){
    var doc = {
        id: req.nnid,
        request:{
            httpVersion: req.httpVersion,
            headers: req.headers,
            url: req.url,
            method: req.method,
            type: req.type
        }
    };
     
    this.db.insert(doc, callback);
};


Recorder.prototype.saveRequestField = function(req, fields, callback){
    this.db.update({ 
        id: req.nnid 
    }, { 
        $set: { "request.fields": fields } 
    }, {

    }, callback);
};


Recorder.prototype.saveResponse = function(req, res, callback){
    var toSave = {
        headers: res._headers,
        statusCode: res.statusCode,
        statusMessage: res.statusMessage
    };

    this.db.update({ 
        id: req.nnid 
    }, { 
        $set: { 
            'response': toSave,
            'request.flag': req.nnflag
        } 
    }, {

    }, callback);
};


Recorder.prototype.record = function(req, res) {
    var recorder = this;
    var busboy, fields;

    req.nnid = counter++;
    recorder.saveRequest(req, function(){
        recorder.emit('request.connect', req.nnid);    
    });

    if (req.method == 'POST') {
        busboy = new Busboy({
            headers: req.headers
        });
        fields = {};

        busboy.on('file', function(fieldname, file, filename, encoding, mimetype) {
            var reqBodyFile = path.join(recorder.cachePath, req.nnid+'.req');
            var reqBodyStream = fs.createWriteStream(reqBodyFile)
            file.pipe(reqBodyStream);
        });

        busboy.on('field', function(fieldname, val, fieldnameTruncated, valTruncated) {
            fields[fieldname] = val;
        });

        busboy.on('finish', function() {
            recorder.saveRequestField(req, fields, function(){
                recorder.emit('request.finish', req.nnid);    
            });
        });
        req.pipe(busboy);
    }

    var resBodyFile = path.join(recorder.cachePath, req.nnid+'.res');
    var resBodyStream = fs.createWriteStream(resBodyFile)

    streamCopy(res, resBodyStream);

    res.on('finish', function(){
        resBodyStream.end();
        recorder.saveResponse(req, res, function(){
            recorder.emit('response.finish', req.nnid);    
        });
    });

    // var write = res.write;
    // var end = res.end;

    // res.write = function(){
    //     resBodyStream.write.apply(resBodyStream, arguments);
    //     write.apply(res, arguments);
    // };
    // res.end = function(){
    //     //resBodyStream.end.apply(resBodyStream, arguments);
    //     end.apply(res, arguments);
    //     recorder.saveResponse(req, res, function(){
    //         recorder.emit('response.finish', req.nnid);    
    //     });
    // };

};


Recorder.prototype.clearCache = function() {
    if(fs.existsSync(this.dbFile)){
        fs.unlink(this.dbFile);    
    }
    
    rimraf.sync(this.cachePath);
};

