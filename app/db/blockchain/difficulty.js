/*
* Orwell http://github.com/gettocat/orwell
* Platform for building decentralized applications
* MIT License
* Copyright (c) 2017 Nanocat <@orwellcat at twitter>
*/

const BN = require('bn.js');
const config = require('../../../config');
const maxtarget = 0x1d00ffff, satoshicoin = 1e8;

function difficulty(bits) {
    var b = new BN(bits2target(maxtarget), 16);
    var m = new BN(bits2target(bits), 16);
    return (b.div(m).toString(10));
}

function bits2target(bits) {
    return bits2targetBN(bits).toBuffer('be', 32);
}

function bits2targetBN(bits) {
    var p = parts(bits), F = new BN(8 * (p[0] - 3), 10), tmp = new BN(2, 10).pow(F), R = new BN(p[1], 10).mul(tmp);
    return R;
}

function target2bits(target) {

    //To convert a positive integer to 'compact' format, we:
    //convert the integer into base 256.
    if (BN.isBN(target))
        var b256 = target;
    else
        var b256 = new BN(target, 'hex', 'be')
    //if the first (most significant) digit is greater than 127 (0x7f), prepend a zero digit
    var i = b256.toBuffer();
    if (i[0] > 0x7f)
        i = Buffer.concat([new Buffer([0x0]), i]);
    //the first byte of the 'compact' format is the number of digits in the above base 256 representation, including the prepended zero if it's present
    var exp = i.length;
    //the following three bytes are the first three digits of the above representation. If less than three digits are present, then one or more of the last bytes of the compact representation will be zero.
    var bytes = i.slice(0, 3);
    if (bytes.length < 3) {

        if (bytes.length == 2) {
            bytes = Buffer.concat([new Buffer([bytes[0], bytes[1]]), [0x0]]);
        }

        if (bytes.length == 1) {
            bytes = new Buffer([bytes[0], 0x0, 0x0])
        }

        if (bytes.length == 0) {
            bytes = new Buffer([0x0, 0x0, 0x0]);
        }

    }

    return parseInt(parseInt(exp).toString(16) + bytes.toString('hex'), 16)

}

function parts(bits) {
    var exp = bits >> 24,
        mant = bits & 0xffffff;
    return [exp, mant];
}

function checkBits(block) {

    //check difficulty for block:
    //find 12 prevs blocks

    if (block.height == 0)//genesis check
        return 0x1effffff

    if (block.height <= 199)
        return maxtarget;

    var blockchain = require('../blockchain').chain

    var prevhash;
    if (block.hashPrevBlock || block.prev_block)
        prevhash = block.hashPrevBlock || block.prev_block;
    else
        throw new Error('can not find parentblock wth hash ' + prevhash);
    var list = blockchain.findPreviousBlocks(prevhash, 12);//block hash can not exists in blockchain, soo we need check 11+parent from parent.

    if (!list.length)
        return false;//something wrong

    var first = list[list.length - 1];
    var last = list[0];

    var nActualTimespan = last.time - first.time;
    return getBitsRange(nActualTimespan, last);
}

function bits() {
    var blockchain = require('../blockchain').chain

    var list = blockchain.findLastBlocks(12)//one hour
    var first = list[list.length - 1];
    var last = list[0];

    //console.log(first.height, last.height, last.time - first.time);

    if (last.height < 199)
        return 0x1d00ffff;

    if (!list.length || list.height == 0)//genesis check
        return maxtarget

    // Limit adjustment step
    var nActualTimespan = last.time - first.time;
    return getBitsRange(nActualTimespan, last);
}

