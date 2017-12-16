var config = {
    net: 'mainnet',
    agent: "OrwellSPV official",
    title: "Orwell lightweight wallet (official build %build%) %action%",
    agent_version: 0x00000010,
    mainnet: {
        port: 33001,
        magic: 'ff4c2b1e',
    },
    testnet: {
        port: 32001,
        magic: 'afe1ffcd'
    },
    blockchain: {
        txversion: 1,
        version: 5,
        persistenindex: true,
        block_size: 1e7,
        satoshicoin: 1e8,
        max_coins: 20e6,
    },
    nodes: [
        'kenny.node.orwellcoin.org',
        'piter.node.orwell.media',
        'morty.node.telescr.in',
    ],
    wallet: {
        type: 'random', // random now is one variant. Later: seed wallet will be added
        changeAddress: true, //every time create new address for change on this account. Dont work for datascript transactions
        fee: {
            minimum: 10,
            medium: 20,
            maximum: 50
        },
        operationfee: {
            create: 1e6,
            write: 10,
            settings: 100,
        }
    },
    debug: {
        blockchain: {
            blockvalidate: true,
            orphanblock: true,
            txvalidate: true,
            indexing: true,
            sync: true,
            utxo: true,
        }
    }
}



module.exports = config;