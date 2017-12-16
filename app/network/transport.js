/*
* Orwell http://github.com/gettocat/orwell
* Platform for building decentralized applications
* MIT License
* Copyright (c) 2017 Nanocat <@orwellcat at twitter>
*/

var config = require('../../config');
var protocol = require('./protocol');
var netevent = require('../events')
var nodes = require('../db/nodes')
var p2p = require('./p2p')

module.exports = function () {


    netevent.on("net.connection.add", function (socket, from) {

        var o = {}
        if (from != 'server')
            o = {
                remoteAddress: socket.remoteAddress.replace("::ffff:", ""),
                remotePort: socket.localPort,
                localAddress: socket.localAddress.replace("::ffff:", ""),
                port: socket.remotePort
            };
        else
            o = {
                remoteAddress: socket.remoteAddress.replace("::ffff:", ""),
                remotePort: socket.remotePort,
                localAddress: socket.localAddress.replace("::ffff:", ""),
                port: socket.localPort
            }

        var addr = protocol.getAddressUniq(o)
        debug('info', "add seed " + addr, from);

        var list = nodes.get("connections");
        if (!list || !(list instanceof Array))
            list = [];

        var finded = false;
        for (var i in list) {
            if (list[i] && list[i] == addr) {
                finded = true;
                break;
            }
        }

        if (!finded) {
            list.push(addr);
            nodes.set("connections", list);
        }
        //connection new event
        socket.STATUS = 1;
        netevent.emit("net.connection.new", addr, socket);

        nodes.set("connection/" + addr, socket);
    });

    netevent.on("net.connection.remove", function (addr, from) {

        debug('info', "remove seed " + addr, from);

        var list = nodes.get("connections");
        if (!list || !(list instanceof Array))
            list = [];
        if (list.indexOf(addr) >= 0) {
            list.splice(list.indexOf(addr), 1);
            nodes.set("connections", list);
        }

        try {
            var d = nodes.get("data/" + addr);
            if (d.socket)
                d.socket.destroy();
        } catch (e) {
            console.log('net error', e)
        }

        nodes.remove("connection/" + addr);
        nodes.remove('address/' + addr);
        nodes.remove('data/' + addr);

    })

    netevent.on("net.node.add", function (addr, cb) {

        addNode(addr, function (client) {

            cb({
                remoteAddress: client.remoteAddress,
                remotePort: client.localPort,
                port: client.remotePort
            })

        });

    });

    netevent.on("net.message", function (socket, data, from) {

        if (!data)
            return false;


        function isSelf(address) {
            var os = require('os');
            var finded = false;
            var interfaces = os.networkInterfaces();
            var addresses = [];
            for (var k in interfaces) {
                for (var k2 in interfaces[k]) {
                    var addr = interfaces[k][k2];
                    if (addr.family === 'IPv4' && !addr.internal) {
                        addresses.push(addr.address);
                        if (addr.address == address)
                            finded = true;
                    }
                }
            }


            return address == '127.0.0.1' || finded
        }

        if (!socket.remoteAddress)
            return;
        if (from == 'server')
            var rinfo = { remoteAddress: socket.remoteAddress, remotePort: socket.remotePort, port: socket.localPort };
        else
            var rinfo = { remoteAddress: socket.remoteAddress, remotePort: socket.localPort, port: socket.remotePort };


        nodes.updateRecvBytes(rinfo, new Buffer(data).length)
        var nodeName = protocol.emit(data, rinfo, isSelf(socket.remoteAddress));
    });

    netevent.on("net.error", function (e) {
        var showed = 0;
        if (e.code === 'EADDRINUSE') {
            console.log('Address in use, retrying...');
            showed = 1
        }

        if (e.code === 'ECONNRESET') {
            console.log(e.code + " " + e.remoteAddress + ":" + e.port);
            showed = 1;
        }

        if (e.code == 'ECONNREFUSED') {
            showed = 1;
        }

        if (!showed)
            console.log(e)
    })

    netevent.on("net.send", function (message, rinfo) {

        protocol.checkNodes();
        var nlist = protocol.getNodeList();

        if (!(message instanceof Array))
            message = [message];
        for (var i in message) {
            setTimeout(function (i) {
                var msg = Buffer.concat([
                    message[i],
                    new Buffer(config[config.net].magic, 'hex')
                ]);

                try {
                    if (!rinfo)
                        for (var k in nlist) {
                            var rinf = protocol.getUniqAddress(nlist[k]);
                            nodes.updateSendTime(rinf)
                            nodes.updateSentBytes(rinf, msg.length)
                            send(nlist[k], msg.toString('hex'))
                        }
                    else {
                        nodes.updateSendTime(rinfo)
                        nodes.updateSentBytes(rinfo, msg.length)
                        send(protocol.getAddressUniq(rinfo), msg.toString('hex'));
                    }
                } catch (e) {
                    netevent.emit("net.error", e);
                }
            }, 100 * i, i)

        }


    })


    debug('info', 'init nodes')
    protocol.init();

    function addNode(addr, cb) {
        var a = protocol.getUniqAddress(addr);
        if (!a.remoteAddress)
            return;//cant do here noting
        if (!a.port)
            a.port = config[config.net].port;
        var socket = nodes.get("connection/" + addr);
        if (!socket.STATUS || socket.destroyed === true) {

            //remove old connection
            netevent.emit("net.connection.remove", addr);
            var client = p2p(a.remoteAddress, a.port);

            client.on("connect", function () {
                netevent.emit("net.connection", client);
                netevent.emit("net.connection.add", client);
                cb(client);


                var reconnect = function () {

                    if (!addNode.reconnects[addr])
                        addNode.reconnects[addr] = 0;
                    else
                        addNode.reconnects[addr]++;

                    if (addNode.reconnects[addr] < 5)
                        setTimeout(function () {
                            protocol.addNode(addr, function () {

                                addNode.reconnects[addr] = 0;

                                if (config.debug.peer)
                                    console.log("client " + addr + " reconnected");
                            })
                        }, rand(30, 90));

                };

                client.on("close", reconnect)
                client.on("end", reconnect)

            });



        } else
            cb(socket)

    }

    addNode.reconnects = {};

    function send(addr, msg) {
        var sendmessage = function (msg, socket) {
            socket.write(msg, function () {
            });
        }

        var socket = nodes.get("connection/" + addr);
        if (!socket.STATUS || socket.destroyed === true)
            protocol.addNode(addr, function (rinfo) {
                sendmessage(msg, nodes.get("connection/" + protocol.getAddressUniq(rinfo)));
            })
        else
            try {
                sendmessage(msg, socket);
            } catch (e) {
                protocol.addNode(addr, function (rinfo) {
                    sendmessage(msg, nodes.get("connection/" + protocol.getAddressUniq(rinfo)));
                })
            }
    }


};

var rand = function (min, max) {
    return parseInt(Math.random() * (max - min) + min);
}