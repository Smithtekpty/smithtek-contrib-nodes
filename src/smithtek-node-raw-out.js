"use strict";
var stream = require('stream');
var util = require('util');

var PacketCreatorStream = function(opts) {
  var that = this;
  let self = this;
  opts = opts || {};

  stream.Readable.call(this, opts);

  this.stopped = false;

  var frequency = opts.hasOwnProperty('frequency') ? opts.frequency : 1;
  var chunkSize = opts.chunkSize || 1024;
  var initialSize = opts.initialSize || (8 * 1024);
  var incrementAmount = opts.incrementAmount || (8 * 1024);

  self.packetHeader = opts.header || '';

  if (opts.crc) {

    console.log('Enable crc');
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




  var size = 0;
  var buffer = new Buffer(initialSize);
  var allowPush = false;

  var sendData = function() {
    var amount = Math.min(chunkSize, size);
    var sendMore = false;

    if (amount > 0) {
      var chunk = null;
      chunk = new Buffer(amount);
      buffer.copy(chunk, 0, 0, amount);

      sendMore = that.push(chunk) !== false;
      allowPush = sendMore;

      buffer.copy(buffer, 0, amount, size);
      size -= amount;
    }

    if(size === 0 && that.stopped) {
      that.push(null);
    }

    if (sendMore) {
      sendData.timeout = setTimeout(sendData, frequency);
    }
    else {
      sendData.timeout = null;
    }
  };

  this.stop = function() {
    if (this.stopped) {
      throw new Error('stop() called on already stopped ReadableStreamBuffer');
    }
    this.stopped = true;

    if (size === 0) {
      this.push(null);
    }
  };

  this.size = function() {
    return size;
  };

  this.maxSize = function() {
    return buffer.length;
  };

  var increaseBufferIfNecessary = function(incomingDataSize) {
    if((buffer.length - size) < incomingDataSize) {
      var factor = Math.ceil((incomingDataSize - (buffer.length - size)) / incrementAmount);

      var newBuffer = new Buffer(buffer.length + (incrementAmount * factor));
      buffer.copy(newBuffer, 0, 0, size);
      buffer = newBuffer;
    }
  };

  var kickSendDataTask = function () {
    if (!sendData.timeout && allowPush) {
      sendData.timeout = setTimeout(sendData, frequency);
    }
  }

  this.put = function(data, encoding) {
    if (that.stopped) {
      throw new Error('Tried to write data to a stopped ReadableStreamBuffer');
    }

    let packet = undefined;

    if(Buffer.isBuffer(data)) {
      packet = data;
    } else {
      data = data + '';
      packet = Buffer.alloc(Buffer.byteLength(data));
      packet.write(data,0,encoding || 'utf8' );
    }
    let buf = Buffer.alloc(this.packetHeader.length + packet.length + this.crc_length);
    this.packetHeader.copy(buf);
    packet.copy(buf,this.packetHeader.length);
    if(this.crc ) {
      Buffer.from(this.crc(buf.slice(0,this.packetHeader.length + packet.length))).copy(buf, this.packetHeader.length + packet.length);
    }

    increaseBufferIfNecessary(buf.length);
    buf.copy(buffer, size, 0);
    size += buf.length;

    kickSendDataTask();
  };

  this._read = function() {
    allowPush = true;
    kickSendDataTask();
  };
};

util.inherits(PacketCreatorStream, stream.Readable);






module.exports = function(RED) {
  "use strict";
  function SmithtekRawOut(n) {

    RED.nodes.createNode(this,n);
    var node = this;
    this.piped = false;

    this.serial = n.serial;
    // check incoming values
    var header = Buffer.from(n.header,'hex');

    n.delay = parseInt(n.delay,10);
    if(isNaN(n.delay) || n.delay<0) {
      this.error(RED._("smithtek.errors.invalid-delay"));
      node.status({fill:"red",shape:"ring",text:"node-red:common.status.not-connected"});
      return;
    }


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


    var header_array = [];
    for (var i = 0; i< n.repeats; i++) {
      header_array.push(header);
    }


    this.data_processor = new PacketCreatorStream({
      // bufferSize: (100 * 1024),   // start at 100 kilobytes.
      header: Buffer.concat(header_array),
      frequency: n.delay,
      crc: n.crc,
      chunkSize: n.size
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




      node.on("input",function(msg) {
        if (!msg.hasOwnProperty("payload")) { return; } // do nothing unless we have a payload
        node.data_processor.put(msg.payload);
        // var payload = node.port.encodePayload(msg.payload);
        // node.port.write(payload,function(err,res) {
        //   if (err) {
        //     var errmsg = err.toString().replace("Serialport","Serialport "+node.port.serial.path);
        //     node.error(errmsg,msg);
        //   }
        // });
      });



      node.port.on('ready', function() {
        if(!node.piped) {
          node.piped = true;
          node.port.links++;
          node.data_processor.pipe(node.port.serial);
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
        console.log('Serial port closing!!!');
        serialPool.close(this.serialConfig.serialport, done);
      }
      else {
        done();
      }


    });

  }



  RED.nodes.registerType("SmithTek Raw Out",SmithtekRawOut);

}