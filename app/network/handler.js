/*
* Orwell http://github.com/gettocat/orwell
* Platform for building decentralized applications
* MIT License
* Copyright (c) 2017 Nanocat <@orwellcat at twitter>
*/

module.exports = function (item, self) {

    try {
        return require('./handlers/' + item)
    } catch (e) {
        debug('error', 'can not find handler ' + item)
    }
}