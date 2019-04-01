const moment =  require("moment");
var Parser = require("binary-parser").Parser;

//bit field sequence longer than 4-bytes is not supported.
let parser = new Parser()
  .endianess("little");

parser.moment = moment;



module.exports = function(RED) {
  "use strict";

  function SmithtekParser(n) {
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


    for(let i =0; i< format.length; i++) {

      if(!format[i].hasOwnProperty('key')) {
        format[i].key = "_key_"+i;
      }

      switch(format[i].type) {
        case 'uint8_t':
          parser.uint8(format[i].key)
          break

        case 'uint16_t':
          parser.uint16(format[i].key)
          break


        case 'uint32_t':
          parser.uint32(format[i].key)
          break


        case 'int8_t':
          parser.int8(format[i].key)
          break

        case 'int16_t':
          parser.int16(format[i].key)
          break


        case 'int32_t':
          parser.int32(format[i].key)
          break

        case 'PacketDigitalBinaryElement':
          parser.bit1(format[i].key)
          break

        case 'PacketMarkerBinaryElement':
          parser.array(format[i].key,{'type': "uint8" , 'length': format[i].len});
          break;

        case 'float':
          parser.float(format[i].key)
          break

        case 'TColor':

          //   struct TColor
          // {
          //   public:
          //     uint8_t Red;
          //   uint8_t Green;
          //   uint8_t Blue;
          //   uint8_t Alpha = 0;
          parser.array(format[i].key,{'type': "uint8" , 'length': 4,
            formatter: function(data) {
              return {
                'red': data[0],
                'green': data[1],
                'blue': data[2],
                'alpha': data[3]
              }
            }
          });
          break

        case 'TRGBWColor':
          // struct TRGBWColor
          // {
          //   public:
          //     uint8_t Red;
          //     uint8_t Green;
          //     uint8_t Blue;
          //     uint8_t White;

          parser.array(format[i].key,{
            'type': "uint8" ,
            'length': 4,
            formatter: function(data) {
              return {
                'red': data[0],
                'green': data[1],
                'blue': data[2],
                'white': data[3]
              }
            }
          });
          break

        case 'TDateTime':
          // Do not change the order! Date Must be after Time for pcket communication!
          // int32_t Time; // Number of milliseconds since midnight
          // int32_t Date; // One plus number of days since 1/1/0001


          parser.array(format[i].key,{'type': 'int32le' , 'length': 2,
            formatter: function(data) {
              return this.moment("0001-01-01T00:00:00+00:00").add(data[1]-1,'days').add(data[0],'ms').utc().toDate();
            }
          });
          break
      }
    }


    node.on("input",function(msg) {
      if(!Buffer.isBuffer(msg.payload)) {
        return;
      }


      node.send({"payload": parser.parse(msg.payload)});

    });
  }
  RED.nodes.registerType("SmithTek Parser",SmithtekParser);

}