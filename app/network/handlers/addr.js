/*
* Orwell http://github.com/gettocat/orwell
* Platform for building decentralized applications
* MIT License
* Copyright (c) 2017 Nanocat <@orwellcat at twitter>
*/

var thisnode = require('../thisnode');
var protocol = require('../protocol')
var nodes = require('../../db/nodes');
var indexes = require('../../db/indexes')
var config = require('../../../config')

module.exports = function (data, self) {

    if (self)
        return false;

    var key = protocol.getAddressUniq(this.rinfo);
    var d = nodes.get("data/" + key);
    d.top = data.top;
    d.lastMsg = new Date().getTime() / 1000;
    nodes.set("data/" + key, d);

    //recv some addr, check and add if not exist
    for (var i in data.nodes) {
        protocol.addNode(data.nodes[i]);
    }

    var arr = [];
    if (data.top.height > indexes.get('top').height && !indexes.haveblock(data.top.hash)) {
        arr.push({
            sendBack: true,
            type: 'getblocks',
            response: {
                headhash: indexes.get('top').hash,
                offset: 0
            }
        })
    }

    return arr

}