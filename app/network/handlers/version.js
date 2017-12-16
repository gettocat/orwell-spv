/*
* Orwell http://github.com/gettocat/orwell
* Platform for building decentralized applications
* MIT License
* Copyright (c) 2017 Nanocat <@orwellcat at twitter>
*/

var nodes = require('../../db/nodes');
var indexes = require('../../db/indexes');
var config = require('../../../config');
var protocol = require('../protocol')

module.exports = function (data, self) {

    if (self)
        return false;

    var key = "data/" + protocol.getAddressUniq(this.rinfo);
    var d = nodes.get(key);
    d.startPing = new Date().getTime();
    nodes.set(key, {
        initiator: d.initiator,
        rinfo: this.rinfo,
        top: data.lastblock,
        ackSended: 1,
        conntime: new Date().getTime() / 1000,
        services: data.services || 0,
        agent: protocol.getUserAgent(),
        relay: !!data.relay,
    })

    nodes.set('address/' + protocol.getAddressUniq(this.rinfo), data.nodeName);

    if (!d.initiator)
        return [{
                sendBack: true,
                type: 'version',
                response: {
                    version: config.blockchain.version || 0,
                    lastblock: indexes.get('top'),
                    nodeName: protocol.getNodeName(),
                    agent: protocol.getUserAgent(),
                    services: 2,
                    relay: false
                }
            },
            {
                sendBack: true,
                type: 'verack',
                response: {}
            }];
    

    return {
        sendBack: true,
        type: 'verack',
        response: {}
    }

}