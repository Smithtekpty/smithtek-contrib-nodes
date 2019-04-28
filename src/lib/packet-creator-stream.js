"use strict";
var stream = require('stream');
var util = require('util');

var PacketCreatorStream = function(opts) {
    var that = this;
    let self = this;
    opts = opts || {};

    stream.Readable.call(this, opts);

    this.stopped = false;

    var frequency = opts.hasOwnProperty('frequency') ? opts.frequency : 1;
    var chunkSize = opts.chunkSize || 1024;
    var initialSize = opts.initialSize || (8 * 1024);
    var incrementAmount = opts.incrementAmount || (8 * 1024);

    self.packetHeader = opts.header || '';

    if (opts.crc) {
        this.crc_length = 1;
        this.crc = (buf) => {
            var xor = 0;
            for (let n = 0; n < buf.length; n++)
            {
                xor = (xor ^ buf[n]) & 0xFF;
            }
            return new Uint8Array([xor]);
        }
    } else {
        this.crc_length = 0;
        this.crc = false;
    }




    var size = 0;
    var buffer = new Buffer.alloc(initialSize);
    var allowPush = false;

    var sendData = function() {
        var amount = Math.min(chunkSize, size);
        var sendMore = false;

        if (amount > 0) {
            var chunk = null;
            chunk = new Buffer.alloc(amount);
            buffer.copy(chunk, 0, 0, amount);

            sendMore = that.push(chunk) !== false;
            allowPush = sendMore;

            buffer.copy(buffer, 0, amount, size);
            size -= amount;
        }

        if(size === 0 && that.stopped) {
            that.push(null);
        }

        if (sendMore) {
            sendData.timeout = setTimeout(sendData, frequency);
        }
        else {
            sendData.timeout = null;
        }
    };

    this.stop = function() {
        if (this.stopped) {
            throw new Error('stop() called on already stopped ReadableStreamBuffer');
        }
        this.stopped = true;

        if (size === 0) {
            this.push(null);
        }
    };

    this.size = function() {
        return size;
    };

    this.maxSize = function() {
        return buffer.length;
    };

    var increaseBufferIfNecessary = function(incomingDataSize) {
        if((buffer.length - size) < incomingDataSize) {
            var factor = Math.ceil((incomingDataSize - (buffer.length - size)) / incrementAmount);

            var newBuffer = new Buffer.alloc(buffer.length + (incrementAmount * factor));
            buffer.copy(newBuffer, 0, 0, size);
            buffer = newBuffer;
        }
    };

    var kickSendDataTask = function () {
        if (!sendData.timeout && allowPush) {
            sendData.timeout = setTimeout(sendData, frequency);
        }
    }

    this.put = function(data, encoding) {
        if (that.stopped) {
            throw new Error('Tried to write data to a stopped ReadableStreamBuffer');
        }

        let packet = undefined;

        if(Buffer.isBuffer(data)) {
            packet = data;
        } else {
            data = data + '';
            packet = Buffer.alloc(Buffer.byteLength(data));
            packet.write(data,0,encoding || 'utf8' );
        }
        let buf = Buffer.alloc(this.packetHeader.length + packet.length + this.crc_length);
        this.packetHeader.copy(buf);
        packet.copy(buf,this.packetHeader.length);
        if(this.crc ) {
            Buffer.from(this.crc(buf.slice(0,this.packetHeader.length + packet.length))).copy(buf, this.packetHeader.length + packet.length);
        }

        increaseBufferIfNecessary(buf.length);
        buf.copy(buffer, size, 0);
        size += buf.length;

        kickSendDataTask();
    };

    this._read = function() {
        allowPush = true;
        kickSendDataTask();
    };
};

util.inherits(PacketCreatorStream, stream.Readable);
module.exports = PacketCreatorStream;
