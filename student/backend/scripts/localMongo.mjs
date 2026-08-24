import { MongoMemoryServer } from 'mongodb-memory-server';

const mongod = await MongoMemoryServer.create({ instance: { port: 27117, ip: '127.0.0.1' } });
console.log('MONGO_READY ' + mongod.getUri());

process.on('SIGINT', async () => { await mongod.stop(); process.exit(0); });
process.on('SIGTERM', async () => { await mongod.stop(); process.exit(0); });
await new Promise(() => {});
