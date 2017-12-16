/*
* Orwell http://github.com/gettocat/orwell
* Platform for building decentralized applications
* MIT License
* Copyright (c) 2017 Nanocat <@orwellcat at twitter>
*/

var protocol = require('../protocol');
var thisnode = require('../thisnode')

module.exports = function (data, self) {
    if (data.addr)
        thisnode.addr = data.addr.replace("::ffff:", "");

    if (self)
        return false;

    for (var i in data.nodes) {
        protocol.addNode(data.nodes[i]);
    }
    

    return [{
            sendBack: false,
            type: 'ping',
            response: {}
        }];

}