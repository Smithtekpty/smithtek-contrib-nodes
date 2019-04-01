const SerialPort = require('serialport');
var streamBuffers = require('stream-buffers');




var myWritableStreamBuffer = new streamBuffers.WritableStreamBuffer({
  initialSize: (100 * 1024),   // start at 100 kilobytes.
  incrementAmount: (10 * 1024) // grow by 10 kilobytes each time buffer overflows.
});

// const address = Buffer.from('4142','hex').readInt16BE(0);

const address = Buffer.from('4142','hex');
const len = 6;


const serialport = new SerialPort('/dev/ttyUSB0', {'baudRate': 9600}, (e) => {
  if(e) {
    console.error("error: "+e);
  }

});

// console.log(port);


// const encoder = new SlipEncoder({ bluetoothQuirk: true })
// encoder.pipe(port).on('error', function(e){
//   console.error("Error"+e)}
//   );
// encoder.emit("Test");
// port.emit("0x650x0A\n");





// decoder.on('data', function(packet) {
//   console.log('Got packet: ['+ packet.length  +']',packet.toString());
//   try {
//     // check packet length
//     if(packet.length >4) {
//       // check crc
//       if (crc16(packet.slice(0,-2)) === packet.readUInt16LE(packet.length -2) ) {
//         // check address
//         if(packet.readInt16BE(0) === address) {
//
//           let packet_data = packet.slice(2,-2);
//           console.log('Decoder data:',packet_data.toString());
//         } else {
//           console.log('Invalid packet address:',packet.toString());
//           // throw new Error("Invalid packet address");
//         }
//       } else {
//         console.log('Invalid packet CRC data:',packet.toString());
//         // throw new Error("Invalid packet CRC");
//       }
//     } else {
//       throw new Error("Invalid packet length");
//     }
//
//
//
//
//
//     // if(packet.length <4) {
//     //   throw new Error("Invalid packet");
//     // }
//     //
//     // let packet_data = packet.slice(0,-2);
//     // let packet_crc = packet.readUInt16LE(packet.length -2);
//     //
//     // // check crc
//     // if (crc16(packet_data) !== packet_crc ) {
//     //   // throw new Error("Invalid CRC");
//     //   console.log("Invalid CRC");
//     // }
//     //
//     // if(packet.readInt16BE(0) !== address) {
//     //   // throw new Error("Address invalid");
//     //   console.log("Address invalid");
//     // }
//     //
//     // console.log("Target address = ", packet.readInt16BE(0));
//     //
//     // console.log('Decoder data:');
//     // console.log(packet_data.toString());
//
//   } catch (e) {
//     console.error("error: "+e);
//   }
//
//   console.log("-----------------------------");
//
// })

// serialport.pipe(decoder);



serialport.pipe(myWritableStreamBuffer);




let startBuffer = Buffer.alloc(0);
let middleBuffer = Buffer.alloc(0);
let endBuffer = Buffer.alloc(0);

let buffer = Buffer.alloc(0);
let packet;

serialport.on('data', function(data) {
  // buffer = buffer.ap
  // indexOf(address);

  console.log("Serial data:",data.toString('hex'));
  console.log("Buffer length", myWritableStreamBuffer.size() );

})

let data = Buffer.from([65,66,65,66,67,68,67,68]);
let buf = Buffer.allocUnsafe(2);

// buf.writeUInt16LE(crc16(data),0);
// encoder.write(Buffer.concat([data,buf]));

// encoder.write(data);
// encoder.end();



