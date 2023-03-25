import { Add } from './Add';
import {
  isReady,
  shutdown,
  Field,
  Mina,
  PrivateKey,
  PublicKey,
  AccountUpdate,
  fetchAccount,
  UInt64,
  UInt32,
} from 'snarkyjs';

/*
 * This file specifies how to test the `Add` example smart contract. It is safe to delete this file and replace
 * with your own tests.
 *
 * See https://docs.minaprotocol.com/zkapps for more info.
 */

let proofsEnabled = false;

describe('Add', () => {
  let deployerAccount: PublicKey,
    deployerKey: PrivateKey,
    senderAccount: PublicKey,
    senderKey: PrivateKey,
    zkAppAddress: PublicKey,
    zkAppPrivateKey: PrivateKey,
    zkApp: Add;

  beforeAll(async () => {
    await isReady;
    if (proofsEnabled) Add.compile();
  });

  beforeEach(async () => {
    const Local = Mina.LocalBlockchain({ proofsEnabled });
    Mina.setActiveInstance(Local);
    ({ privateKey: deployerKey, publicKey: deployerAccount } =
      Local.testAccounts[0]);
    console.log('initially deployerAccount.balance: ', Mina.getAccount(deployerAccount).balance.div(1e9).toString());

    ({ privateKey: senderKey, publicKey: senderAccount } =
      Local.testAccounts[1]);
    zkAppPrivateKey = PrivateKey.random();
    zkAppAddress = zkAppPrivateKey.toPublicKey();
    zkApp = new Add(zkAppAddress);
    console.log('zkAppAddress: ', zkAppAddress.toBase58());
  });

  afterAll(() => {
    // `shutdown()` internally calls `process.exit()` which will exit the running Jest process early.
    // Specifying a timeout of 0 is a workaround to defer `shutdown()` until Jest is done running all tests.
    // This should be fixed with https://github.com/MinaProtocol/mina/issues/10943
    setTimeout(shutdown, 0);
  });

  async function localDeploy() {
    const txn = await Mina.transaction(deployerAccount, () => {
      const accountUpdateDeployer = AccountUpdate.fundNewAccount(deployerAccount);
      accountUpdateDeployer.send({ to: zkAppAddress, amount: 2e9 });
      zkApp.deploy();
    });
    await txn.prove();
    // this tx needs .sign(), because `deploy()` adds an account update that requires signature authorization
    await txn.sign([deployerKey, zkAppPrivateKey]).send();
    console.log('after deployment: deployerAccount.balance: ', Mina.getAccount(deployerAccount).balance.div(1e9).toString());

    console.log('after deployment: zkAppAddress.balance: ', Mina.getAccount(zkAppAddress).balance.div(1e9).toString());
  }
/* 
  it('transfer Mina from zkApp account before it\'s unlocked', async () => {
    await localDeploy();

    const recipientPrvKey = PrivateKey.random();
    const recipientPubKey = recipientPrvKey.toPublicKey();
    console.log('recipientPubKey: ', recipientPubKey.toBase58());

    const txn = await Mina.transaction(zkAppAddress, () => {
      const accupdt0 = AccountUpdate.createSigned(zkAppAddress);
      accupdt0.balance.subInPlace(1e9);
      const accupdt1 = AccountUpdate.create(recipientPubKey);
      accupdt1.balance.addInPlace(1e9);
    });
    await txn.sign([zkAppPrivateKey]).send();

    console.log('after send: zkAppAddress.balance: ', Mina.getAccount(zkAppAddress).balance.div(1e9).toString());
    console.log('after send: recipientPubKey.balance: ', Mina.getAccount(recipientPubKey).balance.div(1e9).toString());
  });
 */
/*
  it('to lock 0 Mina', async () => {
    await localDeploy();
    const txn = await Mina.transaction(zkAppAddress, () => {
      const accupdt0 = AccountUpdate.createSigned(zkAppAddress);
      accupdt0.account.timing.set({initialMinimumBalance: UInt64.from(1), cliffTime:UInt32.from(2), cliffAmount: UInt64.from(1), vestingPeriod: UInt32.from(0), vestingIncrement: UInt64.from(0)});
    });
    await txn.sign([zkAppPrivateKey]).send();
  });
*/

it('to call update', async () => {
  await localDeploy();
  const txn = await Mina.transaction(zkAppAddress, () => {
    zkApp.update();
    // const acctUpdt = AccountUpdate.create(zkAppAddress);
    // acctUpdt.account.timing.set({initialMinimumBalance: UInt64.from(1), cliffTime:UInt32.from(2), cliffAmount: UInt64.from(1), vestingPeriod: UInt32.from(1), vestingIncrement: UInt64.from(0)});
    // acctUpdt.requireSignature();
  });
  await txn.prove();
  await txn.sign([zkAppPrivateKey]);
  await txn.send();
});

});
