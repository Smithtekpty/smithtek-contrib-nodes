const moment =  require("moment");
var BinaryParser = require("binary-parser").Parser;

//bit field sequence longer than 4-bytes is not supported.



module.exports = function(format) {
"use strict";
  let parser = new BinaryParser()
    .endianess("little");

  parser.moment = moment;
  parser.packet_size = 0;

  let bit_length = 0;

  for(let i =0; i< format.length; i++) {

    if(( format[i].type != "PacketDigitalBinaryElement") && (bit_length != 0)) {
        parser.packet_size += Math.ceil(bit_length/8);
        bit_length =0;
    }

    if(!format[i].hasOwnProperty('key')) {
      format[i].key = "_key_"+i;
    }

    switch(format[i].type) {
      case 'uint8_t':
        parser.uint8(format[i].key);
        parser.packet_size += 1;
        break

      case 'uint16_t':
        parser.uint16(format[i].key);
        parser.packet_size += 2;
        break


      case 'uint32_t':
        parser.uint32(format[i].key);
        parser.packet_size += 4;
        break


      case 'int8_t':
        parser.int8(format[i].key);
        parser.packet_size += 1;
        break

      case 'int16_t':
        parser.int16(format[i].key);
        parser.packet_size += 2;
        break


      case 'int32_t':
        parser.int32(format[i].key);
        parser.packet_size += 4;
        break

      case 'PacketDigitalBinaryElement':
        parser.bit1(format[i].key);
        bit_length++;
        break

      case 'PacketMarkerBinaryElement':
        parser.array(format[i].key,{'type': "uint8" , 'length': format[i].value.length});
        parser.packet_size += format[i].len;
        break;

      case 'float':
        // 32-bit floating value
        parser.float(format[i].key);
        parser.packet_size += 4;
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
        parser.packet_size += 4;
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
        parser.packet_size += 4;
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
        parser.packet_size += 8;
        break
    }
  }
 // final
  if(  bit_length != 0) {
    parser.packet_size += Math.ceil(bit_length/8);
    bit_length =0;
  }


  return parser;

}
