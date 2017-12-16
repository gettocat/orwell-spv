/*
* Orwell http://github.com/gettocat/orwell
* Platform for building decentralized applications
* MIT License
* Copyright (c) 2017 Nanocat <@orwellcat at twitter>
*/

var kventity = require('./types/memory');
var util = require('util');
var obj = null;
var nodes = function () {
    this.name = 'nodes';
    this.options = { inmemory: true };
    this.init();
}

util.inherits(nodes, kventity)

nodes.prototype.updateRecvTime = function (rinfo) {
    var key = rinfo.remoteAddress.replace("::ffff:", "") + "/" + rinfo.remotePort + "/" + rinfo.port
    var d = this.get("data/" + key);
    var temp = d.lastRecv || 0
    d.lastRecv = new Date().getTime() / 1000;
    d.lastMsg = d.lastRecv - temp;
    d.pingTime = d.lastRecv - d.lastSend
    if (d.pingTime < d.minPing)
        d.minPing = d.pingTime;
    this.set("data/" + key, d);
}

nodes.prototype.updateSendTime = function (rinfo) {
    var key = rinfo.remoteAddress.replace("::ffff:", "") + "/" + rinfo.remotePort + "/" + rinfo.port
    var d = this.get("data/" + key);
    d.lastSend = new Date().getTime() / 1000;
    d.pingTime = d.lastSend - d.lastRecv
    if (d.pingTime < d.minPing)
        d.minPing = d.pingTime;
    this.set("data/" + key, d);
}

nodes.prototype.getLastMsg = function (key) {

    var d = this.get("data/" + key);
    return d.lastMsg || 0;

}

nodes.prototype.updateSentBytes = function (rinfo, bytes) {
    var key = rinfo.remoteAddress.replace("::ffff:", "") + "/" + rinfo.remotePort + "/" + rinfo.port
    var d = this.get("data/" + key);
    if (!d.sentBytes)
        d.sentBytes = 0;
    d.sentBytes += bytes;
    this.set("data/" + key, d);
}

nodes.prototype.updateRecvBytes = function (rinfo, bytes) {
    var key = rinfo.remoteAddress.replace("::ffff:", "") + "/" + rinfo.remotePort + "/" + rinfo.port
    var d = this.get("data/" + key);
    if (!d.recvBytes)
        d.recvBytes = 0;
    d.recvBytes += bytes;
    this.set("data/" + key, d);
}

module.exports = obj ? obj : obj = new nodes;