"use strict";

let PacketCreatorStream = require("./lib/packet-creator-stream");

module.exports = function(RED) {
  "use strict";
  function SmithtekOut(n) {

    RED.nodes.createNode(this,n);
    var node = this;
    this.piped = false;

    this.serial = n.serial;
    // check incoming values
    var header = Buffer.from(n.header,'hex');

    // n.delay = parseInt(n.delay,10);
    // if(isNaN(n.delay) || n.delay<0) {
    //   this.error(RED._("smithtek.errors.invalid-delay"));
    //   node.status({fill:"red",shape:"ring",text:"node-red:common.status.not-connected"});
    //   return;
    // }
    //
    //
    // n.repeats = parseInt(n.repeats,10);
    // if(isNaN(n.repeats)) {
    //   this.error(RED._("smithtek.errors.invalid-repeats"));
    //   node.status({fill:"red",shape:"ring",text:"node-red:common.status.not-connected"});
    //   return;
    // }
    //
    // n.size = parseInt(n.size,10);
    // if(isNaN(n.size) || n.size<0) {
    //   this.error(RED._("smithtek.errors.invalid-size"));
    //   node.status({fill:"red",shape:"ring",text:"node-red:common.status.not-connected"});
    //   return;
    // }
    n.delay = 20;
    n.size = 1;
    n.repeats = 2;
    n.crc = true;

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
        node.data_processor.put((msg.payload?1:0));
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



  RED.nodes.registerType("SmithTek Out",SmithtekOut);

}
