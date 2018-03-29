const BigNumber = require('bignumber.js');
const Discord = require('discord.js');
const Web3 = require('web3');

const config = require('./config.json');
const chronosCoreAbi = require('./abi/ChronosCore');

// Create a Discord webhook
const hook = new Discord.WebhookClient(config.webhook.id, config.webhook.token);

// Debug code, print instead of send:
hook.send = (msg) => console.log('-> ' + msg);

// Connect to an Ethereum provider
const web3jsEvents = new Web3(new Web3.providers.WebsocketProvider(config.web3EventsProvider));

const weiToEther = (wei) => {
    if (typeof wei === 'number') {
        return web3jsEvents.utils.fromWei(wei.toString(), 'ether');
    }
    
    return web3jsEvents.utils.fromWei(wei, 'ether');
}

// Subscribe to block headers
web3jsEvents.eth.subscribe('newBlockHeaders', (error, headers) => {
    if (error) {
        console.log(error);
        return;
    }
    
    if (headers && headers.hash) { // Mined block
        if (error) {
            console.log(error);
            return;
        }
        
        console.log("New block:", headers.number);
        
        this.blockTimestamp = Number(headers.timestamp);
    }
});

// Listen to contract events.
for (let i = 0; i < config.contracts.length; i++) {
    const contract = config.contracts[i];
    
    console.log("Initialising:", contract.name);
    
    const contractEvents = new web3jsEvents.eth.Contract(chronosCoreAbi.abi, contract.address);
    
    contractEvents.events.allEvents({fromBlock: 'latest'}, (error, event) => {
        if (error) {
            console.log(error);
            return;
        }
        
        if (event.removed) {
            // Ignore.
            return;
        }
        
        const values = event.returnValues;
        
        if (event.event == 'Play') {
            const wagerIndex = Number(values.wagerIndex);
            const pool = weiToEther(values.newPrizePool);
            
            if (wagerIndex == 0) {
                hook.send("@watcher A new " + contract.name + " game just started! Prize pool: " + Number(pool).toFixed(4) + " Ether. Visit " + contract.url + " to play.");
            } else if (wagerIndex == 9) {
                hook.send(contract.name + " reached 10 wagers! Prize pool: " + Number(pool).toFixed(4) + " Ether. Visit " + contract.url + " to play.");
            } else if (wagerIndex > 9 && wagerIndex % 25 == 24) {
                hook.send(contract.name + " reached " + (wagerIndex + 1) + " wagers! Prize pool: " + Number(pool).toFixed(4) + " Ether. Visit " + contract.url + " to play.");
            }
        } else if (event.event == 'End') {
            const winner = values.winner;
            const pool = weiToEther(values.prize);
            
            hook.send("A game of " + contract.name + " was won by " + winner.substr(0,12) + "! Prize pool: " + Number(pool).toFixed(4) + " Ether.");
        }
    });
}

console.log("Initialised.");
