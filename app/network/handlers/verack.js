/*
* Orwell http://github.com/gettocat/orwell
* Platform for building decentralized applications
* MIT License
* Copyright (c) 2017 Nanocat <@orwellcat at twitter>
*/

var nodes = require('../../db/nodes');
var config = require('../../../config');
var indexes = require('../../db/indexes')
var protocol = require('../protocol');
var netEvents = protocolEvents = require('../../events')

module.exports = function (data, self) {

    if (self)
        return false;

    var key = protocol.getAddressUniq(this.rinfo);
    var d = nodes.get("data/" + key);
    d.rinfo = this.rinfo;
    d.ackSended = 1;
    d.inited = 1;
    //d.lastMsg = new Date().getTime() / 1000;
    d.pingTime = new Date().getTime() / 1000 - d.startPing;
    if (d.pingTime < d.minPing)
        d.minPing = d.pingTime;
    delete d.startPing;
    nodes.set("data/" + key, d);
    nodes.set('address/' + key, data.nodeName);

    netEvents.emit("net.node.init" + key, key)
    protocolEvents.emit("protocol.node.added", key, protocol.getUniqAddress(key))

    var arr = [];
    const { bloom, txlist } = require('../../db/blockchain')
    filter = new bloom()
    const hexfilter = filter.pack();

    if (txlist.getFilter()!=hexfilter)
        txlist.setFilter(hexfilter);

    //need to send filter message BEFORE emit chain.netsync.block.end, because in this event we send getblockdata. 
    
    protocol.sendOne(this.rinfo, 'filterload', {
        filter: hexfilter
    })
    

    if (d.top.height > indexes.get('top').height) {
        arr.push({
            sendBack: true,
            type: 'getblocks',
            response: {
                headhash: indexes.get('top').hash,
                offset: 0
            }
        })
    } else
        netEvents.emit("chain.netsync.block.end")

    arr.push({
        sendBack: true,
        type: 'activenodes',
        response: {
            addr: this.rinfo.remoteAddress.replace("::ffff:", ""),
            nodes: protocol.exceptNode(this.rinfo.remoteAddress.replace("::ffff:", ""))
        }
    });

    return arr;
}