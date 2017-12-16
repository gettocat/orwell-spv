/*
* Orwell http://github.com/gettocat/orwell
* Platform for building decentralized applications
* MIT License
* Copyright (c) 2017 Nanocat <@orwellcat at twitter>
*/

var util = require('util');
var EventEmitter = require('events').EventEmitter;

var events = function () {

};

// extend the EventEmitter class using our Radio class
util.inherits(events, EventEmitter);
var obj = null;
// we specify that this module is a refrence to the Radio class
module.exports = obj ? obj : obj = new events();