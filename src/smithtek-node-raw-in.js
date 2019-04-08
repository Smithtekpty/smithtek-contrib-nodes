


module.exports = function(RED) {
  "use strict";
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




  // end service objects




  function SmithtekRawIn(n) {
    RED.nodes.createNode(this,n);
    var node = this;
    this.piped = false;

    this.serial = n.serial;
    // check incoming values
    var header = Buffer.from(n.header,'hex');

    n.repeats = parseInt(n.repeats,10);
    if(isNaN(n.repeats)) {
      this.error(RED._("smithtek.errors.invalid-repeats"));
      node.status({fill:"red",shape:"ring",text:"node-red:common.status.not-connected"});
      return;
    }

    n.size = parseInt(n.size,10);
    if(isNaN(n.size) || n.size<0) {
      this.error(RED._("smithtek.errors.invalid-size"));
      node.status({fill:"red",shape:"ring",text:"node-red:common.status.not-connected"});
      return;
    }

    n.timeout = parseInt(n.timeout,10);

    if(isNaN(n.timeout) || n.timeout<0) {
      this.error(RED._("smithtek.errors.invalid-timeout"));
      node.status({fill:"red",shape:"ring",text:"node-red:common.status.not-connected"});
      return;
    }



    var header_array = [];
    for (var i = 0; i< n.repeats; i++) {
      header_array.push(header);
    }


    this.data_processor = new PacketFilterStream({
      initialSize: (100 * 1024),   // start at 100 kilobytes.
      incrementAmount: (10 * 1024), // grow by 10 kilobytes each time buffer overflows.
      header: Buffer.concat(header_array),
      packetLength: n.size,
      timeout: n.timeout,
      crc: n.crc

    });

    this.data_processor.on('data', (data) => {
      node.send({"payload": data});
    });


    this.serialConfig = RED.nodes.getNode(this.serial);



    if (this.serialConfig) {




      node.port = this.serialConfig.serialPool.get(this.serialConfig.serialport,
        this.serialConfig.serialbaud,
        this.serialConfig.databits,
        this.serialConfig.parity,
        this.serialConfig.stopbits,
        this.serialConfig.newline);


      if(node.port) {
        if (node.port.serial) {
          if(node.port.serial.isOpen) {
            if(!node.piped) {
              node.piped = true;
              node.port.links++;
              node.port.serial.pipe(node.data_processor);
              node.status({fill: "green", shape: "dot", text: "node-red:common.status.connected"});
            }

          }
        }
      }




      // node.on("input",function(msg) {
      //   if (!msg.hasOwnProperty("payload")) { return; } // do nothing unless we have a payload
      //   var payload = node.port.encodePayload(msg.payload);
      //   node.port.write(payload,function(err,res) {
      //     if (err) {
      //       var errmsg = err.toString().replace("Serialport","Serialport "+node.port.serial.path);
      //       node.error(errmsg,msg);
      //     }
      //   });
      // });
      node.port.on('ready', function() {
        if(!node.piped) {
          node.piped = true;
          node.port.links++;
          node.port.serial.pipe(node.data_processor);
          node.status({fill: "green", shape: "dot", text: "node-red:common.status.connected"});
        }
      });
      node.port.on('closed', function() {
        node.status({fill:"red",shape:"ring",text:"node-red:common.status.not-connected"});
      });
    }
    else {
      this.error(RED._("smithtek.errors.missing-conf"));
    }

    this.on("close", function(done) {
      if(node.piped) {
        node.port.links--;

        node.port.serial.unpipe(node.data_processor);
        node.piped = false;
      }

      if (this.serialConfig && node.port.links<=0) {
        serialPool.close(this.serialConfig.serialport, done);
      }
      else {
        done();
      }


    });





  }
  RED.nodes.registerType("SmithTek Raw In",SmithtekRawIn);


}
