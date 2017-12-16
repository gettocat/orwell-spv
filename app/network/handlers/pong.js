/*
* Orwell http://github.com/gettocat/orwell
* Platform for building decentralized applications
* MIT License
* Copyright (c) 2017 Nanocat <@orwellcat at twitter>
*/

var thisnode = require('../thisnode');
var protocol = require('../protocol')
var nodes = require('../../db/nodes');

module.exports = function (data, self) {

    if (self)
        return false;

    thisnode.updateCounters(data.nodeName)
    //save last pong from client. Client is alive

    var key = "data/" + protocol.getAddressUniq(this.rinfo);
    var d = nodes.get(key);

    d.pingTime = new Date().getTime() / 1000 - d.startPing;
    if (d.pingTime < d.minPing)
        d.minPing = d.pingTime;
    delete d.startPing;
    nodes.set(key, d)

    return {
    }

}