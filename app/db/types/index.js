/*
* Orwell http://github.com/gettocat/orwell
* Platform for building decentralized applications
* MIT License
* Copyright (c) 2017 Nanocat <@orwellcat at twitter>
*/

const { app } = require('electron')
const config = require('../../../config')

var _cache = {};
var index = function (collection, options) {
    this.name = collection;
    if (options)
        this.options = options;
    //this.init();
}

index.prototype = {
    dbname: config.net == 'mainnet' ? 'dbindex' : 'dbindextestnet',
    class: null,
    db: null,
    context: null,
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
        if (obj && obj.value) {
            obj.value = value
            this.getDB().gc(this.name).update(obj);
        } else {
            obj = { key: key, value: value };
            this.getDB().gc(this.name).insert(obj);
        }

        //if (this.context != null)
        //    this.contextAdd(key);

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
    find: function (fields) {
        var val = this.getDB().gc(this.name).find(fields);
        return val;
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
        return this.getDB().saveDatabase();
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
    },
    setContext: function (context) {
        this.context = context;
    },
    getContext: function () {
        return this.context;
    },
    getContextList: function () {
        var val = this.getDB().gc('context').findOne({ 'key': this.context });
        if (!val || !val.value)
            val = [];
        else
            val = val.value;

        return val;
    },
    setContextList: function (arr) {

        if (!arr || !(arr instanceof Array))
            arr = [];

        var obj = this.getDB().gc('context').findOne({ 'key': this.context });
        if (obj) {
            obj.value = arr
            this.getDB().gc('context').update(obj);
        } else {
            obj = { key: this.context, value: arr };
            this.getDB().gc('context').insert(obj);
        }

    },
    contextAdd: function (key) {
        var list = this.getContextList();
        if (list.indexOf(this.name + ":" + key) < 0)
            list.push(this.name + ":" + key);

        this.setContextList(list);

    },
    contextRemove: function (key) {

        var list = this.getContextList();
        if (list.indexOf(this.name + ":" + key) >= 0)
            list.splice(list.indexOf(this.name + ":" + key), 1);

        this.setContextList(list);

    },
    deleteDB: function () {
        this.getDB().close();
        this.getDB().deleteDatabase();
        var dbconn = new dbconnection(this.dbname);
        var f = this;
        return dbconn.create()
            .then(function () {
                f.db = null;
                f.init();
                return new Promise(function (resolve) {
                    resolve()
                })
            })
    },
    clearCollection: function() {
        return this.getDB().gc(this.name).clear();
    }


}

module.exports = index;