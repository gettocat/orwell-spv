/*
* Orwell http://github.com/gettocat/orwell
* Platform for building decentralized applications
* MIT License
* Copyright (c) 2017 Nanocat <@orwellcat at twitter>
*/

var loki = require('lokijs');
var appEvents = require('../../events');
var db = {};

module.exports = function (path) {

    var connection = function (dbname) {
        this.dbname = dbname ? dbname : 'db';
        this.inmemory = false;
        this.indexes = false;
    }

    connection.prototype = {
        create: function (inmemory, forindexes) {
            this.inmemory = inmemory;
            this.indexes = forindexes;
            var f = this;
            return new Promise(function (resolve, reject) {
                if (!db[f.dbname]) {

                    if (f.inmemory) {
                        var opts = {};
                    } else
                        var opts = {
                            //adapter: cryptoadapter,
                            //adapter: new lfsa(),
                            autoload: true,
                            autoloadCallback: databaseInitialize,
                            autosave: true,
                            autosaveInterval: 100
                        };

                    if (f.inmemory) {
                        var mem = new loki.LokiMemoryAdapter();
                        opts.adapter = mem;
                    }

                    if (f.indexes) {
                        //some rules for indexes 
                    }

                    console.log('db new creation', path + "/" + f.dbname, opts)
                    db[f.dbname] = new loki(path + '/' + f.dbname, opts);
                    if (f.inmemory)
                        databaseInitialize()

                    appEvents.on("app.before.exit", function () {
                        for (var i in db) {
                            if (db[i])
                                db[i].close();
                        }
                    })

                    function databaseInitialize() {
                        console.log("store " + f.dbname + " loaded");

                        db[f.dbname].gc = function (name) {
                            var coll = db[f.dbname].getCollection(name);
                            if (coll === null) {
                                coll = db[f.dbname].addCollection(name, { clone: !f.inmemory });
                            }

                            return coll;
                        }

                        resolve(db[f.dbname]);
                    }

                } else
                    resolve(db[f.dbname]);
            });
        },
        get: function () {
            return db[this.dbname];
        }
    }

    return connection;

}