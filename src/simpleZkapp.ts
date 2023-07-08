import { method, state, State, SmartContract, AccountUpdate, isReady, Mina, PrivateKey, shutdown, UInt64 } from 'snarkyjs';

await isReady;

export class SimpleZkApp extends SmartContract {
    @state(UInt64) X = State<UInt64>();

    @method doSthA(x: UInt64, adminPriKey: PrivateKey) {
        // check if admin
        this.address.assertEquals(adminPriKey.toPublicKey());
        // update
        this.X.set(x);
    }
}

let Blockchain = Mina.LocalBlockchain();
Mina.setActiveInstance(Blockchain);

let feePayerKey = Blockchain.testAccounts[0].privateKey;
let feePayer = feePayerKey.toPublicKey();
console.log('feePayer:', feePayer.toBase58())

let zkappKey1 = PrivateKey.random();
let zkappAddress1 = zkappKey1.toPublicKey();
let zkapp1 = new SimpleZkApp(zkappAddress1);
console.log('zkappAddress1:', zkappAddress1.toBase58())

let zkappKey2 = PrivateKey.random();
let zkappAddress2 = zkappKey2.toPublicKey();
console.log('zkappAddress2:', zkappAddress2.toBase58())
let zkapp2 = new SimpleZkApp(zkappAddress2);

console.log('compile');
await SimpleZkApp.compile();


console.log('deploy');
let tx = await Mina.transaction(feePayer, () => {
    AccountUpdate.fundNewAccount(feePayer, 2);
    zkapp1.deploy();
    zkapp2.deploy();
});
// 序列化tx 发送给第三方...
let jsonTx = tx.toJSON();
// 网络接收到txJson, 反序列化成Tx对象
tx = Mina.Transaction.fromJSON(JSON.parse(jsonTx));

tx.transaction.feePayer.lazyAuthorization = {kind:'lazy-signature'};
tx.transaction.accountUpdates[0].lazyAuthorization = {kind:'lazy-signature'};
tx.sign([feePayerKey]);
console.log('feePayerKey signed...');
console.log(tx.toPretty());

tx.transaction.accountUpdates[1].lazyAuthorization = {kind:'lazy-signature'};
tx.sign([zkappKey1]);
console.log('zkappKey1 signed...');
console.log(tx.toPretty());

tx.transaction.accountUpdates[2].lazyAuthorization = {kind:'lazy-signature'};
tx.sign([zkappKey2]);
console.log('zkappKey2 signed...');
console.log(tx.toPretty());

await tx.send();

console.log('end...');


shutdown();