/*
* Orwell http://github.com/gettocat/orwell
* Platform for building decentralized applications
* MIT License
* Copyright (c) 2017 Nanocat <@orwellcat at twitter>
*/
const { app } = require('electron')
var _cache = {};//need cache becauseof speed
var index = function (collection, options) {
    this.name = collection;
    if (options)
        this.options = options;
    this.init();
}

index.prototype = {
    dbname: 'memindex',
    class: null,
    db: null,
    init: function () {

        if (!this.db) {
            const dbconnection = require('./connection')(app.getPath('userData'))
            const dbconn = new dbconnection(this.dbname);
            const db = dbconn.get()
            this.db = db;
        }


    },
    set: function (key, value) {
        var obj = this.getDB().gc(this.name).findOne({ 'key': key });
        if (obj) {
            obj.value = value
            this.getDB().gc(this.name).update(obj);
        } else {
            obj = { key: key, value: value };
            this.getDB().gc(this.name).insert(obj);
        }

        this.setCache(key, value);
        this.save();
        return obj;

    },
    get: function (key) {
        var val = this.getCache(key);
        if (!val) {
            val = this.getDB().gc(this.name).findOne({ 'key': key });
            if (!val || !val.value)
                val = {};
            else
                val = val.value;
        }
        return val;
    },
    find: function (fields, ord) {
        var val = this.getDB().gc(this.name).chain().find(fields);
        if (ord) {
            val.simplesort(ord[0], ord[1] || false);
        }
        return val.data();
    },
    remove: function (key) {
        var val = this.getDB().gc(this.name).findOne({ 'key': key });
        if (val)
            this.getDB().gc(this.name).remove(val);

        return !!val;
    },
    getCollection: function () {
        return this.getDB().gc(this.name);
    },
    getDB: function () {
        if (!this.db)
            this.init();
        return this.db
    },
    save: function () {
        //return this.getDB().saveDatabase();
    },
    setCache: function (key, val) {
        if (!_cache[this.name])
            _cache[this.name] = {};
        _cache[this.name][key] = val;
    },
    getCache: function (key) {
        if (!_cache[this.name])
            _cache[this.name] = {};
        return _cache[this.name][key] || null;
    }

}

module.exports = index;