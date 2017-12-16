/*
* Orwell http://github.com/gettocat/orwell
* Platform for building decentralized applications
* MIT License
* Copyright (c) 2017 Nanocat <@orwellcat at twitter>
*/

var routes = require('./handler');
var protocolEvents = require('../events')
var config = require('../../config')
var nodes = require('../db/nodes');

module.exports = recv;

function recv(protocol, type, data, rinfo, self) {

    this.rinfo = rinfo;
    this.type = type;
    this.data = data;
    this.self_message = !!self;
    this.protocol = protocol;
    this.switch();

}

recv.prototype = {
    switch: function () {

        if (!this.self_message)
            nodes.updateRecvTime(this.rinfo);

        if (routes(this.type))
            var data = routes(this.type).apply(this, [this.data, this.self_message]);
        else {
            protocolEvents.emit("protocol.unknowmessage", {
                data: data || {},
                rinfo: this.rinfo
            });

        }

        protocolEvents.emit("protocol.recived." + this.type, {
            data: this.data,
            self: this.self_message,
            rinfo: this.rinfo
        });

        protocolEvents.emit("protocol.recived.*", {
            type: this.type,
            data: this.data,
            self: this.self_message,
            rinfo: this.rinfo
        })

        if (data instanceof Array && !data.length)
            return false;

        if (!(data instanceof Array) && (!data || !data.type))
            return false;

        //if (!method)
        //   return;

        if (data instanceof Array) {

            for (var i in data) {

                var params = [];
                if (data[i].sendBack)
                    params.push(this.rinfo);

                var method = data[i].sendBack ? this.protocol.sendOne : this.protocol.sendAll;
                params.push(data[i].type)
                params.push(data[i].response || {});

                protocolEvents.emit("protocol.sended." + data[i].type, {
                    data: data[i].response || {},
                    emit: !data[i].sendBack,
                    rinfo: this.rinfo
                });

                protocolEvents.emit("protocol.sended.*", {
                    data: data[i].response || {},
                    type: data[i].type,
                    emit: !data[i].sendBack,
                    rinfo: this.rinfo
                })

                method.apply(method, params);

            }

        } else {
            var params = [];
            if (data.sendBack)
                params.push(this.rinfo);

            var method = data.sendBack ? this.protocol.sendOne : this.protocol.sendAll;
            params.push(data.type)
            params.push(data.response || {});

            protocolEvents.emit("protocol.sended." + data.type, {
                data: data.response || {},
                emit: !data.sendBack,
                rinfo: this.rinfo
            });

            protocolEvents.emit("protocol.sended.*", {
                data: data.response || {},
                type: data.type,
                emit: !data.sendBack,
                rinfo: this.rinfo
            })

            method.apply(method, params);
        }

    }

}
