/*
* Orwell http://github.com/gettocat/orwell
* Platform for building decentralized applications
* MIT License
* Copyright (c) 2017 Nanocat <@orwellcat at twitter>
*/

const { app } = require('electron')

var entity = function (name) {
    this.name = name;
    this.init();
}

entity.prototype = {
    name: '',
    class: null,
    db: null, coll: null,
    init: function () {

        if (!this.db) {
            const dbconn = require('./connection')(app.getPath('userData'))
            const dbconnection = new dbconn(this.dbname);
            var db = dbconnection.get()
            this.db = db;
        }


    },
    //keyval
    setKey: function (key, value) {
        var obj = this.getDB().gc(this.name).findOne({ 'key': key });
        if (obj && obj.value) {
            obj.value = value
            this.getDB().gc(this.name).update(obj);
        } else {
            obj1 = { key: key, value: value };
            obj = this.getDB().gc(this.name).insert(obj1);
        }

        this.saveDB();
        return obj;

    },
    getKey: function (key) {
        var val = this.getDB().gc(this.name).findOne({ 'key': key });
        if (!val || !val.value)
            val = {};
        else
            val = val.value;

        return val;
    },
    removeKey: function (key) {
        let val;
        try {
            val = this.getDB().gc(this.name).findOne({ 'key': key });
            if (val)
                this.getDB().gc(this.name).remove(val);
        } catch (e) {

        }
        return !!val;
    },
    //entry
    find: function (fields) {
        var val = this.getDB().gc(this.name).find(fields);
        return val;
    },
    findAndSort: function (fields, sortKey, sortVal, limit, offset) {
        if (!sortVal)
            sortVal = 'asc';

        var val = this.getDB().gc(this.name).chain().find(fields).simplesort(sortKey, sortVal != 'asc').limit(limit || 100).offset(offset || 0)
        return val.data();
    },
    insert: function (data) {
        if (data.id) {
            return this.update(data);
        } else {
            return this.getDB().gc(this.name).insert(data);
        }
        return this.getDB().gc(this.name).insert(data);
    },
    update: function (data) {
        var val = this.getDB().gc(this.name).findOne({ 'id': data.id });
        if (val && val.id && val.$loki) {
            var lid = val.$loki;
            val = data;
            val.$loki = lid;
            return this.getDB().gc(this.name).update(data);
        } else {
            return this.getDB().gc(this.name).insert(data);
        }
    },
    count: function (fields) {
        return this.getDB().gc(this.name).count(fields);
    },
    getCollection: function () {
        return this.getDB().gc(this.name);
    },
    getDB: function () {
        if (!this.db)
            this.init();
        return this.db
    },
    saveDB: function () {
        return this.getDB().saveDatabase();
    },
    load: function (limit, offset, sortby) {

        if (!limit)
            limit = 1000

        if (!offset)
            offset = 0;

        var res = this.getDB().gc(this.name).chain().find();

        if (sortby)
            res = res.simplesort(sortby[0], !!sortby[1]);

        res = res.offset(offset).limit(limit);

        return res.data();

    },
    save: function (tx) {

        this.getDB().gc(this.name).insert(tx);
        return true;

    },
    get: function (hash) {
        var obj = this.getDB().gc(this.name).findOne({ 'hash': hash });
        return obj

    },
    remove: function (hash) {
        var obj = this.getDB().gc(this.name).findOne({ hash: hash });
        this.getDB().gc(this.name).remove(obj);
        return true;
    },

}

module.exports = entity;