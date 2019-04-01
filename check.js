'use strict';

const moment =  require("moment");
var Parser = require("binary-parser").Parser;

//bit field sequence longer than 4-bytes is not supported.
let parser = new Parser()
  .endianess("little");

parser.moment = moment;



let format = [
  {'type': 'int32_t', 'key': 'v1'},
  {'type': 'PacketDigitalBinaryElement', 'key': 'b1'},
  {'type': 'PacketDigitalBinaryElement', 'key': 'b2',},
  {'type': 'PacketMarkerBinaryElement', 'key': 'm1', len:7, 'value': [1,2,3,4,5,255,255]},
  {'type': 'float', 'key': 'f1',  'caption': ''},
  {'type': 'PacketDigitalBinaryElement', 'key': 'b3'},
  {'type': 'TColor', 'key': 'color1'},
  {'type': 'TRGBWColor', 'key': 'rgbw1'},
  {'type': 'TDateTime', 'key': 'time1'},

  // {'type': '', 'key': '', 'value': '', 'caption': ''},
];



for(let i =0; i< format.length; i++) {

  switch(format[i].type) {
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


// console.log("moment",moment.format());

// var parser = new Parser()
//   .endianess("little")
//   .int32le("id" )
//   .bit1("b1")
//   .bit1("b2", {formatter: (data) => {    return (data)? true : false ;  }})
//   .bit1("b3", {formatter: (data) => {    return (data)? true : false ;  }})
//   .bit1("b4", {formatter: (data) => {    return (data)? true : false ;  }})
//   .bit1("b5", {formatter: (data) => {    return (data)? true : false ;  }})
//   .bit1("b6", {formatter: (data) => {    return (data)? true : false ;  }})
//   .bit1("b7", {formatter: (data) => {    return (data)? true : false ;  }})
//   .bit1("b8", {formatter: (data) => {    return (data)? true : false ;  }})
//   .bit1("b9")
//   .bit1("b10")
//   .bit1("b11")
//   .bit1("b12")
//   .bit1("b13")
//   .bit1("b14")
//   .bit1("b15")
//   .bit1("b16")
//   .bit1("b17")
//   .bit1("b18")
//   .bit1("b19")
//   .bit1("b20")
//   .bit1("b21")
//   .bit1("b22")
//   .bit1("b23")
//   .bit1("b24")
//   .bit1("b25")
//   .bit1("b26")
//   .bit1("b27")
//   .bit1("b28")
//   .bit1("b29")
//   .bit1("b30")
//   .uint8("test")
//
//
// ;




// Parse buffer and show result
// console.log(parser.parse(Buffer.from([20,0,0,0,3,3,3,3,3,3,3,3,3,3])));
console.log(parser.parse(Buffer.from([236,255,255,255,3,1,2,3,4,5,255,255,0,0,72,196,1,127,153,178,0,25,51,76,102,0,0,0,0,36,63,11,0])));


// var parser = require('packet').createPacketizer({}).createParser("length: b16, address: b32, name: b8z");

// var serializer = require("packet").createSerializer();
// serializer.packet("header", "b8 => type, b16 => length, b32 => extra");
// serializer.packet("data", "b16 => sequence, b16 => crc");
//
//
// const format = {
//   'int32_t': (data) => '-i32',
//   'PacketMarkerBinaryElement': (data) => {},
//   'float': 'l32f',
//   'TColor': () => {},
//   'TRGBWColor': () => {},
//   'TDateTime': () => {}
//
//
// };
//
// let format = [
//   {'type': 'int32_t', 'key': '', 'value': '', 'caption': ''},
//   {'type': '', 'key': '', 'value': '', 'caption': ''},
//
//
// ]
//
//
//   let data = [20,0,0,0,3];
//
//
// pack


// console.log(parser.parse([ 0x01, 0xFF, 0x01, 0x00, 0x00, 0x00, 0x01, 0x02, 0x00 ]));