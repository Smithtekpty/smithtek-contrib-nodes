'use strict';

var util = require('util');
var stream = require('stream');


var PacketFilterStream = module.exports = function(opts) {
  opts = opts || {};
  opts.decodeStrings = true;

  let self = this;

  stream.Duplex.call(this, opts);

  var initialSize = opts.initialSize || 512;
  var incrementAmount = opts.incrementAmount || 128;

  self.packetHeader = opts.header || '';
  self.dataLength = opts.packetLength || 1;

  this.buffer =  Buffer.alloc(initialSize);
  var size = 0;

  this.size = () => {
    return size;
  };

  this.maxSize = () =>  {
    return self.buffer.length;
  };

  this.dropContents = (length) => {
    if(!size) return false;

    var len = Math.min(length || size, size);

    if(len < size)
      self.buffer.copy(self.buffer, 0, len);

    size -= len;
    return len;
  };


  this.getContents = (length) => {
    if(!size) return false;

    var data =  Buffer.alloc(Math.min(length || size, size));
    self.buffer.copy(data, 0, 0, data.length);

    if(data.length < size)
      self.buffer.copy(self.buffer, 0, data.length);

    size -= data.length;

    return data;
  };

  this.getContentsAsString = (encoding, length) => {
    if(!size) return false;

    var data = self.buffer.toString(encoding || 'utf8', 0, Math.min(length || size, size));
    var dataLength = Buffer.byteLength(data);

    if(dataLength < size)
      self.buffer.copy(self.buffer, 0, dataLength);

    size -= dataLength;
    return data;
  };

  var increaseBufferIfNecessary = (incomingDataSize) => {
    if((self.buffer.length - size) < incomingDataSize) {
      var factor = Math.ceil((incomingDataSize - (self.buffer.length - size)) / incrementAmount);

      var newBuffer = Buffer.alloc(self.buffer.length + (incrementAmount * factor));
      self.buffer.copy(newBuffer, 0, 0, size);
      self.buffer = newBuffer;
    }
  };

  this._write = (chunk, encoding, callback) => {
    increaseBufferIfNecessary(chunk.length);
    chunk.copy(self.buffer, size, 0);
    size += chunk.length;

    while( self.size() >= (self.packetHeader.length + self.dataLength)) {
      const index = self.buffer.slice(0,this.size()).indexOf(self.packetHeader);
      if(index != -1) {
        if(index>0) {
          self.dropContents(index);
        }
        if(self.size()>= self.packetHeader.length + self.dataLength) {
          self.dropContents(self.packetHeader.length);
          self.push(self.getContents(self.dataLength));
          // console.log("get packet:",);

        }
      } else {
        // not found
        self.dropContents(self.size()-self.packetHeader.length + 1);
      }
    }

    callback();
  };


  this._read = (size) =>{
    // this._source.readStart();
  }

};

util.inherits(PacketFilterStream, stream.Duplex);
