/*
 * Orwell http://github.com/gettocat/orwell
 * Platform for building decentralized applications
 * MIT License
 * Copyright (c) 2017 Nanocat <@orwellcat at twitter>
 */

var util = require('./util');
var merkle = require('merkle-tools')

function merkle_() {

}

merkle_.tree = function (arr) {
    var m = new merkle()
    for (var i in arr) {
        m.addLeaf(util.reverseBuffer(new Buffer(arr[i], 'hex')).toString('hex'))
    }

    m.makeBTCTree(true);
    return util.reverseBuffer(new Buffer(m.getMerkleRoot(), 'hex')).toString('hex')
}


merkle_.getProof = function (block, txIndex) {


    var m = new merkle()
    for (var i in block.tx) {
        m.addLeaf(util.reverseBuffer(new Buffer(block.tx[i].hash, 'hex')).toString('hex'))
    }


    m.makeBTCTree(true);
    var proof = m.getProof(txIndex)
    m.resetTree();
    return proof;
}

merkle_.validateProof = function (proof_obj, targetHash, merkleRoot) {
    var m = new merkle();
    return m.validateProof(proof_obj, util.reverseBuffer(new Buffer(targetHash, 'hex')), util.reverseBuffer(new Buffer(merkleRoot, 'hex')), true)
}

module.exports = merkle_;