/**
 * Copyright 2013,2015 IBM Corp.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 **/
var events = require("events");
var SerialPort = require('serialport');


module.exports = function (RED) {
    "use strict";
    var settings = RED.settings;
    var bufMaxSize = 32768;  // Max serial buffer size, for inputs...

    function newConnection(port, baud, databits, parity, stopbits, newline) {
        var obj = {
            _emitter: new events.EventEmitter(),
            serial: null,
            _closing: false,
            tout: null,
            on: function (a, b) {
                this._emitter.on(a, b);
            },
            close: function (cb) {
                this.serial.close(cb);
            },
            write: function (m, cb) {
                this.serial.write(m, cb);
            },
            removeListener: function (a, b) {
                this._emitter.removeListener(a, b);
            },
        links: 0,
        };

        obj.serial = new SerialPort(port, {
            baudRate: baud,
            dataBits: databits,
            parity: parity,
            stopBits: stopbits,
            parser: SerialPort.parsers.raw,
            autoOpen: false
        }, function (err) {
            if (err) {
                if (RED.settings.verbose) {
                    RED.log.error("serial port error (on new):" + err.message);
                }
                obj.serial.emit('error', err);
            }
        });

        var openSerial = function() {
            obj.serial.open(function (err) {
                if (err) {
                    if (RED.settings.verbose) {
                        RED.log.error("serial port " + "error (on open):" + err.message );
                    }
                    obj.serial.emit('error', err);
                }
            })
        }

        obj.serial.on('error', function (err) {
            RED.log.error("serial port " + port + " error " + err);
            obj._emitter.emit('closed');
            obj.tout = setTimeout(function () {
                openSerial();
            }, settings.serialReconnectTime);
        });
        obj.serial.on('close', function () {
            if (!obj._closing) {
                RED.log.error("serial port " + port + " closed unexpectedly");
                obj._emitter.emit('closed');
                obj.tout = setTimeout(function () {
                    openSerial();
                }, settings.serialReconnectTime);
            } else {
                RED.log.info("serial port " + port + " closed");
            }
        });
        obj.serial.on('open', function () {
            RED.log.info("serial port " + port + " opened at " + baud + " baud " + databits + "" + parity.charAt(0).toUpperCase() + stopbits);
            if (obj.tout) {
                clearTimeout(obj.tout);
            }
            //obj.serial.flush();
            obj._emitter.emit('ready');
        });
        obj.serial.on('data', function (d) {
            for (var z = 0; z < d.length; z++) {
                obj._emitter.emit('data', d[z]);
            }
        });
        obj.serial.on("disconnect", function () {
            RED.log.error("serial port " + port + " gone away");
        });
        openSerial();
        return obj;
    }

    var serialPool = (function () {
        var connections = {};
        if (RED.settings.verbose) {
            RED.log.error(RED._("serial.pool.created"));
        }
        return {
            get: function (port, baud, databits, parity, stopbits, newline) {
                var id = port;
                if (!connections[id]) {
                    connections[id] = newConnection(port, baud, databits, parity, stopbits, newline);
                }
                return connections[id];
            },
            close: function (port, done) {
                if (connections[port]) {
                    if (connections[port].tout != null) {
                        clearTimeout(connections[port].tout);
                    }
                    connections[port]._closing = true;
                    try {
                        connections[port].close(function () {
                            // if (RED.settings.verbose) {
                            //     RED.log.error( RED._("serial.port.closed") );
                            // }

                            if(done) { done(); }
                        });
                    }
                    catch (err) {
                        if(done) { done(err); }
                    }
                    delete connections[port];
                } else {
                    if(done) { done(); }
                }
            }
        }
    }());


    // TODO: 'serialPool' should be encapsulated in SerialPortNode

    function SerialPortNode(n) {
        RED.nodes.createNode(this, n);
        this.serialport = n.serialport;
        this.newline = n.newline;
        this.addchar = n.addchar || "false";
        this.serialbaud = parseInt(n.serialbaud) || 57600;
        this.databits = parseInt(n.databits) || 8;
        this.parity = n.parity || "none";
        this.stopbits = parseInt(n.stopbits) || 1;
        this.bin = n.bin || "false";
        this.out = n.out || "char";
        this.serialPool = serialPool;
    }

    RED.nodes.registerType("smithtek-serial-port", SerialPortNode);

    function SmithtekSerialOutNode(n) {
        RED.nodes.createNode(this, n);
        this.serial = n.serial;
        this.serialConfig = RED.nodes.getNode(this.serial);

        if (this.serialConfig) {
            var node = this;
            node.port = serialPool.get(this.serialConfig.serialport,
                this.serialConfig.serialbaud,
                this.serialConfig.databits,
                this.serialConfig.parity,
                this.serialConfig.stopbits,
                this.serialConfig.newline);
            this.port.links++;
            node.addCh = "";
            if (node.serialConfig.addchar == "true" || node.serialConfig.addchar === true) {
                node.addCh = this.serialConfig.newline.replace("\\n", "\n").replace("\\r", "\r").replace("\\t", "\t").replace("\\e", "\e").replace("\\f", "\f").replace("\\0", "\0"); // jshint ignore:line
            }
            node.on("input", function (msg) {
                if (msg.hasOwnProperty("payload")) {
                    var payload = msg.payload;
                    if (!Buffer.isBuffer(payload)) {
                        if (typeof payload === "object") {
                            payload = JSON.stringify(payload);
                        } else {
                            payload = payload.toString();
                        }
                        payload += node.addCh;
                    } else if (node.addCh !== "") {
                        payload = Buffer.concat([payload, new Buffer.from(node.addCh)]);
                    }
                    node.port.write(payload, function (err, res) {
                        if (err) {
                            var errmsg = err.toString().replace("Serialport", "Serialport " + node.port.serial.path);
                            node.error(errmsg, msg);
                        }
                    });
                }
            });

            this.readyFunction = function () {
                node.status({fill: "green", shape: "dot", text: "connected"});
            };

            this.closedFunction = function () {
                node.status({fill: "red", shape: "ring", text: "not connected"});
            }

            node.port.on('ready', this.readyFunction);
            node.port.on('closed', this.closedFunction);

        } else {
            this.error("missing serial config");
        }

        this.on("close", function (done) {
            if (this.serialConfig) {
                serialPool.close(this.serialConfig.serialport, done);
            } else {
                done();
            }
        });
    }

    RED.nodes.registerType("smithtek-serial-out", SmithtekSerialOutNode);

    SmithtekSerialOutNode.prototype.close = function() {

        if (this.port) {
            this.port.removeListener('ready', this.readyFunction);
            this.port.removeListener('closed', this.closedFunction);
            this.port.links--;
        }

        if (this.serialConfig && this.port.links<=0) {
            this.serialConfig.serialPool.close(this.serialConfig.serialport);

        }
        if (RED.settings.verbose) {
            this.log(RED._("SmithtekSerialInNode.stopped"));
        }
    }



    function SmithtekSerialInNode(n) {
        RED.nodes.createNode(this, n);
        this.serial = n.serial;
        this.serialConfig = RED.nodes.getNode(this.serial);

        if (this.serialConfig) {
            var node = this;
            node.tout = null;
            var buf;
            if (node.serialConfig.out != "count") {
                buf = new Buffer.alloc(bufMaxSize);
            }
            else {
                buf = new Buffer.alloc(Number(node.serialConfig.newline));
            }
            var i = 0;
            node.status({fill: "grey", shape: "dot", text: "unknown"});
            node.port = serialPool.get(this.serialConfig.serialport,
                this.serialConfig.serialbaud,
                this.serialConfig.databits,
                this.serialConfig.parity,
                this.serialConfig.stopbits,
                this.serialConfig.newline
            );

            var splitc = "\n";
            if (typeof node.serialConfig.newline === 'string') {
                if (node.serialConfig.newline.substr(0, 2) == "0x") {
                    splitc = new Buffer.alloc([parseInt(node.serialConfig.newline)]);
                } else {
                    splitc = new Buffer.from(node.serialConfig.newline.replace("\\n", "\n").replace("\\r", "\r").replace("\\t", "\t").replace("\\e", "\e").replace("\\f", "\f").replace("\\0", "\0")); // jshint ignore:line
                }
            }
            this.dataFunction = function (msg) {
                // single char buffer
                if ((node.serialConfig.newline === 0) || (node.serialConfig.newline === "")) {
                    if (node.serialConfig.bin !== "bin") {
                        node.send({"payload": String.fromCharCode(msg)});
                    }
                    else {
                        node.send({"payload": new Buffer.from([msg])});
                    }
                }
                else {
                    // do the timer thing
                    if (node.serialConfig.out === "time") {
                        if (node.tout) {
                            i += 1;
                            buf[i] = msg;
                        }
                        else {
                            node.tout = setTimeout(function () {
                                node.tout = null;
                                var m = new Buffer.alloc(i + 1);
                                buf.copy(m, 0, 0, i + 1);
                                if (node.serialConfig.bin !== "bin") {
                                    m = m.toString();
                                }
                                node.send({"payload": m});
                                m = null;
                            }, node.serialConfig.newline);
                            i = 0;
                            buf[0] = msg;
                        }
                    }
                    // count bytes into a buffer...
                    else if (node.serialConfig.out === "count") {
                        buf[i] = msg;
                        i += 1;
                        if (i >= parseInt(node.serialConfig.newline)) {
                            var m = new Buffer.alloc(i);
                            buf.copy(m, 0, 0, i);
                            if (node.serialConfig.bin !== "bin") {
                                m = m.toString();
                            }
                            node.send({"payload": m});
                            m = null;
                            i = 0;
                        }
                    }
                    // look to match char...
                    else if (node.serialConfig.out === "char") {
                        buf[i] = msg;
                        i += 1;
                        if ((msg === splitc[0]) || (i === bufMaxSize)) {
                            var n = new Buffer.alloc(i);
                            buf.copy(n, 0, 0, i);
                            if (node.serialConfig.bin !== "bin") {
                                n = n.toString();
                            }
                            node.send({"payload": n});
                            n = null;
                            i = 0;
                        }
                    }
                    else {
                        node.log("should never get here");
                    }
                }
            };
            this.readyFunction = function () {
                node.status({fill: "green", shape: "dot", text: "connected"});
            };

            this.closedFunction = function () {
                node.status({fill: "red", shape: "ring", text: "not connected"});
            }

            node.port.links++;
            node.port.on('data', this.dataFunction);
            node.port.on('ready', this.readyFunction);
            node.port.on('closed', this.closedFunction);

        } else {
            this.error("missing serial config");
        }

    }

    RED.nodes.registerType("smithtek-serial-in", SmithtekSerialInNode);

    SmithtekSerialInNode.prototype.close = function() {

        if (this.port) {
            this.port.removeListener('data', this.dataFunction);
            this.port.removeListener('ready', this.readyFunction);
            this.port.removeListener('closed', this.closedFunction);
            this.port.links--;
        }

        if (this.serialConfig && this.port.links<=0) {
            this.serialConfig.serialPool.close(this.serialConfig.serialport);

        }
        if (RED.settings.verbose) {
            this.log(RED._("SmithtekSerialInNode.stopped"));
        }
    }


    RED.httpAdmin.get("/serialports", RED.auth.needsPermission('serial.read'), function (req, res) {
        SerialPort.list(function (err, ports) {
            res.json(ports);
        });
    });
}
