"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (k !== "default" && Object.prototype.hasOwnProperty.call(mod, k)) __createBinding(result, mod, k);
    __setModuleDefault(result, mod);
    return result;
};
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const baileys_1 = __importStar(require("@adiwajshing/baileys"));
const logger_1 = __importDefault(require("@adiwajshing/baileys/lib/Utils/logger"));
const logger = logger_1.default.child({});
logger.level = 'trace';
const useStore = !process.argv.includes('--no-store');
const doReplies = !process.argv.includes('--no-reply');
// external map to store retry counts of messages when decryption/encryption fails
// keep this out of the socket itself, so as to prevent a message decryption/encryption loop across socket restarts
// const msgRetryCounterMap: MessageRetryMap = { }
// the store maintains the data of the WA connection in memory
// can be written out to a file & read from it
const store = useStore ? (0, baileys_1.makeInMemoryStore)({ logger }) : undefined;
store === null || store === void 0 ? void 0 : store.readFromFile('./baileys_store_multi.json');
// save every 10s
setInterval(() => {
    store === null || store === void 0 ? void 0 : store.writeToFile('./baileys_store_multi.json');
}, 10000);
const { state, saveState } = (0, baileys_1.useSingleFileAuthState)('./auth_info_multi.json');
// start a connection
const startSock = () => __awaiter(void 0, void 0, void 0, function* () {
    // fetch latest version of WA Web
    const { version, isLatest } = yield (0, baileys_1.fetchLatestBaileysVersion)();
    console.log(`using WA v${version.join('.')}, isLatest: ${isLatest}`);
    const sock = (0, baileys_1.default)({
        version,
        logger,
        printQRInTerminal: true,
        auth: state,
        // implement to handle retries
        getMessage: (key) => __awaiter(void 0, void 0, void 0, function* () {
            return {
                conversation: 'hello'
            };
        })
    });
    store === null || store === void 0 ? void 0 : store.bind(sock.ev);
    const sendMessageWTyping = (msg, jid) => __awaiter(void 0, void 0, void 0, function* () {
        yield sock.presenceSubscribe(jid);
        yield (0, baileys_1.delay)(500);
        yield sock.sendPresenceUpdate('composing', jid);
        yield (0, baileys_1.delay)(2000);
        yield sock.sendPresenceUpdate('paused', jid);
        yield sock.sendMessage(jid, msg);
    });
    // sock.ev.on('call', item => console.log('recv call event', item))
    sock.ev.on('chats.set', item => console.log(`recv ${item.chats.length} chats (is latest: ${item.isLatest})`));
    sock.ev.on('messages.set', item => console.log(`recv ${item.messages.length} messages (is latest: ${item.isLatest})`));
    sock.ev.on('contacts.set', item => console.log(`recv ${item.contacts.length} contacts`));
    sock.ev.on('messages.upsert', (m) => __awaiter(void 0, void 0, void 0, function* () {
        console.log(JSON.stringify(m, undefined, 2));
        const msg = m.messages[0];
        if (!msg.key.fromMe && m.type === 'notify' && doReplies) {
            console.log('replying to', m.messages[0].key.remoteJid);
            yield sock.sendReadReceipt(msg.key.remoteJid, msg.key.participant, [msg.key.id]);
            yield sendMessageWTyping({ text: 'Hello there!' }, msg.key.remoteJid);
        }
    }));
    sock.ev.on('messages.update', m => console.log(m));
    sock.ev.on('message-receipt.update', m => console.log(m));
    sock.ev.on('presence.update', m => console.log(m));
    sock.ev.on('chats.update', m => console.log(m));
    sock.ev.on('contacts.upsert', m => console.log(m));
    sock.ev.on('connection.update', (update) => {
        var _a, _b;
        const { connection, lastDisconnect } = update;
        if (connection === 'close') {
            // reconnect if not logged out
            if (((_b = (_a = lastDisconnect === null || lastDisconnect === void 0 ? void 0 : lastDisconnect.error) === null || _a === void 0 ? void 0 : _a.output) === null || _b === void 0 ? void 0 : _b.statusCode) !== baileys_1.DisconnectReason.loggedOut) {
                startSock();
            }
            else {
                console.log('Connection closed. You are logged out.');
            }
        }
        console.log('connection update', update);
    });
    // listen for when the auth credentials is updated
    sock.ev.on('creds.update', saveState);
    return sock;
});
startSock();
