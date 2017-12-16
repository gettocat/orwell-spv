/*
* Orwell http://github.com/gettocat/orwell
* Platform for building decentralized applications
* MIT License
* Copyright (c) 2017 Nanocat <@orwellcat at twitter>
*/

var protocol = require('../protocol');
var sysmsg = require('../../events')
var thisnode = require('../thisnode')

module.exports = function (data, self) {

    if (self) {
        return false;
    }

    if (data.node.name == thisnode.name) 
        sysmsg.emit("network.inited", this.rinfo.remoteAddress);
    
    protocol.addNode(data.remoteAddress);

    return {
    }

}