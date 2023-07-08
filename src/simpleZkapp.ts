import { method, state, State, SmartContract, AccountUpdate, Experimental, fetchAccount, fetchLastBlock, Field, isReady, MerkleMap, Mina, Poseidon, PrivateKey, PublicKey, Reducer, shutdown, Signature, Types, UInt32, UInt64, fetchTransactionStatus } from 'snarkyjs';


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


/*
let isLocalBlockChain = false;
let consumerAddr = PublicKey.fromBase58('B62qrif8tae3Qy6WQPf6cgMTqNR1GS6yR4LEjtZTjbB5zWNwQZSbDwF');
const consumerContract = new ConsumerContract(consumerAddr);
let consumerAcctInfo = await syncAcctInfo(consumerAddr, Field(1), isLocalBlockChain);

console.log('consumerAcctInfo: ', JSON.stringify(consumerAcctInfo));

*/
/*
let voteDelegateContractAddr = PublicKey.fromBase58('B62qkPRCm5uRskyDboKt9FgjWdkuFxp25XbmTdrMsbEyiA6ZGjT4xKk');
const voteDelegateContract = new VoteDelegateContract(voteDelegateContractAddr);

let events = await voteDelegateContract.fetchEvents();
console.log(`fetchEvents(): `, JSON.stringify(events));
console.log('ggg',
  PublicKey.fromBase58('B62qoxLNPrb2Ne2rMsw9ULCP6RdD3rDjavefnUDLTif6raajW4pLX4g').equals(
    (events.filter((e) => {
      return e.type == 'init-delegate-target';
    })[0].event.data) as unknown as PublicKey

  ).toBoolean());



let zkAppAddress = PublicKey.fromBase58('B62qrePMS3fhmBXdWMw2ieMjedcKYqvizMHdBvh6wEdERqQLaMAL1Wd');
const zkApp = new XTokenContract(zkAppAddress);
let zkAppAcctInfo = await syncAcctInfo(zkAppAddress, Field(1), isLocalBlockChain);

let tokenId = zkApp.token.id;
let userPubKey = PublicKey.fromBase58('B62qpLAd2fk5KKAcHE2n7KwyfPLbCppHJzoRnHNJRbh3pTPtrAgetvF');
let userPubKey1 = PublicKey.fromBase58('B62qiuNiXtrbKwc1njA3ZtPMrewfEJTpq9wi9J2gcdY4KJgjuumUMms');

console.log(`userPubKey: ${(await syncAcctInfo(userPubKey, tokenId, isLocalBlockChain)).balance.value.toBigInt() == 1n}`);
console.log(`userPubKey1: ${(await syncAcctInfo(userPubKey1, tokenId, isLocalBlockChain)).balance.value.toBigInt() == 3n}`);

console.log('done.done.done.done..........');
*/
/* 
console.log('fetchAccount By minaexplorer: ', await fetchAccount({
  publicKey:'B62qqiteE8zNBDT9LoMVKSkXkRWh8uYMQWQiDqgaQujnDQUwubf4fWN'},
  'https://proxy.berkeley.minaexplorer.com/graphql'  
))
 */
/* let Blockchain2 = Mina.Network({
  mina: 'https://berkeley.minascan.io/graphql',
  archive: 'https://archive.berkeley.minaexplorer.com/',
});
Mina.setActiveInstance(Blockchain2);
 */
/* 
console.log('fetchAccount By minascan: ', await fetchAccount({
  publicKey: 'B62qqiteE8zNBDT9LoMVKSkXkRWh8uYMQWQiDqgaQujnDQUwubf4fWN',
  tokenId: 'wti6nJoVVfQyz19in78QtdWG4zBkZ3YLcqfMms4Arr8mFLzi3H'
}))
 */

/* console.log(await fetchAccount({publicKey: 'B62qivN5MjVompwtxr7RtR8EJAChrskJJoLZ5TJjVG3xhjqKFcySzFE', tokenId: Field(1)}));

let xTokenZkApp = new XTokenContract(PublicKey.fromBase58('B62qivN5MjVompwtxr7RtR8EJAChrskJJoLZ5TJjVG3xhjqKFcySzFE'));
console.log('token.tokenId:', xTokenZkApp.token.id.toString());

// 
console.log('fetchAccount By minascan: ', await fetchAccount({
  publicKey: 'B62qqKFzLr1qcBCD6h6BsB1KnJkiWFTDWoTC31auhaifyvyRzRsb8zQ',
  tokenId: xTokenZkApp.token.id
}))
 */
let feePayerKey = Blockchain.testAccounts[0].privateKey;
let feePayer = feePayerKey.toPublicKey();
console.log('feePayer:', feePayer.toBase58())

