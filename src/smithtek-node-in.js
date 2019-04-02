
const PacketFilterStream = require("./lib/packet-filter-stream");
const Parser = require("./lib/packet-parser");

module.exports = function(RED) {
  "use strict";





  function SmithtekIn(n) {
    RED.nodes.createNode(this,n);
    var node = this;
    this.piped = false;

    this.serial = n.serial;
    // check incoming values
    var header = Buffer.from(n.header,'hex');

    n.repeats = 2;
    n.crc = 1;



    n.timeout = 20;

    let format = [
      {"type": "int32_t", "key": "v1"},
      {"type": "PacketDigitalBinaryElement", "key": "b1"},
      {"type": "PacketDigitalBinaryElement", "key": "b2"},
      {"type": "PacketMarkerBinaryElement", "key": "m1",  "value": [1,2,3,4,5,255,255]},
      {"type": "float", "key": "f1" },
      {"type": "PacketDigitalBinaryElement", "key": "b3"},
      {"type": "TColor", "key": "color1"},
      {"type": "TRGBWColor", "key": "TRGBWColor1"},
      {"type": "TDateTime", "key": "time1"}
    ];


    let parser = new Parser(format);
    n.size = parser.packet_size;

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
      // node.send({"payload": data});
      node.send({"payload": parser.parse(data)});
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
  RED.nodes.registerType("SmithTek In",SmithtekIn);


}
