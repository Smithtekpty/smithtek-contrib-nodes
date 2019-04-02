const Parser = require("./lib/packet-parser");

module.exports = function(RED) {
  "use strict";

  function SmithtekParserParallel(n) {
    RED.nodes.createNode(this,n);
    var node = this;

    let format = JSON.parse(n.json);
    // let format = [
    //   {"type": "int32_t", "key": "v1"},
    //   {"type": "PacketDigitalBinaryElement", "key": "b1"},
    //   {"type": "PacketDigitalBinaryElement", "key": "b2"},
    //   {"type": "PacketMarkerBinaryElement", "key": "m1", "len":7, "value": [1,2,3,4,5,255,255]},
    //   {"type": "float", "key": "f1" },
    //   {"type": "PacketDigitalBinaryElement", "key": "b3"},
    //   {"type": "TColor", "key": "color1"},
    //   {"type": "TRGBWColor"},
    //   {"type": "TDateTime", "key": "time1"}
    // ];



    let parser = new Parser(format);
    node.on("input",function(msg) {
      if(!Buffer.isBuffer(msg.payload)) {
        return;
      }
      // node.send({"payload": parser.parse(msg.payload)});
      let res = parser.parse(msg.payload);
      let ret = [];

      for(let i =0; i< format.length; i++) {
        ret.push({payload: res[format[i].key]});
      }
       node.send(ret);
    });
  }
  RED.nodes.registerType("SmithTek Parser Parallel",SmithtekParserParallel);

}