function getBitsRange(nActualTimespan, block) {

    var nTargetSpacing = 5 * 60 //one block per N sec
    var nTargetTimespan = 12 * nTargetSpacing //diff ajustment//one hour

    //every block
    //console.log(nActualTimespan, 'smaller than', nTargetTimespan - (nTargetTimespan / 4), nActualTimespan < (nTargetTimespan - (nTargetTimespan / 4)))
    //if (nActualTimespan < (nTargetTimespan / 4))
    //    nActualTimespan = nTargetTimespan / 4


    if (nActualTimespan < (nTargetTimespan - (nTargetTimespan / 4)))
        nActualTimespan = (nTargetTimespan - (nTargetTimespan / 4));


    //console.log(nActualTimespan, 'bigger than', nTargetTimespan + (nTargetTimespan / 2), nActualTimespan > (nTargetTimespan + (nTargetTimespan / 2)))
    //if (nActualTimespan >= (nTargetTimespan * 4))
    //   nActualTimespan = (nTargetTimespan * 4);

    if (nActualTimespan > (nTargetTimespan + (nTargetTimespan / 2)))
        nActualTimespan = (nTargetTimespan + (nTargetTimespan / 2));

    // Retarget
    var bn = bits2targetBN(block.bits);
    target = bn.mul(new BN(nActualTimespan)).div(new BN(nTargetTimespan));
    var limit = bits2targetBN(maxtarget);

    if (target.cmp(limit) == 1) {//target can not be bigger than limit
        target = limit;
    }

    return target2bits(target);
}

function compare(needBits, haveBits) {

    var netTarget = bits2targetBN(needBits);
    var blockTarget = bits2targetBN(haveBits);
    var res = blockTarget.cmp(netTarget); //block target must me less or equal of network target

    return res == -1 || res == 0
}

function log2(x) {
    var result = 0;
    if (!BN.isBN(x))
        return -1;
    while (x.toString(10) > 0) {
        x = x.shrn(1);
        result++;
    }

    return result;
}

function moreThen(a, b) {
    var a_ = new BN(a), b_ = new BN(b);
    var res = new BN(a).lt(new BN(b))

    var la = log2(a_);
    return res;
}

/**
 * 
 * @returns hash/sec value
 */
function currHashRate() {
    var dif = difficulty(bits());
    var res = new BN(2, 10).pow(new BN(32, 10)).mul(new BN(dif, 10)).div(new BN(300, 10));
    return res.toString(10)

}

function currHashRoundToNewHash() {

    var dif = difficulty(bits());
    var res = new BN(2, 10).pow(new BN(48, 10)).mul(new BN(dif, 10)).div(new BN(0xffff, 16));
    return res.toString(10)

}

function hashRateDurationNewHash() {
    var dif = difficulty(bits());
    var res = new BN(2, 10).pow(new BN(32, 10)).mul(new BN(dif, 10)).div(new BN(currHashRate(), 10));
    return res.toString(10)
}

function getBlockValue(fee, height) {

    if (height == 0)
        return 50 * satoshicoin + fee;

    if (height <= 190)
        return new BN(height * 100 * satoshicoin).add(new BN(fee)).toString(10);

    if (height >= 191 && height <= 199) {
        return new BN(13500 * satoshicoin).add(new BN(fee)).toString(10);//1 936 000
    }

    if (height == 200) {
        return new BN(15000 * satoshicoin).add(new BN(fee)).toString(10);//1 951 000
    }

    //this period need me to create some infrastructure and finish some projects.
    if (height > 200 && height <= 10000) {
        return new BN(5 * satoshicoin).add(new BN(fee)).toString(10);//49 000
    }

    //10001: 2e6 coins in use.
    //20 coin for block. 1e6 coin for 100 000 height ~ for 1 year. All coins will be in use after ~10 years.
    var reward = 0;
    if (height > 10000 && height <= 110000)
        reward = 60;

    if (height > 110000 && height <= 210000)
        reward = 30;

    if (height > 210000 && height <= 410000)
        reward = 15;

    if (height > 410000 && height <= 1010000)
        reward = 10;

    return new BN(reward).mul(new BN(satoshicoin)).add(new BN(fee)).toString(10);
}

function less(target, then) {
    var b = new BN(target);
    var k = new BN(then);
    return b.lt(k);
}

function offset(diff) {
    var res = new BN(2).pow(new BN(208));
    return res.mul(new BN(0xffff)).div(diff).toString(16);
}

module.exports = {
    difficulty: difficulty,
    target2bits: target2bits,
    bits2target: bits2target,
    bits2targetBN: bits2targetBN,
    less: less,
    parts: parts,
    bits: bits,
    offset: offset,
    compare: compare,
    moreThen: moreThen,
    checkBits: checkBits,
    getBitsRange: getBitsRange,
    getBlockValue: getBlockValue,
    hashrate: {
        currHashRate: currHashRate,
        currHashRoundToNewHash: currHashRoundToNewHash,
        hashRateDurationNewHash: hashRateDurationNewHash,
    },
}

