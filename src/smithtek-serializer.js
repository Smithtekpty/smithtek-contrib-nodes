const Serializer = require("./lib/packet-serializer");

module.exports = function(RED) {
  "use strict";

  function SmithtekSerializer(n) {
    RED.nodes.createNode(this,n);
    var node = this;
    let format = JSON.parse(n.json);
    let serializer = new Serializer(format);
    node.on("input",function(msg) {
      node.send({"payload": serializer.serialize(msg.payload)});
    });
  }
  RED.nodes.registerType("SmithTek Serializer",SmithtekSerializer);

}
