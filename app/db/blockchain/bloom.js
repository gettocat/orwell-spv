const BloomFilter = require('bloom-filter');
const wallet = require('../wallet')
require('./bitpony_extends');
const bitPony = require('bitpony');
const protocol = require('../../network/protocol');
const events = require("../../events")

let bloom = function (flter) {
    if (!flter)
        flter = {};

    this.falsePositiveRate = 0.01;

    const list = wallet.find(flter);
    this.items = [];
    for (var i in list) {
        this.items.push(list[i].hash160);
    }

    this.create();

}

bloom.prototype.create = function () {
    let list = {};
    this.filter = BloomFilter.create(this.items.length, this.falsePositiveRate);
    for (var i in this.items) {
        this.filter.insert(new Buffer(this.items[i], 'hex'));
    }
}

bloom.prototype.add = function (item) {
    this.items.push(item);
    this.create();
}

bloom.prototype.pack = function () {
    const serialized = this.filter.toObject();
    const hexfilter = bitPony.filterload.write(serialized.vData, serialized.nHashFuncs, serialized.nTweak, serialized.nFlags).toString('hex');
    return hexfilter
}

bloom.prototype.send = function () {

    const hexfilter = this.pack();
    const rinfo = protocol.getUniqAddress(protocol.getRandomNode());
    debug("info", 'send filterload to all', hexfilter)
    events.emit("chain.filter.change", this.filter, hexfilter);
    protocol.sendAll('filterload', {
        'filter': hexfilter
    })

}

bloom.prototype.sendAdd = function () {

    const hexfilter = this.pack();
    const rinfo = protocol.getUniqAddress(protocol.getRandomNode());
    debug("info", 'send filteradd to all', hexfilter)
    protocol.sendAll('filteradd', {
        'filter': hexfilter
    })

}

module.exports = bloom;