// await fetchAccount({ publicKey: feePayer });

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
// 序列化tx
let jsonTx = tx.toJSON();
//反序列化tx
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
/*

*/
/*
Mina.Transaction.fromJSON(JSON.parse(
  '{"feePayer":{"body":{"publicKey":"B62qiTKpEPjGTSHZrtM8uXiKgn8So916pLmNJKDhKeyBQL9TDb3nvBG","update":{"appState":[null,null,null,null,null,null,null,null],"delegate":null,"verificationKey":null,"permissions":null,"zkappUri":null,"tokenSymbol":null,"timing":null,"votingFor":null},"fee":"0","events":[],"sequenceEvents":[],"networkPrecondition":{"snarkedLedgerHash":null,"timestamp":null,"blockchainLength":{"lower":"0","upper":"4294967295"},"minWindowDensity":{"lower":"0","upper":"4294967295"},"totalCurrency":{"lower":"0","upper":"18446744073709551615"},"globalSlotSinceHardFork":{"lower":"0","upper":"4294967295"},"globalSlotSinceGenesis":{"lower":"0","upper":"4294967295"},"stakingEpochData":{"ledger":{"hash":null,"totalCurrency":{"lower":"0","upper":"18446744073709551615"}},"seed":null,"startCheckpoint":null,"lockCheckpoint":null,"epochLength":{"lower":"0","upper":"4294967295"}},"nextEpochData":{"ledger":{"hash":null,"totalCurrency":{"lower":"0","upper":"18446744073709551615"}},"seed":null,"startCheckpoint":null,"lockCheckpoint":null,"epochLength":{"lower":"0","upper":"4294967295"}}},"nonce":"0"},"authorization":"7mWxjLYgbJUkZNcGouvhVj5tJ8yu9hoexb9ntvPK8t5LHqzmrL6QJjjKtf5SgmxB4QWkDw7qoMMbbNGtHVpsbJHPyTy2EzRQ"},"otherParties":[{"body":{"publicKey":"B62qqmHWbrHaWDxcp5MGLSQZHaTTv4jwxpr8gCvTsSGiFE6TPb6kXag","tokenId":"wSHV2S4qX9jFsLjQo8r1BsMLH2ZRKsZx6EJd1sbozGPieEC4Jf","update":{"appState":["6",null,null,null,null,null,null,null],"delegate":null,"verificationKey":null,"permissions":null,"zkappUri":null,"tokenSymbol":null,"timing":null,"votingFor":null},"balanceChange":{"magnitude":"0","sgn":"Positive"},"incrementNonce":false,"events":[],"sequenceEvents":[],"callData":"0","callDepth":0,"preconditions":{"network":{"snarkedLedgerHash":null,"timestamp":null,"blockchainLength":{"lower":"0","upper":"4294967295"},"minWindowDensity":{"lower":"0","upper":"4294967295"},"totalCurrency":{"lower":"0","upper":"18446744073709551615"},"globalSlotSinceHardFork":{"lower":"0","upper":"4294967295"},"globalSlotSinceGenesis":{"lower":"0","upper":"4294967295"},"stakingEpochData":{"ledger":{"hash":null,"totalCurrency":{"lower":"0","upper":"18446744073709551615"}},"seed":null,"startCheckpoint":null,"lockCheckpoint":null,"epochLength":{"lower":"0","upper":"4294967295"}},"nextEpochData":{"ledger":{"hash":null,"totalCurrency":{"lower":"0","upper":"18446744073709551615"}},"seed":null,"startCheckpoint":null,"lockCheckpoint":null,"epochLength":{"lower":"0","upper":"4294967295"}}},"account":{"balance":{"lower":"0","upper":"18446744073709551615"},"nonce":{"lower":"0","upper":"4294967295"},"receiptChainHash":null,"delegate":null,"state":[null,null,null,null,null,null,null,null],"sequenceState":"19777675955122618431670853529822242067051263606115426372178827525373304476695","provedState":null}},"useFullCommitment":false,"caller":"wSHV2S4qX9jFsLjQo8r1BsMLH2ZRKsZx6EJd1sbozGPieEC4Jf"},"authorization":{"proof":"KChzdGF0ZW1lbnQoKHByb29mX3N0YXRlKChkZWZlcnJlZF92YWx1ZXMoKHBsb25rKChhbHBoYSgoaW5uZXIoZTA0NWI1MWViYjQ0NWMwYiA0ODdlNzBkOTEyMjQ5ZjBlKSkpKShiZXRhKDViNDkzNTBhNDU2OWY4MjkgMWIwOGUxZTQxNzc0ZTA4NikpKGdhbW1hKDYzZjc5MTVjYjM5ODJjMzYgNmNlMjAxYTNmNGIwMTIwYykpKHpldGEoKGlubmVyKGM0ZTE3YWRlYmU2ZDFiNGUgYWVjN2NhZmY1Y2RiNmFhYikpKSkpKShjb21iaW5lZF9pbm5lcl9wcm9kdWN0KFNoaWZ0ZWRfdmFsdWUgMHgyNUY4NjJCNzQ1NUNDRUM2RkE1OTE3OTBBQzREOTkwQ0U1NTdCODgzQzNBM0EwQTNEMEYzMjI5ODQ3NEUyOTY4KSkoYihTaGlmdGVkX3ZhbHVlIDB4MTU5N0M4Nzc4MENDMkI0RjQ4MTE2RUZDN0Y3N0YwM0MyNzdENTk5OTAwMDFFRDU2N0IwQUI2QkQ1NUZBRDJEMSkpKHhpKChpbm5lcigzMzYzOTdlZjY3Njg5MzNhIDJjZDE2NzI5NzU2YjZkZmEpKSkpKGJ1bGxldHByb29mX2NoYWxsZW5nZXMoKChwcmVjaGFsbGVuZ2UoKGlubmVyKDU0ZTg0ODg2ODg0NGQ5ZTggYjgxY2QxZGI4N2JjYTM0YikpKSkpKChwcmVjaGFsbGVuZ2UoKGlubmVyKGJlMzgxZmViODY1ZmU1YjcgNjVlOTU3OGI2ZGRjOTgzMikpKSkpKChwcmVjaGFsbGVuZ2UoKGlubmVyKGU5MWRlMTY1MDU3MzczZTggOTNlNTE2OTUwNDM1ZGNiMSkpKSkpKChwcmVjaGFsbGVuZ2UoKGlubmVyKDIzOWRiMDU3YjRjZjYzMGUgYjZhN2NjODBhNmM3MjFlMykpKSkpKChwcmVjaGFsbGVuZ2UoKGlubmVyKDMxMTJlZjkxMDJjZGQ3NmIgNzg3MzVkZTc2OWFhZGE5NSkpKSkpKChwcmVjaGFsbGVuZ2UoKGlubmVyKGJmMTc1ZDEwYTdjZjcyMzkgMTBmNDUxZjBiZTY0OGQyNSkpKSkpKChwcmVjaGFsbGVuZ2UoKGlubmVyKDkxMjg0ODJhMzYzZTJjZWYgOGZjYWUxZTkzYjdjYzM5NCkpKSkpKChwcmVjaGFsbGVuZ2UoKGlubmVyKDExNWFkYmE4OTUxNzFjMDEgNTM3MDBlODRiZGE4ZWRlOCkpKSkpKChwcmVjaGFsbGVuZ2UoKGlubmVyKGEzYTUyNzE4YWZlNWFlOTQgMzA1NzdjMDgxMmUwOGRiYikpKSkpKChwcmVjaGFsbGVuZ2UoKGlubmVyKDQ1MjViYWE0MTkzYmYzZTkgZGFjYmNmZjQ4NGFhZTc4YSkpKSkpKChwcmVjaGFsbGVuZ2UoKGlubmVyKDU1NGE1MzRlOThjMDI4OTUgNjc1OWFmZjU4NTk3NzE3MikpKSkpKChwcmVjaGFsbGVuZ2UoKGlubmVyKDgxZDI2OTU0OTIxMjQxZDggNDBkZDhiNmMzZjk1NmIwOCkpKSkpKChwcmVjaGFsbGVuZ2UoKGlubmVyKGRjNWNhZmRhOTg4NTVlYmIgZmNjNDU1NDllMDYwZTQ5OSkpKSkpKChwcmVjaGFsbGVuZ2UoKGlubmVyKDU2NmY4N2E2ZmVmYzM2YmYgYmQ1NDE4NzA1OTEwY2ZiZSkpKSkpKChwcmVjaGFsbGVuZ2UoKGlubmVyKDNkOTFkNzNjMDYxMzdlMjcgYjUyNmMyNjA1YTQxZmUxMykpKSkpKChwcmVjaGFsbGVuZ2UoKGlubmVyKGI2MTdhNTY3NjcyYzZjNzQgODRmMTVkMzRmMmRhOTgyZikpKSkpKSkod2hpY2hfYnJhbmNoIlwwMDEiKSkpKHNwb25nZV9kaWdlc3RfYmVmb3JlX2V2YWx1YXRpb25zKGNjMWUyNTI0YzVmMzRhNTggNDE2YmZlZWEyNzM5OWZjMiA5MjZmODEyMTJiY2Y5YzBjIDM3YzJmZjBkZWQ2ODFmZWIpKShtZV9vbmx5KChjaGFsbGVuZ2VfcG9seW5vbWlhbF9jb21taXRtZW50KDB4MjI4REM3NzNENUEwQzUxMzQxOEQyNzk5QzdBRjhDNzM0QjFGOEFFNEQxQzg3N0NDOUUxMUY4MjIyN0E2MTlDRCAweDJDOTBFRDA5MkEwNjgyMTE3NDJERTQxMTFGQkM5Q0Q0QzE3MDhFMzVDQzQyMjYzMjBBQ0ZCMDY5MzhFMjU0NzkpKShvbGRfYnVsbGV0cHJvb2ZfY2hhbGxlbmdlcygoKChwcmVjaGFsbGVuZ2UoKGlubmVyKDMzODJiM2M5YWNlNmJmNmYgNzk5NzQzNThmOTc2MTg2MykpKSkpKChwcmVjaGFsbGVuZ2UoKGlubmVyKGRkM2EyYjA2ZTk4ODg3OTcgZGQ3YWU2NDAyOTQ0YTFjNykpKSkpKChwcmVjaGFsbGVuZ2UoKGlubmVyKGM2ZThlNTMwZjQ5YzlmY2IgMDdkZGJiNjVjZGEwOWNkZCkpKSkpKChwcmVjaGFsbGVuZ2UoKGlubmVyKDUzMmM1OWEyODc2OTFhMTMgYTkyMWJjYjAyYTY1NmY3YikpKSkpKChwcmVjaGFsbGVuZ2UoKGlubmVyKGUyOWM3N2IxOGYxMDA3OGIgZjg1YzVmMDBkZjZiMGNlZSkpKSkpKChwcmVjaGFsbGVuZ2UoKGlubmVyKDFkYmRhNzJkMDdiMDljODcgNGQxYjk3ZTJlOTVmMjZhMCkpKSkpKChwcmVjaGFsbGVuZ2UoKGlubmVyKDljNzU3NDdjNTY4MDVmMTEgYTFmZTYzNjlmYWNlZjFlOCkpKSkpKChwcmVjaGFsbGVuZ2UoKGlubmVyKDVjMmI4YWRmZGJlOTYwNGQgNWE4YzcxOGNmMjEwZjc5YikpKSkpKChwcmVjaGFsbGVuZ2UoKGlubmVyKDIyYzBiMzVjNTFlMDZiNDggYTY4ODhiNzM0MGE5NmRlZCkpKSkpKChwcmVjaGFsbGVuZ2UoKGlubmVyKDkwMDdkN2I1NWU3NjY0NmUgYzFjNjhiMzlkYjRlOGUxMikpKSkpKChwcmVjaGFsbGVuZ2UoKGlubmVyKDQ0NDVlMzVlMzczZjJiYzkgOWQ0MGM3MTVmYzhjY2RlNSkpKSkpKChwcmVjaGFsbGVuZ2UoKGlubmVyKDQyOTg4Mjg0NGJiY2FhNGUgOTdhOTI3ZDdkMGFmYjdiYykpKSkpKChwcmVjaGFsbGVuZ2UoKGlubmVyKDk5Y2EzZDViZmZmZDZlNzcgZWZlNjZhNTUxNTVjNDI5NCkpKSkpKChwcmVjaGFsbGVuZ2UoKGlubmVyKDRiN2RiMjcxMjE5Nzk5NTQgOTUxZmEyZTA2MTkzYzg0MCkpKSkpKChwcmVjaGFsbGVuZ2UoKGlubmVyKDJjZDFjY2JlYjIwNzQ3YjMgNWJkMWRlM2NmMjY0MDIxZCkpKSkpKSgoKHByZWNoYWxsZW5nZSgoaW5uZXIoMzM4MmIzYzlhY2U2YmY2ZiA3OTk3NDM1OGY5NzYxODYzKSkpKSkoKHByZWNoYWxsZW5nZSgoaW5uZXIoZGQzYTJiMDZlOTg4ODc5NyBkZDdhZTY0MDI5NDRhMWM3KSkpKSkoKHByZWNoYWxsZW5nZSgoaW5uZXIoYzZlOGU1MzBmNDljOWZjYiAwN2RkYmI2NWNkYTA5Y2RkKSkpKSkoKHByZWNoYWxsZW5nZSgoaW5uZXIoNTMyYzU5YTI4NzY5MWExMyBhOTIxYmNiMDJhNjU2ZjdiKSkpKSkoKHByZWNoYWxsZW5nZSgoaW5uZXIoZTI5Yzc3YjE4ZjEwMDc4YiBmODVjNWYwMGRmNmIwY2VlKSkpKSkoKHByZWNoYWxsZW5nZSgoaW5uZXIoMWRiZGE3MmQwN2IwOWM4NyA0ZDFiOTdlMmU5NWYyNmEwKSkpKSkoKHByZWNoYWxsZW5nZSgoaW5uZXIoOWM3NTc0N2M1NjgwNWYxMSBhMWZlNjM2OWZhY2VmMWU4KSkpKSkoKHByZWNoYWxsZW5nZSgoaW5uZXIoNWMyYjhhZGZkYmU5NjA0ZCA1YThjNzE4Y2YyMTBmNzliKSkpKSkoKHByZWNoYWxsZW5nZSgoaW5uZXIoMjJjMGIzNWM1MWUwNmI0OCBhNjg4OGI3MzQwYTk2ZGVkKSkpKSkoKHByZWNoYWxsZW5nZSgoaW5uZXIoOTAwN2Q3YjU1ZTc2NjQ2ZSBjMWM2OGIzOWRiNGU4ZTEyKSkpKSkoKHByZWNoYWxsZW5nZSgoaW5uZXIoNDQ0NWUzNWUzNzNmMmJjOSA5ZDQwYzcxNWZjOGNjZGU1KSkpKSkoKHByZWNoYWxsZW5nZSgoaW5uZXIoNDI5ODgyODQ0YmJjYWE0ZSA5N2E5MjdkN2QwYWZiN2JjKSkpKSkoKHByZWNoYWxsZW5nZSgoaW5uZXIoOTljYTNkNWJmZmZkNmU3NyBlZmU2NmE1NTE1NWM0Mjk0KSkpKSkoKHByZWNoYWxsZW5nZSgoaW5uZXIoNGI3ZGIyNzEyMTk3OTk1NCA5NTFmYTJlMDYxOTNjODQwKSkpKSkoKHByZWNoYWxsZW5nZSgoaW5uZXIoMmNkMWNjYmViMjA3NDdiMyA1YmQxZGUzY2YyNjQwMjFkKSkpKSkpKSkpKSkpKHBhc3NfdGhyb3VnaCgoYXBwX3N0YXRlKCkpKGNoYWxsZW5nZV9wb2x5bm9taWFsX2NvbW1pdG1lbnRzKCkpKG9sZF9idWxsZXRwcm9vZl9jaGFsbGVuZ2VzKCkpKSkpKShwcmV2X2V2YWxzKChldmFscygoKHB1YmxpY19pbnB1dCAweDM1NzA5NjIzMUIwNkREQzI5QTg5NjlCNjYwQUUwOTBGMUY1OUE4NjIxMzRDNEYyQzAxRjhFMzEyNzgyODIwRkIpKGV2YWxzKCh3KCgweDI0MDYzMUNDMDZCNTlEMUVDOUE1NjQ2OUQ1NDZCMzQ5QjcwRjVEREM3QUUxQjY1NUQxMTgwNjc5QzhDRjI5M0UpKDB4MDU5QkI0MDU1NDQxQTgxODlBODgwNUM5QUYwMzk5MjhEMDE3NkI3RDQzMkQ2QjQxM0U1MkFBQzJBQzc5OTUwRikoMHgxOEJGMzY1QkE2MEIzQkJBMkIzN0VCMzE3MTFBNUZCN0M1RjdCNjVDRThCOEY0OERGQUVCRjIwMTgxRjkwNzBDKSgweDAyN0ZEQ0Y5RDMzMjUwOEFEODE4MjRERjNDRkEzMTkxNjhGODhDMDg4NkU1NEM1QzA0QjRBNjRGMkU4MzJERjIpKDB4MzBBMDUzMTE1ODFCOUE4MTNGQ0VBNDZENjhFNDhEMjEwQ0NFODY0OEQyMzM3QzcyNjBFNzczNEYzMkM1NzA5NCkoMHgzNDA5MkZEMzc2RDJBMTBGNTlBQzFCMTVGMjYxNTczNDY5NjBDODlCODBDRkVGRERCNTk5QjZDMjIxQkQ1NkUxKSgweDFGRDJGQjAzNTYwNDE3RkI2MTIyNDAyNzMxOTgxMzJGMDUzQzY0Nzc2RTgyQTAxQjAyM0I2RTFCQzQyMzg2NUIpKDB4MEZGRjU1M0M5RDhDMUQ4MEQ3NjAxOEZGNEU1NUIyREJDNjlCOEM5REJEM0I2MDY0NEMzODdFRjMzQjI3RThDNikoMHgzODJFNDFFNjIyRDM0QThFRTg4QUMyMDQyMTFDQURFRDJFMzQ4REU4MTY1MkNGMDVENThDQjA1Q0M2NkQ3RjZGKSgweDMxRUZGQzVBOERBNjI2MkFENjAxMkQzMTM1NjhCMzg3MDA2QTAwREIwMTA2QjFCODdEMkFEM0Q0ODZBMEI3OUUpKDB4MEYzMzM4REMyNUEzMDFDNTQ1MzMyQjRGNjU5RjJCMjI5NUQ1NEEzQUE3RjhGQkNGQTM4NjM3QzM0RDQxQTAxQikoMHgwOENGMTc2Mjg4RkNFODE5N0E5MEJBREJGNTU4RjM3RDkzODdCRjY1REEyNkQ1NzM0RTY3NUVBN0YwMjVDRDIzKSgweDA0OUFDRTcwMDQ5MzY4NUUzRkEwMDU5NjY2RTFEQjIxQTA1MkZFOUE3NTQwQTFBMDU2MURERjlGQjgzMUFBNkUpKDB4MDQ2QkVEMkFGMjg2NERGODNDRjI0MTU4OTUwMThFMTE5QjZDNzY3QkNDMzQ4MkY5NDUxODk5QTg1NDRDOUNGQSkoMHgxQTcxOTI0MUU4MEI0NjBERjYyNDdCNjY4NEFDNUM4RDFCNjAyMUYzQzZBRTgzRjNFNzg1Mjk5RUQ5QUEzRDM1KSkpKHooMHgyRTE2QkY2QkNCMDIwMDJBNTkzMUU3RkJBN0M3MjY3MzlCNTVDQTA3Mzc4MkNDNDMwQkRFOTk1REQxNEMzQUI2KSkocygoMHgwNkZBRUQwRkU4NTdDMjkxNzQ4ODZDMjdDMDFDRUMwRjc3NTY4QzM2RkQyRkQxMjgxOEJCQkM2RTcwRTY2RTM4KSgweDE5RkY0Qjg1Qzk1NkNDN0U1REM3OUI5MEFBN0M1NzlBQ0Y2NEYwNzQ1NzgyMTRFMDZENzI5Q0NGMDU2MDg2NDEpKDB4M0MzNzgzMjNGQTNBQjc3NzlEM0NEOUI4QTE4REI4NTYyQTgzMzNBRkQyNEEwQzQ1Qzc5OEY1RUEzQjQzMzA1QSkoMHgxQjQyNkNDRTRCNjU2MjI1MjlBQTY3MzA2RTcwM0U3Qjg5RkU2MTZFOEI2MUQ4MDJFREFBQjJEMjY1N0M4RkVEKSgweDAwRkE2NjkzQzlGRjI5RThFRUNBODEyOUYwM0JCRDFBQ0JBQ0Q1RUZDRTg2RjEwOUYwQjYwRURDMDVDMjQzRDEpKDB4MzE4MjBGNDY3RjA4NzM0OEQwQkQyOTlDNzJBRDg4RDFCMEFEMTlGMUUwRTI4MUM5NUQwREQ2RjQxQkY4QzI2QSkpKShnZW5lcmljX3NlbGVjdG9yKDB4MzFGREJBMEJENjJGRDk4QUEwODY2RDREREQ1REFGN0NFNzgwMDg5QTk5MzAzQjlBOTQ2RTgyMTkzM0QyNTg1NykpKHBvc2VpZG9uX3NlbGVjdG9yKDB4MTdCRkE3ODhCRjY3QzBEQTJCM0UxRDQwNjg1REIwRkQxQkUyQkYwOEU5MUFENUM3NDExNjM0QUQ5QUNDOTJBNCkpKSkpKChwdWJsaWNfaW5wdXQgMHgzQUJENzM3M0ZDMjFDNDRGQkY4MzJENDkwQzQzM0U1MTI5ODAyQ0ExNjE0RTY2QTRDQkVDQTNDMEFBMkMyQjgxKShldmFscygodygoMHgwRUNFMzdFMTI4NzA4QUNDNEZFMDM0MzE5NDEwRjIxN0NFMzE0QzMyNENGNDEyM0ZENUVBNDhGRTJGRDExRkRFKSgweDMzRENEMjFGQkQ0RjVFMTZDNTcwMzQ3OEQyREVCMzVGMzM2QTREMDYwQjMyRDA5MTRCNTI5NzBCNzUxOUNEMDYpKDB4MDgwNjVERTYzRDQ3QTE2RjExRkQ2NEYzQzQ2RDREM0QyRURDRDQ3NkU1MDE2M0E1RkZGQ0MwMjlCOTgzNEQ5MCkoMHgxRTJCNzI1QUUwQzI2RTVCQjIzMzgyRTY4MzZENzFGOERBRjREN0VGQUVGQjBDRTY3OUEyMjUzOTA4QTYyM0VGKSgweDIxMkQ4QjgxNDUyMTUxMDBBNTZGQTdCOTJENUI2OTc0QjRCMjI4MEU5MDc5OTlGNTY5MDkwQjY2MUQyRDE0NUYpKDB4M0U5Njk5RjMxMjFFNkJCOTY3RkI5ODc0NEE5OThGOTVGMUJFQzQwNjlFMTVGMjVFRTJCNjMyNDc4RjQ5N0NDNikoMHgwODk4MTlEQTY0RTZENjM0NDU1NDdCNkFEMzQ0RTk2OTkyMDVBMDc3OTNDNEUxNkEyMEExMDZFNzUxMjkxMEREKSgweDE5NjIwRjczQzdGNTNDRUEwN0FGNUJCMzAzOUUyREE2MjA5NTlGQ0ZEM0NDN0E0RjY3RkYyNUE1Qzc4OTU5REYpKDB4MTNGMDYwMUZEQUEyODhGREZGNkNGNTBCRkFGRDZBQzZEMjQxRjlBMUQzNzBBMUVBNzBGMDRCQjg2MzNGNzQ5OCkoMHgzMDQwRjYwQTQ5QTI0QzAyODA0MDQxMjczMDQ0NDg0OEI0NDc1NEZEMjRGMkEyMzg5M0Y3NDAzRTVGOThBODhBKSgweDNDMjgyMDQyNzdBOTE3MzJCMDhBQjNGRTE2QTlDMEI3MUY4NDcwRDBDNjc2OTY4RUI5M0UxNjhGOTA0NDBFQ0IpKDB4MDM3NEIwRjY4QTdBOEIyRUY3OEM4NTRCQzk1MjFGMTg0NkRFQjM0Q0Q2NEYzQUY2MTI3OUEyNjlEMTkwMDQ3QikoMHgwQzA1QUI2RjFEQTg2NjRFQkFGRUJFMjc3RTYyNkFCQjdDMDMwQzNEQUE4OUJENTI2RjNFODg1MEExRTVBOTZEKSgweDI0REM4Qzc3NTQyMDNBQjRFRUNFMDEwMTMxRDAwM0JBNTQyQzFBQzVDNTM1ODY3NDhGNkRFREREMjYyNjlGRkMpKDB4Mzk5MEVFMERDMDM0RTYzRjdCOEIzQTE5NzUxMDBENkZGMTE4RTI1NUVFMzI0OURFMjhFNkE4NzAyRDZCQzNBOCkpKSh6KDB4MUZCN0VEQUFCRUMzMUZGNTNENjMyQ0VFQzhDMjk3M0QyQUM2NDgxRjk4RkYwODFCNkE3RDBBRDlFNTUwMzg3RCkpKHMoKDB4MDM0RUJBNDQ1RDlFN0MyRUFENkYyNzVGN0E5NjA2NDRCMzI3REExMTU1NTQ5Mzc3NzhCNTlCRDJCQUU1NDkzQikoMHgyMUZBOUEzOTg1NUUxODc2NkUzM0VCNUYyNTg0NDIxODkzMDY3QTk1MEI5NjVFMjg1RDk3Qjc0QUY4NDY3NDdFKSgweDI3QkVFMkZFQThFRDgyQTRBQzBCOTczNjUwODhGRUE4RjgxMzIyRDA1NTlBMjREOUFDRjNCN0FGMzQwMjdCNDcpKDB4MzgyMDMzN0VFRTQ3RjFBMkQxRjc3MEY2OURERjExRUI0MDc4MUFGQkFCMDEzRjIxMjk4MDA3MjhFQUM2NkQ3MikoMHgxOTY2Q0QyRDIxRjlCRkNCNjdGQTdGNzhCN0YzMUJDNkFGODgwQkYzMDNBNkE2QkY1QkI3QzEzMzM5RDVBRDYwKSgweDE1NzQ5NTQ5NThDRkQ0RjMwMjgxQjlBRUM1MDlGNUVCOEIwRkFEODgxQTkyMEY0Q0I4QTgxOTU4ODQ2QkNDNkUpKSkoZ2VuZXJpY19zZWxlY3RvcigweDEzOUY0NUJCRUU5MzRCRTE0NDUzRjI0MEZCRUFBOUFCMDA5QzdGNjhENTA2MjI0QzVEMUNDRTcxQjJDMDYyQzApKShwb3NlaWRvbl9zZWxlY3RvcigweDNCNDVCRjIxMkFBQjc5QUVGREU3MjRDQkREMjE4Q0JFNzZFOTYyREM4ODhDMEE0Q0Q2NURBQTIxQzdCQUMxOUYpKSkpKSkpKGZ0X2V2YWwxIDB4MkVBRkU2MTRBMkUwNzk3N0FENkVCMzJEREI4N0JFODFFNkZBMzg4MERBOEMxNDQyREU0RDgxNTg3RjQxMzM3QSkpKShwcm9vZigobWVzc2FnZXMoKHdfY29tbSgoKDB4M0Y0OTkyNUQyNTA0NjU1QjQ0OEFGMTVBNUQxQTgzOTM1MTY5MDU0NDczREM5NjkyOTlDMUUyOUQzNTZDMjhFNyAweDAyNkMyMEIxNjBGODI4RUY1MDM2NTM4RjM0NDY4QkM4NDY4MTczMjBFM0YzNjA3RkYwN0ZBM0IwOEQ3ODRDQkEpKSgoMHgxNjM1NTMwQ0I3NDlFQTQxNUJGNkUyMzY1QTlBMjkxRjYxNjU3NDdFNzU5ODdCNTYzM0YxQjBCQkUxMzM5MjJFIDB4MEQzMjgyMUUzNTg0RjFERTcxMTY2MkY0OEUwNkNBRTE0MEYwMEJFN0IyRkZBMzk3NEJEMTBFMTU2MTYwNTE2NykpKCgweDE0Rjg4QkUyOEY3NzNEMUZBQTYzOEVCMDNFNDU2NTYwRjdCNDJCNTA0RjI4RUM0QTgyNUMwNDVDMzY3QkZCNUQgMHgxRTA5MDEyOTg2RUFEMDBEMEIyMTc3RDYwQTMzQjFGNTg2NUJFQTQxMUI2M0IyNjNDQjgwNjQ3RUVGRkJBQzg1KSkoKDB4MDA4OTAzRTY5M0FEMjU3M0UxQjU4NkRDRjMyMjBGOUIzQUJCNjI1QTc5NDBBRTMyNEVBQTg0N0I0RDJEMzYyRCAweDJGNjVGM0E1MTc4QTU3ODk4NUYzNjk3QkJGMUM1MDJDNDBFQjI0NUE2N0VGOTY0QzAyOEYzQUExMDY3NTA4M0YpKSgoMHgwRkYxQUNFMjZCOEMwMTlGMkVDNjNDNDlDMjEwMzBBRkVGQjI3RjhEMjk5QjExOTYwM0FFM0MwRkYxNTNCN0M5IDB4MTVFOEM3NDhDODBERDAwQ0ZCNkQzODZBNkZBNTY1QTJDNDE4QUNDQjM2MUNCQUMxQTUwQjc0RjVGN0ZBNzdFRSkpKCgweDJFNTU4QUVDQjRCOTI3NTZBRDMxRjQ1Q0Q1RUMwNzJFM0RCQzhCODQxNEZEQ0Y4RUI3RTdDMTE0QUI5Q0VDOTMgMHgxMDg4QkI3MjNERDJBMkNCNTczNTk3OEM2QUZCMTQ5NzZBQzA5OTM2MEY4NUMxNTM0RThENjVGRUYyODI0REQ0KSkoKDB4M0U4QTNDNjAwMjUyQUVDRDE0REQzRDNGMTFEOEY2OTMxODJCMDQ2MDU4NzFGOTZBOUUxMDExQjU1REU1NTMzQyAweDJGQjMxMEZBN0UzNDgwQjVEMzZCMjVGQjdCMTNCQjQ2QTlFQkExMjkwNjYxODUyNDkyQkJFM0JGM0QwMERFOUYpKSgoMHgyMzlFQjUyM0NDNDU1MjJDODBDNTQ4NzdDNjU3NjdBQjg4QjNCRDQ3MzU3QkYzOEUyQTJCOUU3MkQzRDMyMEMyIDB4MDdCODJDMjIzNDhGREZBQTE5NTA3MDU5QzlGNjQ2MUZENEYyMkI3QkUxQzg4REI5NzA5NzYxNDEwRUMzNkRDRSkpKCgweDE5MDYwNTY0RDVGNUNFNzQwMTkwMjVFNjkwMjkxOTdCNENEN0ZCRkQwNTFCQ0Q4NjgxRTJDNTkzMjA4QTRGNzcgMHgyNTIxNDgwODk2NkI2RUExQkYxMTM5RjMzQ0YyQjI4OTNBMjhEMzU3MTUwQkJFNzEzMDNENjJEMUIyODg5Mjg3KSkoKDB4MkFCRDU1QzUzRTAwMzMzM0U2M0JDMTM1NTc3RDUxMjdCQzE0REM5RTlGQ0UzQkI5ODhFOUI4N0UzNTU2Mjk5NSAweDI1NUI4NTNGQTQyNkQzNTdDNjU5QzlCMDVFQzYyRTRBN0YyMDQzMjZFQUIzQUJDOTBBM0I2MDY3QjQxOTY3OTEpKSgoMHgwNDdBREFFRTNEMEM3OEExQjYzQzQ4MUYzQUM2MzRGNDhBODFFODNGM0I4QzAxMjgwNzIzQjFBNDVGQTZFNkQ0IDB4MjFGNEU1RjEyM0M1MUVCNTEwNzA3RjBBNEMwMjVDQjJDNTNFNkRBNUEzOUI4NjAyNzUwNUUyRjMyOUU5RDFGNykpKCgweDMyREVBODkxNjU2ODM4MEE1NDI3RjNDQTdDNDE3MDMyN0E3QkJERkRFOUVFQUIwQjgxRDM4NTkxODE3QUVFM0MgMHgwMjA1QURGMEE2M0U2MDE4RThBRDZCNUJERkZGNDYyNjRDNkY0RTE1N0RDMDMzQTJCQjIyMkE5NURGNkI3QjVBKSkoKDB4MEQzRjZFRTZEREVDRjQ1NEQzQjc1NEU1RDU5NDM1QUYzNjNFNzExOTgyNDI5RjE0MkRCNjQ5MzRDQ0YzOEMwQiAweDFDNTM2NDM5MkQ5MzUwMjc2RTAwMDVFN0UxRjZFM0EwMTJCQzMzOTUzQTUyQkVBMUJDQ0NGMjY2NUM1NTMwRjEpKSgoMHgwRDc3NzdGNTI5MTk3QTVEQkRDRDEyRjdCQTA2N0ZDNUE2MkU1M0JERTlBRjZFMjJBREM1NTFEQTI4N0M0NjcyIDB4MjcyRkJERTg2RjJGNUM3MzZEODE4NTI5NUNGN0E0MjQ2N0JDQzc4NDVGMDU3N0I5RjFCMUVBMEY5RThBQjdCOSkpKCgweDM4NTRGQkIxRjczQzlCQkFDN0JFMjMwRDFDNDE3RjkxOUQwNTMxNjBDMDM5QjdCQjUzMjE2ODdFNDVENjVGNzYgMHgyRjNDM0I3QkZGN0MwRUVDQkE2ODBDRURCNTZCRkUwNTE0QzBCQzA5MUI5RUQ0MDI4RjFEQTQyMDJENEVGNTNEKSkpKSh6X2NvbW0oKDB4MEM1NTRDN0Y1RjE5NDZDNUJBNTlGMkMwQkZDQ0NBREQ2RjgzMzExRUQ0RjVBMjE1REJFRDY0QUYyRjVDQ0M2NCAweDBEMEVCNjc5NDhBQjQwOTkzRjgwN0ZCODI1MUJDOUQxNEFGMUQ3N0ZCNUYxREU3RkIwQjEwRUREOTBGMkIzNzApKSkodF9jb21tKCgweDM3NEMxOEFEMDIzQTY3QTE1MTg2QjI5RUQzREY0QzI4NkFGQTRGREE1QkNEMTc0QzIwRkExQjYwNDkwMkM4MTIgMHgyNDlBMkI5NjczREQxM0Q2MDcyNjI2MjgxMTVGRjZBMjkzODY3QjY3Nzg5M0M1OEJBNDQzMjQxMUZDQUM5OERGKSgweDJGNEU4RjhBMTdFNzQ5QkIxMEM0MjYwQzQ5NjQxODRFMjBBMDU0MUI2NjI3REU4MEUwQ0I1RDM2QjUwODk2NjEgMHgyMTAyNjRDRUJGMTYxNUJCRDRBNjRDNjZGNzIxODZGRjYyQUEyOTA0MTUyQzNDQzk2RjlFNjFFQzlEOTQ5OUNGKSgweDBGNkVDMkQ5MDEzNkQwRjgwNjZDOTUxODBGOTAxQTRFNDdFMUMyRjVEOUNCQ0UxQ0M0ODBBRjRCM0QzMzI2MDYgMHgwNDU2OENDRTE3MjUxRUQ0OEYwQzkzN0QwODdDN0VERUNEREJGRTRBMTI3NjU3NDEwNzkwMzVERjQzNUIyM0FBKSgweDI2MDhCMTkyMjBEQjhFODUxMkQ4MzFEMUJGMEMwMkM3MUJCRjUyMkI5QURGQUEzREREOEE5QjU1NDIwRjA5MzAgMHgzNDRDNEYwMkU2RDE2QzRBNDY3QTFEQUZGMkExRDUwNzEzNjNCMDczMzU5RTkyNEQxNTc3RkZCOTFDQUI4MUUyKSgweDAzRTNEQUM0NDE3QkQwRTU0RkNDRkE0NTYwQzg1OEY2OUNBNEVGRkM2NTg1MjdDOUJGQkQzQjUyNEZBRkUyMzIgMHgyQjYyOTRBRjhCRkJCNTU1NDI2NzQ4RTY2RkE1MkJGNTI4OTkyMzc5MkNCNDQ1M0Q0OTA5MjNCMTYxMTEzODZDKSgweDA0MDExRTYwQjYxMDAwQjlEOEE4NkE3OUM1MDQ1RjdDNEJERjc5OUYwNjhFQzJCODQ0RDlBODlDOUJGOEQyMDEgMHgyQjZENUVFMTQ2MjlDMTY0RDhENEM1Mzg0NjdGODc2NzY1NzU0RkI1OEQxMTM0RUZGNTU1MjQ0MzJDNzMxNDYwKSgweDA2OUE5NkQ4Q0I5MzczM0IxMUNGRUVEQzg3RDdEQTkyRkQxRUEzNkQyRkZFQUMyMTBCNEU0NDY2ODZENjQxNzAgMHgzQkJCNEJCMkU1N0RGQ0M2OTQ2MEJGMDA2RkFEODA5MDFFQUQxM0YxREE5REZEOEZFMDRCNDUxRDUxQTQzQTI2KSkpKSkob3BlbmluZ3MoKHByb29mKChscigoKDB4MEEwQjFCNTlDMjg4MDY3MUE4OTUxQjIzQzMzNEY1MkRGODdFNjhGMkRBMUVGNDJFNkYwM0U1OEYxQ0U3RTc0MyAweDM1OUM0NDc5Mjk0RUJEMzE2OEJFMTg0MjFERTg3MkQ0NzA0Q0NGQUYzQzFCNjlDRUY5MUJEQjU3MjE1ODg5NTIpKDB4MzA4QzJGODk2OTA1RTY5MjQ0OUVBRERDQUIyQjRBQUZFRTg2NUYwNzVGN0Y5NTMzMEY0NjBBRjBBNzIzNUJBNiAweDNDOTA0NTZCRjg1OEJDREMzQjg4QTlENEVGMkQ4NkRGMjMzRDA0MTg5QkFFOTQyNjdCMEFBODIzRjRFNTg5NzQpKSgoMHgyQThENTg2QkY4MjYyRjFDMzAxRUIwM0JDMEI0NzEwQUE2OUEwRjgwNjkwNTE5N0QxOEIzMjNCQTk1Qzg3NjA4IDB4MkY1MjM5RURDQ0JFRDA3RjJFNEZBRDZEMkVEMDJBNUREQTAyQTQzMUE2Q0ZFNUE2RTI4MjBFNDlFQ0VCRTIwNikoMHgwNThFODdERUM0MzA4REYzQTk2NzQyNkU5Qjg2QUE5NkI0MEQ5NDE4RTI1N0MwMjJCNEVEQzJFNDg4NTlFNzIwIDB4MUNDQjZFNjc5NzI2QjA2OUZEQUJCN0MyNEYzMDIyMjczMDQxQUJCN0Y5MjU3RjU1RjdBOTczQzY2NUNBOUZEMSkpKCgweDMxMDU0OUMzN0U0NEJGODNDMTY5QzgxQjY5MjM3RjZEQ0VENkFDNzMxNjQ4M0U0OTlFQzg2RjIxMDVGMUM2MEUgMHgxNTk1MDU3NDg3MDhEQTc1NjkxMzQ4N0E1QjE2QkQ5MDczMDJDMTlCRDE5NEMyMDNFNDFFOUQwRTg5MTA3N0IyKSgweDAxOTQ5MEE1NDE5NzU4OUNEODM4REUxNEQxRUJBQzA4MDUxNzhBQjgzQUU4OTFDQkYxQzNFREIwMDc4MTU1M0YgMHgwRUVFOTFGMDdEREQzMTU1QjIzNkJDODUwNUM4Qzk0ODY3RjNGMEU1NzgwMEM2OUI0OUU0QUFDNDQyQUY0NUVFKSkoKDB4MkVDOUVGODQzOUZDRDFEREM2RDAyNjlDRkVDNDVCQjdBOTA3Mzc3RUExOTc4RjdCNEMzMkVGNDM1NkFGNzA1OSAweDAwNkQ2RkNBRTY4MzQ0RDY0NDdGRjdGRTgwOTZCM0Y0REY0RjE4NzExQTg4QkJBRDg1MEJERTBCMjNGQjQ5NjIpKDB4MUQ3NjBCRTM3Mjc2Mzg4OTNGQ0QzNkMxN0VGN0E5NUZBOEY4QjhENEEzODNDNTQ1Qjk0MDE1MzdGMjRDOTFGQyAweDM3NUQ5OTlBNUUwRDBBMDQwNkEyMURCRUQ5Q0IzQzkxMEYzMTZDRTlFOTIyN0MzMTYzQkZCNDMyRTM2QTRENzQpKSgoMHgxOUZFOTQ1NDVEMTlENzg3MTk4QzEwOEIwOEJBNjU0NTQxQTRGMEJGMDA4RDRCRDFFQzMwRDE0NDAzNkVGQ0EzIDB4MzUxNzlFMTIyMDI4RTlDODU2NUVBRDg5NTY5OUY3QTMyRUFFQTA1MkE0MjFCRkNBMUVCNTU0NjIxRTk0MzkyMykoMHgyNkU3MTYxQjcxMjk1ODdENzczMTVCQ0U1MUIwOEZBOEE4QTBENkI3M0RDOERFQTAzODU2RjBDNUZCOUUwM0ExIDB4Mjg5RTAzQzVFMkRDQzFFODJENjhDOTQ2NUNERTA1QzJEMTk4QTM1NEE0QjU1RjkxNENDQzc1RUQyNjI4MTVERSkpKCgweDEzRTFCN0NGM0Q3RkRGNDI5QTczMUZDNUNBNzkwMDQ5NkM0MTZBRUE3OUFBMTgzRjdGMkVFNjg2OUUyNUY0RkEgMHgzRjgxODVBRjlGN0E1OTMzMjMyN0E3NDlEOTI5NjhGOEEwRDVGODQ0RjAwMjA3N0FDQ0VCQjQyNTc2NTdGRkIyKSgweDJDRDVEODk2RTU0RjVBODJFMTVDRTgwRTBBRTA2NEI5OEYxMjg1MTczNjkwNEI0ODhDNzJDMTQxOUY0RkE4NUIgMHgxOEQzNTlGRDU3OTFGMjcyQzMwNDQ4RjkyMUU1MUQ2Q0YxOEJCOUREQjkyQkI2RkE5MzcxQzE0QUUxNzYwRTA4KSkoKDB4MEM5REIzMTYwQTFCMDkwNDZDQ0I4QzU1Q0Q5RDcyRTBGOTcxREM1N0E2MDkyNTkwOUM0NEMxOTJFMEU4NDMwOCAweDBEQzFFODk4MzRFMDBFQTA2QjAzMjMwNDU2NTgxMjJGMDQxNDkzQTE5RERFMjFDMjMzRjJBQ0I2QjVGNzg1QTcpKDB4MDkwRTZCQjMwNkIzOEY2NDc0MjQ3ODhEQUM0N0JEMzRFQ0RCNzRFMjgzMUYwNEZGRDk2NkE0RkI2MzQxMDEyMiAweDFENzk0MkVEM0JGODg3NzE1MTg3NDQyNzNGMzk3RjQ5MjUzQ0E4QTdFQzRDN0Y1NDExQzg0MjY1Mzc4NDU3RDcpKSgoMHgyMEE4MzA4MTYyMkE4OEIxMTc2NUU0MEE0REY3OUYyNjM0MzVDQ0ZDRTk0MEQyNThGQTRFMENCNEE5MzYxQjdCIDB4Mjc2NTlEOEQ2NkQzQzIzQzMwMTdFODQzQjhEQ0RGMzBCRkFDQzNEQ0U5NjA2MzE1MzAwQkNGM0E4ODgzRTdBQikoMHgxNTE2NThGOTFBNUQ1Q0EwMENCMjUyMTREQUE0MTJFM0ZBMTNFN0U0MUJGMzYzOUFCODRFRDdCNkY0NzBDMzM0IDB4M0ExNTEzNDg5MDY0MDkwNTc2Mzg4MkUxQTk1RDQ1RTEwNjAxREY5RjEwMzc2OUU1NDdFMDUzMTAxMjMwQUY3NikpKCgweDBGQUQ3Nzg0NzZDNENCRTBBQjYyOTlDNjA5ODIwMTQwNjBGM0EzMjk0NjhDQjlBMkRDQkUyMjA0NUYzRDNBODYgMHgwN0QzRUFDMkQ0NURDREI2QUY2RjkxMzBCQTc2Mzg0OThFRUMxNThDQzk0MjFFNTFCNTUxRDUyMjcxMDQwN0E2KSgweDFFMjcyRkVFMjNBMEZCMzA1NzU4OTI4NDM4NDM1MUM2Qzg4NDA3RTVEQjU4MDU3MzhGQ0FEQjUyNjE0MTJDNTkgMHgzQjU5OUU1RDExMzJDODE4Mzc0RTM4OTUxMjczOTJDNUQyODIwNkFEQ0M3MzUxOUU0Mzk2NzEyQkQ5RDE3OTU4KSkoKDB4MjhFOEIwNkIwRDc1MkFERTQ3MkY4ODNDRDU0QTVFM0FGMzk2NjE4QTVGRDRGMzE0QjM1NjYzRTQ2RDUxQUJCQiAweDA2RTcyM0M0NTcwQkFCMDlDMjBGREVCRkQ1M0YyRTQwODY3MkZEOTZBNDEzRkY5NUNGQjY0MjhDNEU5RkJDRUUpKDB4MDhEN0M1MUU1MDVGMEM2MjQ4QjNDOTIzRTgzRDgxMEQ0MTBBOUM0QjQyMDMyRkMxQzY5OTJGREU5MTBDNzA4RCAweDNGMzMwOUEyRTJEOTU1MjFFNTMzNDBENzRCNEU3ODk1MDU5RDA5MzA1Qzc4QkUyNUJCNDYzQzk0RjUzQjBDNTIpKSgoMHgwMDA5Mzg5OTcyQzY3N0NCOEVDRDQ1QTI0NzA5QkQ5MzUyRDc1OEJCNkQ3MzA2N0YwRTM2QTY0MjZDNDk4QkFBIDB4MkQ1OEIzNEUzRjY3MzZCQ0I0MTNFNjhDQUVCQzkwRjA5RUFEQURDMDQwRTlENTVEOTcyODAxRTA2MTk1QzEyRSkoMHgxNjc2NDYzMzQyODQ2RjYxMTdDNkUyMkRDMkZCNkYyMjYyODAzNUJEMEMyRTg2NERDNkMxRkY1NkFBMTJDQTMzIDB4M0NFNkJGQzYzODE0NTk2Njc5QUQ0OTY1RjA3QUM4ODAzQzE5QTExRUFCRDU3RjdERDAwNkRCODc3MjRENjgxRCkpKCgweDFBQzg0NEQzMEE4QUExNDUyQzg4OUYwM0JCRDM2RTk0MzMzMTY1MEZGQUUxNkRCODJCMzE0NUFERjdFQkY1MzcgMHgwMUM5MzEzM0FDNDE4RjczQTgxMkI1RDY4NjRGNEYzMDRFQ0Y0QjdBNkY5NUEzODgzMDI0Nzg5QkRBRkE4MTU1KSgweDA3OUZEQUU1OENBNjE2ODBCODMyMTU5NUNGQzkwRTMxQ0FGNDkwOTZGRjA5MkUxMjQxMzEzQzhCREU2REVGQzEgMHgzMEY1ODc3QzdBMDkwOTlFM0Y0OTQ1MDE3MTEwOEREMjFEMjA5OUQyNDZEMTM0MTg4QUVDMEE2QTVCNDBCQTNEKSkoKDB4MjZCMTE5QkNGMEQ1QTRBOEIxNERFODNGNjlDRUIzQzg2MzEzQ0ZFNUYyOTM5MkVDQjAwQTNBQzgxRjJDOUQzRCAweDMwQTA2MTAzQzUxMDdCMjVBMUVDMTM4OUJDQUE1QjVDMTNGNjdCQTEwQjcyRUVERDc0QTFEREYyNzNCQ0ExRDIpKDB4MThDNTBCRkNBOTE1N0MzRjQ2NzE2OTc0RUJDRTMzMDg4REZCNjI2QzgwRDUzNUExMTE4ODdCNDdEMDAyMDY4MSAweDI2N0FGNzBDOUM0RTg1NkI2NDc3RkJBNTAxN0Q0MDE4QUY1REQyMDM5NjY5OTFBODUwNUYwQTIzQTRDQzAyMTcpKSgoMHgyQzczRTJDQ0RFNkY3RkM2QkUzNEJEMDU5NzFGNjIyNjczMjdENTNBQ0JFNkVBNTlGQUNFOUEyOTE3OTMwNTEzIDB4MjFGRjMzMzRFQUI4RjQzNjZEQkMzRjM3QkU4NkUwODcwMkQ2ODgxM0IxOUVBREE1MEI3OTJCN0Q0OEFCRkJBOSkoMHgxMkRCRUFDOEMzNkFFRDJFMEM5QUIzRkZBMDA0NkMyMEZEQ0M5NDIzQjNBMjFBRUY4NkU1ODg4NDhEMzQ2MjIzIDB4MDIwMTNGNzg0RkQzMEZERTdBRjU4MUYxODI1NTVEREU0MTAxOURBRTI0ODEwNDg1N0E4RjEwMDBDOTdENzI5NykpKCgweDAyQkExODc1MzNDN0YzMDU2MjdDOUJDRUNGNzZGOEMzQjYzRkQ1RjVBRjlCMURDOEVEQTVBRTgzN0FFNEZEQzUgMHgyRjNEMjE4QUNBRUFGNjU2M0VDOTc4NUZDOTI1OEU1QTU2REFGMDc1RjhDREFCRjI3NkMyMEMxNTdBRTRCNkNFKSgweDI4MDJENTM0Q0JFQkFFRTI5NkNCOUI2NkRENzBFNDNFNjdFMkRFQkQxMDEyNDkzMTRFNUY2QTUwQ0YwNUFERUMgMHgzMEE1MTg5MTgzNUEwQ0NBMkM2NDBDQUMwRTA1NkU3NzVBQUFFMDU2RDc2MTQxNDkxMEFDOEM4Q0ZBQjY1M0JFKSkpKSh6XzEgMHgwMUMxQTVFNUE4RDEzOUY1NDVBNUIzMzVCOTUwMTk5REY4NDU5OTA3QjE4M0YyQTM1REI2NjgxMjQ5REQwQzREKSh6XzIgMHgxNTcwRjgzRTAxQkFDRTRDNThEMjREMEIyRkZENUZFNDFEQzA5NDU2RTgzMEVBODFFOEUxRjg3RjE1MTlEMEFEKShkZWx0YSgweDA1NUM2NEQwNDY3RDUzOEU2QjY5QjA1QzhDRThGNzJDQjMzODdEOEUzNDgzN0I3QjlFMUExRjhEQTFDRjE1NEIgMHgwMkIyOEE1MTg0MTY2RTExQkJCOUQwQUI1ODREMTIzNTVGMDAyQTAyN0Y2QTA1NTJFM0UxRTM3NUUyOEZFRDUwKSkoY2hhbGxlbmdlX3BvbHlub21pYWxfY29tbWl0bWVudCgweDBGNThBQzJBQzAzRkU4NUMzMjNCN0VGMjg2QjI4RkZCQzk0MEVERDE5QTYyQzU4MUI2OTk4Rjk1QTg2REYxMDggMHgyRTZCMjA1N0E4MDE2Njg3NkEyRTREQURGN0VFMEM2NzQ1MEY4NDgyRUM4QkQ4Rjc2NzNGNTQ1NzJDRTU2OUUwKSkpKShldmFscygoKHcoKDB4MDk1Q0I1NzU2NUQ1MTRFNEU5Mjc2QkQ3NDRFMTU5NjA4NjQ0RkUyRDc5NDY1MDk0ODY1RDdBQzRFOTI0OUNCMCkoMHgyOTFFREMxRkFCRkRFODZDNjE5ODk4QTkxNjI5OEU5MjYyQzUwOTEyMjY1QjI5QkM0MUYzNDE0RUI3MzE5MTAxKSgweDA4MzZEQ0I4RTZFMDI0RTc4RDdEQ0M4QjRDQjE4RjJDNERFOEMwQUUzM0FFQzU1Qjk3N0U1RTE2QjU4MDFCM0IpKDB4MUU2RTFBNDJBN0RDQzcyMTVCQjZDRjg5NzVGNDY4QUY5MzE0QzFFRjlEMzJDMUZDMjkxRUI5NkZCMTdBQTVENykoMHgyMTM2MTEwQzhGMDI2NEEzODc0Q0ZFNTg4RTNDNzI0N0Y4QTlENkI3NEYwRTU3NEM4NkY3OEI4N0VBQ0U1MkNEKSgweDJBQkU5QjRCMTA2QkZERUJCRTJFMDY1RkJFM0I4MTE4N0E5QzhGOEQ5MkI0QTg4MDY3QjVGMDM4RDEyMzI2RTkpKDB4MzI5RTQzQjBBNEQxM0IyMEI4QkFFMjNFREQxM0ZBQUQ4RDlGM0U3NTQxOERCNTkzQTVDMEY0OTNBNkQyRDQ2MSkoMHgwODI3MDRBMDhBOTk5MDkxNkExMDRCNTFDN0FGMDEyREI3RTJFNEM3OUEzMjZCMkMxMDcwOUM1NUUyNTg1MDk2KSgweDIxMDJDRDc3MTEyMDg5NTYxMEEyMkQwQTU0MzlDNTlCMTgxMkVFNTFFOTQ0NTZFOEIxMTJDMDRCNzY2MkQ1MTIpKDB4MzgxNDUyNTM3RUFCMUVCMTA0MjkwQUU4NUMyMzAzQTAyQUZFMjAwNkNENjFFOUY2Q0I0OUMwQTcxRTQ2RDFBQSkoMHgyOEU3MTkzOTEwOTY1ODkxQzNBNzEwMTE1RDVERjQ3RkRERTYxMUE3ODgyOTQwOUU5NThENzQ0OERCQzY5RUQwKSgweDNCMDdFNkMwQjMwRUUwNDk1OTZGRTI3QTMwNTUwQTNEMjFDMTJDMUY0MDk2NENCRDQ5MjYzMDE3RDQ0Qjk2NkIpKDB4MEI3RjhDNzY4M0FGOTZBMzlCM0JEMDk0NDRGRDYxQkYzMUE1NTEyODc1M0U2MjBCQzMzNDA5NjI3OUYxOEJBMykoMHgyQzhGOUVBRTA2NTkxQzBFRUY4NkUwNERENDQ5MjhCQjU0OTQwOTY4RUI5MEU3ODJCNTJCNTFBREZFRUQwRDkzKSgweDM3NEIwMUE3RUYyNjI1NTNBRUY3MTlCRTJCRjMxMjU3MzYyQkE3REZCMEEyNjhFNTRDQURGNTI3OUQ2MTU4QTIpKSkoeigweDFBREM3NTg5M0VFNDdGODNCREQ3MjIyREQxM0UzNkNDRjY4RDBBMTZBRkI0RURFMUQ3MEIwMjMxNTZBMzA4MDQpKShzKCgweDFDMEJFRDRGNTU3NjI5MjI4NjdFQjgwNkVCRDI0N0VGN0FEQkMzMTdDMkFCQzc3REI0ODAzQkNCNjYwMTg5RkQpKDB4MUU3REE0MEIxMkYzODYxMkM5QzMyODlBQzU5NTVEQThEMjNENEMxOUY4QTFCQTY4ODU1MTkwNjU0RUQ3MTQ3RSkoMHgwQUJEQ0U3Q0UxRENENEZDMDlGMDUxQzhBNkFEMDhCRjhCMTIzOEUwNTAxNEVEQkY3Q0U2RTVEQkM0RTlDMjlCKSgweDAxNUJEODYzQjY0M0Q0MDlCM0NGODZCQTE5REQ1MkVBRDczRDA1MUM2MjgzNzQyRTI1RTI3MTk2QkJENEIyNjUpKDB4MTAzNEQ3RkZDNEI4MEFFM0NCRjU1RDRCNkUyRkRDMUM0OTZDNjk2Q0ZERjk1MzcyNTJGOTQ4MUQ5OEIzNDYwMSkoMHgxODBBMENEN0JEQTY3NUM2OTExMzI3OUE1MDFEM0Y4NDIzNkFFMURBQURDNzVDODdGNzAxODJERjIyMkI5QTU0KSkpKGdlbmVyaWNfc2VsZWN0b3IoMHgwQUY3OTREOTExMUQzMzEzOTY0QjgxQzBGQUMxRTk2MTdDNTVFNzlFQTdDQTk5RjI5NzBFNzc5NTVGNjY3MDc4KSkocG9zZWlkb25fc2VsZWN0b3IoMHgxOTA2MTI2MkJCMUNGMjE1RjE0NTZDRkFBQkNGRUFGQ0ZEQjI0QkYzOTc2ODcxOTVFQ0UzNkUyRjE4NkJFMTY0KSkpKCh3KCgweDMyNDQwRjBFMUZFNUNCMzQ0N0M0RkVEMENCNDBCNDY0RDFENzNGNkU5QkM0QTZDRTU1OTkyOThFRDI0MTA0MzQpKDB4MzU4RTY2MzBGM0U4OUM1MDU0RUUzMEE5MEIxMUY0NTIxNDdDOTM2QzY2MjVFMUU5QUQyNUNBMkIxMTM4RUEyRikoMHgyRkNGMEZEQjA1NjVBOEJEMUYyMTEwMjRGMEM4NjlDMkIwQzMzM0NFNkQxNTZGNDk2MTMyMTUzNUQ1RkYyRjgyKSgweDA5MzEyQ0EwQzJDRkIzRURFMTJDNDk3Qzc5ODQxNDE5OThDMUUwREI3MzJDQkNCRjFGODU3QUVDMjNDMzI1RjApKDB4MkYxMDkxMDY3Q0ZGREY3RTkxOEFBRjhEOTQ1NzJFOTgxNzlBN0U5NTg1NTM4OEFCNjE4M0NCMzU5Q0NCNThEQSkoMHgxNjM5N0Q0MTJFMTg4MzcyODM2MEQxRjMxMTQ4Njk0OTAyRjg4NkE2QjE2MDY0NEUxRjkyOEY0MTI3N0IyQ0I3KSgweDNDODk4NTc1NEUyRTA1NDUxQ0ZGRUIwRDA0RTJGNDBEQjFGMzEyMzA4NTc4NDQxMTc3NTA3RjY2RjVBM0UwMjIpKDB4M0QxQ0U0RUUxQkNDQTVENTI2MUZCNEFCODZBQUJGMjEwQTYxQzY4OEI3N0EzQ0VENjBEMzNCMzIwRTQ3NDZGOCkoMHgzRjcwRkU3NkM3M0YzMjQyMTlCODE5MTc4MUJERjE4OEFFRDU5QkVERThCMTgyREQ1RkEwNzkyREUzNEI5MjJFKSgweDBDMTQ2OTZBODQ5MzU5QUU1MDc4NUQ1MUM5ODIzODUyMDhENjAyMEFEODUyNzZCRTlBM0JGQTQ1RUUyRjQyNTgpKDB4MjgzRDIxQzBGRjI5QTQwREZGMzE5NTNBMEExOUM2MTUwNDQwRjFGNjNFNTExQjNGODY2MjgzRjg5QzdDNzVENikoMHgwMDBFMTZCNzdEM0MzMDJDOTRGMEVEMzY4NUY1M0Y4MkQ3NEI4RDFBREREQjI5MTkxMkVENUQ1NjhGQ0U2QTQ1KSgweDA3RTFCRjQ4RTYwMkZCN0VFQjhGQTczQzI0RUFERjg4NjJCNEI5MUY1REIxNkRCMUU3NDMwMkQ5OTg0NzRGMjIpKDB4MUQ4QzUyQTAyNTkyQTkyOUVGNDlGQzg4Q0I3QTM0NTQ2NDNFRTRDRUNBNDlCREU5OUVERTkxQzIwNTk1QTg5OCkoMHgyREE2RjE2ODkwMjJEN0EwRDkxMTU4NDMxMDE2OTRDQjc5NzM2REFCOEUxODU4RERGMTQ0NjlBQTY2NTc5NkQ1KSkpKHooMHgxNTU4RTIwODhEMjgyRTIwQkMwNzhBMjFGMzcyN0IxOTNDRjJCNkI5NTE5RTIzQTI5RTZEMTA5Qzk1Mzg5OUJCKSkocygoMHgyQzE4MDU0QjJDQ0VDRDkxRTgzRTEwQ0E0RDJFMzFBOUU2MTQ5QUZBRDQxRTU3Nzk3QzExMTBEOTM5NDgwNDQwKSgweDE1RjFCNURDNUI3NUZGQUUyMEM1ODI4QTRDRjEwRUYzNkREMzdFRDM0OUE1MzgzMkU0MTBCQ0ZEQ0U2NjY2ODgpKDB4MTA5Njk5NENDOTRCQ0FFRTg1OERFNTBGOTBDNEVENjkzRTc2MDRGQzk5RUM1MkJENEUyOTg5MDYxRTNEQjU2NCkoMHgyOEJFREQ4MzhEMzBGQzcyNjBFMkFGODg0QzRERTg0QTU0QThGQUNGQjkyQzE2NUEzNEU1NUVERTFERjQwQUMyKSgweDEyNTFBODIzMkUzMDQ2ODlCMzA5QzZERDlERTU5RDg0OTRFODE4OUI4MDg0MkY1RkExRkZGMjQ5MEM4ODNEOEMpKDB4MzExMzYwNDEwODcxMTcyOTgzNThDMjc5ODY4MTVDQjYwNEZEOTc1OTU3QjYwRTVCQjdGNjY3Qzg3RTM1RjI3NykpKShnZW5lcmljX3NlbGVjdG9yKDB4MEFGMjhDRjQ2NDE3RUIzMzA3REMzQUEwOTI1QTE3NTg3RDhDMEM5NTcxMjBEQjNCMDQxOTY0NDdCRTA0ODRDQikpKHBvc2VpZG9uX3NlbGVjdG9yKDB4MUI3MTQ5RDJCODVGNUJGMUQ2MTUzRDc2NjMzMjRDRjg5RUM5QjE1MkM4RTM0RjJCQjNBNDBCNTg3QkRGMDhFRikpKSkpKGZ0X2V2YWwxIDB4M0JGMEZGMkNGNjM3MjY1Nzk5Qjk3NEFENDk2MzU4QURCNUQ5QjYxMDRGNTVGRENDQ0E2OTFGOURERjE0QUIzRSkpKSkpKQ==","signature":null}}],"memo":"E4YM2vTHhWEg66xpj52JErHUBU4pZ1yageL4TVDDpTTSsv8mK6YaH"}'
)).sign([feePayerKey]).sign([zkappKey]).sign([zkappKey2])
*/


shutdown();