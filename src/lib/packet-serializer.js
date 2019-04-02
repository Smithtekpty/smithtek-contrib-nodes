const moment =  require("moment");


//bit field sequence longer than 4-bytes is not supported.



module.exports = function(format) {
"use strict";
  let self = this;
  this.format = format;
  this.packet_size = 0;

  let bit_length = 0;

  for(let i =0; i< this.format.length; i++) {

    if(( this.format[i].type != "PacketDigitalBinaryElement") && (bit_length != 0)) {
      this.packet_size += Math.ceil(bit_length/8);
      bit_length =0;
    }

    if(!this.format[i].hasOwnProperty('key')) {
      this.format[i].key = "_key_"+i;
    }

    switch(this.format[i].type) {
      case 'uint8_t':
        this.packet_size += 1;
        break

      case 'uint16_t':
        this.packet_size += 2;
        break


      case 'uint32_t':

        this.packet_size += 4;
        break


      case 'int8_t':

        this.packet_size += 1;
        break

      case 'int16_t':

        this.packet_size += 2;
        break


      case 'int32_t':

        this.packet_size += 4;
        break

      case 'PacketDigitalBinaryElement':
        bit_length++;
        break

      case 'PacketMarkerBinaryElement':
        this.packet_size += format[i].len;
        break;

      case 'float':
        // 32-bit floating value

        this.packet_size += 4;
        break

      case 'TColor':

        //   struct TColor
        // {
        //   public:
        //     uint8_t Red;
        //   uint8_t Green;
        //   uint8_t Blue;
        //   uint8_t Alpha = 0;
        // parser.array(this.format[i].key,{'type': "uint8" , 'length': 4,
        //   formatter: function(data) {
        //     return {
        //       'red': data[0],
        //       'green': data[1],
        //       'blue': data[2],
        //       'alpha': data[3]
        //     }
        //   }
        // });
        this.packet_size += 4;
        break

      case 'TRGBWColor':
        // struct TRGBWColor
        // {
        //   public:
        //     uint8_t Red;
        //     uint8_t Green;
        //     uint8_t Blue;
        //     uint8_t White;

        // parser.array(this.format[i].key,{
        //   'type': "uint8" ,
        //   'length': 4,
        //   formatter: function(data) {
        //     return {
        //       'red': data[0],
        //       'green': data[1],
        //       'blue': data[2],
        //       'white': data[3]
        //     }
        //   }
        // });
        this.packet_size += 4;
        break

      case 'TDateTime':
        // Do not change the order! Date Must be after Time for pcket communication!
        // int32_t Time; // Number of milliseconds since midnight
        // int32_t Date; // One plus number of days since 1/1/0001


        // parser.array(format[i].key,{'type': 'int32le' , 'length': 2,
        //   formatter: function(data) {
        //     return this.moment("0001-01-01T00:00:00+00:00").add(data[1]-1,'days').add(data[0],'ms').utc().toDate();
        //   }
        // });
        this.packet_size += 8;
        break
    }
  }
 // final
  if(  bit_length != 0) {
    this.packet_size += Math.ceil(bit_length/8);
    bit_length =0;
  }


  this.serialize = function(data) {
    let buf = Buffer.alloc(this.packet_size);
    let offset = 0;

    let bit_length = 0;
    let mybyte = 0x00;

    for(let i =0; i< this.format.length; i++) {

      if(( this.format[i].type != "PacketDigitalBinaryElement") && (bit_length != 0)) {
        buf.writeUInt8(mybyte, offset)
        offset += 1;
        bit_length =0;
        mybyte = 0x00;
      }

      if(bit_length == 8) {
        buf.writeUInt8(mybyte, offset)
        offset += 1;
        bit_length =0;
        mybyte = 0x00;
      }


      if(!this.format[i].hasOwnProperty('key')) {
        this.format[i].key = "_key_"+i;
      }

      switch(this.format[i].type) {
        case 'uint8_t':
          buf.writeUInt8(data[this.format[i].key], offset)
          offset += 1;
          break

        case 'uint16_t':
          buf.writeUInt16LE(data[this.format[i].key], offset)
          offset += 2;
          break

        case 'uint32_t':
          buf.writeUInt32LE(data[this.format[i].key], offset)
          offset += 4;
          break


        case 'int8_t':
          buf.writeInt8(data[this.format[i].key], offset)
          offset += 1;
          break

        case 'int16_t':
          buf.writeInt16LE(data[this.format[i].key], offset)
          offset += 2;
          break


        case 'int32_t':
          buf.writeInt32LE(data[this.format[i].key], offset)
          offset += 4;
          break

        case 'PacketDigitalBinaryElement':
          bit_length++;
          mybyte= mybyte << 1 ;
          if(data[this.format[i].key]) {
            mybyte |= 1;
          }
          break

        case 'PacketMarkerBinaryElement':
          {
          let inbuf = Buffer.from(this.format[i].value);
          inbuf.copy(buf, offset);
          offset += inbuf.length;
          }
          break;

        case 'float':
          // 32-bit floating value
          buf.writeFloatLE(data[this.format[i].key], offset)
          offset += 4;
          break

        case 'TColor':
          //   struct TColor
          // {
          //   public:
          //     uint8_t Red;
          //   uint8_t Green;
          //   uint8_t Blue;
          //   uint8_t Alpha = 0;
          buf.writeUInt8(data[this.format[i].key].red, offset)
          offset += 1;
          buf.writeUInt8(data[this.format[i].key].green, offset)
          offset += 1;
          buf.writeUInt8(data[this.format[i].key].blue, offset)
          offset += 1;
          buf.writeUInt8(data[this.format[i].key].alpha, offset)
          offset += 1;
          break

        case 'TRGBWColor':
          // struct TRGBWColor
          // {
          //   public:
          //     uint8_t Red;
          //     uint8_t Green;
          //     uint8_t Blue;
          //     uint8_t White;

          buf.writeUInt8(data[this.format[i].key].red, offset)
          offset += 1;
          buf.writeUInt8(data[this.format[i].key].green, offset)
          offset += 1;
          buf.writeUInt8(data[this.format[i].key].blue, offset)
          offset += 1;
          buf.writeUInt8(data[this.format[i].key].white, offset)
          offset += 1;

          break

        case 'TDateTime':
          // Do not change the order! Date Must be after Time for pcket communication!
          // int32_t Time; // Number of milliseconds since midnight
          // int32_t Date; // One plus number of days since 1/1/0001
          let date = moment(data[this.format[i].key]);
          buf.writeInt32LE( ((date.utc().hour()*60 + date.utc().minute())*60 + date.utc().second())*1000 + date.utc().millisecond(), offset);
          offset += 4;
          buf.writeInt32LE(date.diff(moment("0001-01-01T00:00:00+00:00"), 'days')+1, offset);
          offset += 4;
          break
      }
    }
    if(bit_length != 0) {
      buf.writeUInt8(mybyte, offset)
      offset += 1;
      bit_length =0;
      mybyte = 0x00;
    }

    return buf;
  }

  return self;

}
