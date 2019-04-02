var util = require('util');
var Writable = require('stream').Writable;


// service objects

var PacketFilterStream = function(opts) {
  opts = opts || {};
  opts.decodeStrings = true;

  let self = this;

  Writable.call(this, opts);


  this.interval = false;
  if(opts.timeout >0 ) {
    this.timeout = opts.timeout;
  } else {
    this.timeout = false;
  }

  var initialSize = opts.initialSize || 512;
  var incrementAmount = opts.incrementAmount || 128;

  self.packetHeader = opts.header || '';
  self.dataLength = opts.packetLength || 1;



  if (opts.crc) {
    this.crc_length = 1;
    this.crc = (buf) => {
      var xor = 0;
      for (let n = 0; n < buf.length; n++)
      {
        xor = (xor ^ buf[n]) & 0xFF;
      }
      return new Uint8Array([xor]);
    }
  } else {
    this.crc_length = 0;
    this.crc = false;
  }



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
    if(self.packetHeader.length>0) {
      while (self.size() >= (self.packetHeader.length + self.dataLength + self.crc_length)) {
        const index = self.buffer.slice(0, self.size()).indexOf(self.packetHeader);
        if (index != -1) {
          if (index > 0) {
            self.dropContents(index);
          }
          if (self.size() >= self.packetHeader.length + self.dataLength + self.crc_length) {
            let packet = self.getContents(self.packetHeader.length + self.dataLength + self.crc_length);
            let payload = packet.slice(self.packetHeader.length, -self.crc_length);
            // if(!self.crc || self.crc(payload)) {
            if(self.crc && packet.slice(self.packetHeader.length + self.dataLength).equals(self.crc(payload)) ) {
              self.emit('data',payload );
            }  else {
              // invalid CRC
            }

          }
        } else {
          // not found
          self.dropContents(self.size() - self.packetHeader.length + 1);
        }
      }
    } else {

      let len = 1;
      if(self.dataLength>0) {
        len = self.dataLength;
      }
      if(self.size()>= len) {
        self.emit('data',self.getContents(len));
      }
    }
    if(this.timeout && this.size()>0) {
      this.updateTimeout(this.timeout);
    }
    callback();

  };

  this.updateTimeout = (t) => {
    if(this.interval) {
      clearTimeout(this.interval);
    }

    if( t > 0 ) {
      this.interval = setTimeout( () => {
        let s = this.size();
        this.dropContents(s);
      },t );
    } else {
      this.interval = false;
    }
  }






};

util.inherits(PacketFilterStream, Writable);

module.exports = PacketFilterStream;