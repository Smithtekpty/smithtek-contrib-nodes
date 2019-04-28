
const PacketFilterStream = require("./lib/packet-filter-stream");
const Parser = require("./lib/packet-parser");

module.exports = function(RED) {
    "use strict";

    function SmithtekInParallel(n) {
        RED.nodes.createNode(this,n);
        var node = this;
        this.piped = false;
        this.serial = n.serial;
        // check incoming values
        var header = Buffer.from(n.header,'hex');

        n.repeats = 2;
        n.crc = 1;
        n.timeout = 20;

        this.format =
            [
                {"type": "float", "key": "gps_lat", "label": "GPS Lat"},
                {"type": "float", "key": "gps_lon", "label": "GPS Lon"},
                {"type": "float", "key": "batt_voltage", "label": "Battery Voltage"},
                {"type": "float", "key": "analog_in_1", "label": "Analog input 1"},
                {"type": "float", "key": "analog_in_2", "label": "Analog input 2"},
                {"type": "float", "key": "analog_in_3", "label": "Analog input 3"},
                {"type": "float", "key": "analog_in_4", "label": "Analog input 4"},
                {"type": "float", "key": "analog_in_5", "label": "Analog input 5"},
                {"type": "float", "key": "analog_in_6", "label": "Analog input 6"},
                {"type": "PacketDigitalBinaryElement", "key": "digital_input_1", "label": "Digital input 1"},
                {"type": "PacketDigitalBinaryElement", "key": "digital_input_2", "label": "Digital input 2"},
                {"type": "PacketDigitalBinaryElement", "key": "digital_input_3", "label": "Digital input 3"},
                {"type": "PacketDigitalBinaryElement", "key": "digital_input_4", "label": "Digital input 4"},
                {"type": "PacketDigitalBinaryElement", "key": "digital_input_5", "label": "Digital input 5"},
                {"type": "PacketDigitalBinaryElement", "key": "digital_input_6", "label": "Digital input 6"},
                {"type": "PacketDigitalBinaryElement", "key": "digital_output_1", "label": "Digital output 1"},
                {"type": "PacketDigitalBinaryElement", "key": "digital_output_2", "label": "Digital output 2"},
                {"type": "PacketDigitalBinaryElement", "key": "digital_output_3", "label": "Digital output 3"},
                {"type": "PacketDigitalBinaryElement", "key": "digital_output_4", "label": "Digital output 4"},
                {"type": "PacketDigitalBinaryElement", "key": "digital_output_5", "label": "Digital output 5"},
                {"type": "PacketDigitalBinaryElement", "key": "digital_output_6", "label": "Digital output 6"},
                {"type": "float", "key": "pulse_meter", "label": "Pulse Meter"}
            ]

        ;

        // this.format =
        //     [
        //         {"type": "float", "key": "gps_lat", "label": "GPS Lat"},
        //     ];
        let parser = new Parser(this.format);
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

        this.data_processor.on('data', (function(format) { return function(data) {

            let res = parser.parse(data);
            let ret = [];

            for(let i =0; i< format.length; i++) {
                ret.push({payload: res[format[i].key]});
            }
            node.send(ret);
        }})(this.format));


        this.serialConfig = RED.nodes.getNode(this.serial);


        this.readyFunction = function() {
            if(!node.piped) {
                node.piped = true;
                node.port.links++;
                node.port.serial.pipe(node.data_processor);
                node.status({fill: "green", shape: "dot", text: "node-red:common.status.connected"});
            }
        };

        this.closedFunction = function() {
            node.status({fill:"red",shape:"ring",text:"node-red:common.status.not-connected"});
        }

        if (this.serialConfig) {
            node.port = this.serialConfig.serialPool.get(
                this.serialConfig.serialport,
                this.serialConfig.serialbaud,
                this.serialConfig.databits,
                this.serialConfig.parity,
                this.serialConfig.stopbits,
                this.serialConfig.newline
            );

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

            node.port.on('ready', this.readyFunction);
            node.port.on('closed', this.closedFunction);
        }
        else {
            this.error(RED._("smithtek.errors.missing-conf"));
        }


        // this.on("close", function(done) {
        //     if(node.piped) {
        //         node.port.links--;
        //         node.port.serial.unpipe(node.data_processor);
        //         node.piped = false;
        //     }
        //
        //     if (this.serialConfig && node.port.links<=0) {
        //         serialPool.close(this.serialConfig.serialport, done);
        //     } else {
        //         done();
        //     }
        // });
    }
    RED.nodes.registerType("SmithTek In Parallel",SmithtekInParallel);

    SmithtekInParallel.prototype.close = function() {
        if (this.port) {
            this.port.removeListener('ready', this.readyFunction);
            this.port.removeListener('closed', this.closedFunction);
        }

        if(this.piped) {
            this.port.links--;
            this.port.serial.unpipe(this.data_processor);
            this.piped = false;
        }
        if (this.serialConfig && this.port.links<=0) {
            this.serialConfig.serialPool.close(this.serialConfig.serialport);

        }
        if (RED.settings.verbose) {
            this.log(RED._("SmithtekInParallel.stopped"));
        }
    }
}
