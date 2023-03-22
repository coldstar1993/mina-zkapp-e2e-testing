import { AccountUpdate, fetchAccount, Field, isReady, MerkleMap, Mina, Poseidon, PrivateKey, PublicKey, shutdown, Signature, UInt32, UInt64 } from 'snarkyjs';
import { XTokenContract } from './XTokenContract.js';
import { getProfiler } from "./profiler.js";
import { Membership } from './Membership.js';

describe('test fuctions inside XTokenContract', () => {
    async function runTests(deployToBerkeley = false) {
        let Blockchain: any;
        let deployerAccount: PublicKey,
            deployerKey: PrivateKey,
            senderAccount: PublicKey,
            senderKey: PrivateKey,
            zkAppVerificationKey: any,
            zkAppAddress: PublicKey,
            zkAppPrivateKey: PrivateKey,
            zkApp: XTokenContract,
            xTokenContractMerkleMap: MerkleMap;
        let XTokenContractTestProfiler = getProfiler('XTokenContract zkApp');

        let membershipZkAppPrivateKey: PrivateKey;
        let membershipZkAppAddress: PublicKey;
        let membershipZkApp: Membership;
        let membershipVerificationKey: any;

        let purchaseStartBlockHeight: UInt32;
        let purchaseEndBlockHeight: UInt32;
        let tokenSupply: UInt64;
        let maximumPurchasingAmount: UInt64;
        let memberShipContractAddress: PublicKey;

        const constructOneUserAndPurchase = async (userPriKey: PrivateKey, purchaseAmount0: UInt64, prePurchaseCallback: any) => {
            let userPubKey = userPriKey.toPublicKey();
            console.log(`firstUserPriKey: ${userPriKey.toBase58()},  firstUserPubKey: ${userPubKey.toBase58()}`)

            // get witness for existence
            let indx = Poseidon.hash(userPubKey.toFields());
            let userValue = xTokenContractMerkleMap.get(indx);
            console.log(`firstUserValue: ${userValue.toString()}`);
            let firstUserMerkleMapWitness = xTokenContractMerkleMap.getWitness(indx);
            console.log(`firstUserMerkleMapWitness: ${firstUserMerkleMapWitness.toJSON()}`)

            try {
                // construct a tx and send
                XTokenContractTestProfiler.start('Mina.transaction()');
                let tx = await Mina.transaction(senderAccount, () => {
                    prePurchaseCallback(senderAccount, userPriKey);
                    zkApp.purchaseToken(userPubKey, purchaseAmount0, firstUserMerkleMapWitness);
                });
                XTokenContractTestProfiler.stop();
                XTokenContractTestProfiler.start('tx.prove()');
                await tx.prove();
                XTokenContractTestProfiler.stop();
                tx.sign([senderKey, userPriKey]);
                console.log('Section-1_tx: ', tx.toJSON());
                XTokenContractTestProfiler.start('tx.send()');
                await tx.send();
                XTokenContractTestProfiler.stop();

                // store the user=======================
                xTokenContractMerkleMap.set(indx, Field(1));
            } catch (error) {
                console.error(error);
            }
        }

        beforeAll(async () => {
            XTokenContractTestProfiler.start('isReady');
            await isReady;
            XTokenContractTestProfiler.stop();

            XTokenContractTestProfiler.start('Membership.compile');
            membershipVerificationKey = (await Membership.compile()).verificationKey;
            XTokenContractTestProfiler.stop();

            XTokenContractTestProfiler.start('XTokenContract.compile');
            zkAppVerificationKey = (await XTokenContract.compile()).verificationKey;
            XTokenContractTestProfiler.stop();

            Blockchain = deployToBerkeley ? Mina.Network('https://proxy.berkeley.minaexplorer.com/graphql') : Mina.LocalBlockchain({ proofsEnabled: true });
            Mina.setActiveInstance(Blockchain);
        });

        afterAll(() => {
            setInterval(shutdown, 0);
        });

        beforeEach(async () => {
            purchaseStartBlockHeight = UInt32.from(0);
            purchaseEndBlockHeight = UInt32.from(1000);
            tokenSupply = UInt64.from(6);
            maximumPurchasingAmount = UInt64.from(2);
            memberShipContractAddress = PublicKey.fromBase58('B62qnPVRjL5cHFzqa6Pswv9R38QtEFswT424itx2qcv3uiuJpz9XUG8');

            if (deployToBerkeley) {// Berkeley
                deployerKey = PrivateKey.fromBase58('EKEvpZnLn2nMtnpwkfJJ3sLVCKxZFJguBLEhsr4PLrX4Qx7xhgAm');
                deployerAccount = deployerKey.toPublicKey();// B62qpBXC73946qhNhZLrc4SRqN6AQB4chEL6b5w4uMkZks9Mrz8YphK

                let deployerAccountInfo: any;
                try {
                    XTokenContractTestProfiler.start('to fetchAccount for deployerAccount...');
                    deployerAccountInfo = await fetchAccount({ publicKey: deployerAccount });
                    XTokenContractTestProfiler.stop();
                } catch (error) {
                    console.error(error);
                }
                try {
                    if (deployerAccountInfo == undefined) {
                        XTokenContractTestProfiler.start('Mina.faucet(deployerAccount)');
                        await Mina.faucet(deployerAccount);
                        XTokenContractTestProfiler.stop();
                    }
                } catch (error) {
                    console.error(error);
                }

                senderKey = PrivateKey.fromBase58('EKEYaNo9HxkMpNrjuAYCXug42TJnij36MkEnDsx58TfF3cFNff3n');
                senderAccount = senderKey.toPublicKey();//B62qk1UHVMMQ28U54vayJuXxLo9wd8vo5vEMNoLuK3haFN8kziKcAiX
                let senderAccountInfo: any;
                try {
                    console.log('to fetchAccount for senderAccount...');
                    senderAccountInfo = await fetchAccount({ publicKey: deployerAccount });
                    console.log('done!');
                } catch (error) {
                    console.error(error);
                }
                if (senderAccountInfo == undefined) {
                    XTokenContractTestProfiler.start('Mina.faucet(senderAccount)');
                    await Mina.faucet(senderAccount);
                    XTokenContractTestProfiler.stop();
                }
            } else {// Local
                ({ privateKey: deployerKey, publicKey: deployerAccount } = Blockchain.testAccounts[0]);
                ({ privateKey: senderKey, publicKey: senderAccount } = Blockchain.testAccounts[1]);
            }

            console.log(`deployerKey: ${deployerKey.toBase58()}, deployerPubKey: ${deployerAccount.toBase58()}`);
            console.log('initially deployerAccount.balance: ', Mina.getAccount(deployerAccount).balance.div(1e9).toString());
            console.log(`senderKey: ${senderKey.toBase58()}, senderAccount: ${senderAccount.toBase58()}`);
            console.log('initially senderAccount.balance: ', Mina.getAccount(senderAccount).balance.div(1e9).toString());

            membershipZkAppPrivateKey = PrivateKey.fromBase58('EKE4fbhYRaLew1qqbNBhropfy5ByHDrLWBzsyJjdMfP1jFn93Ru5');
            membershipZkAppAddress = membershipZkAppPrivateKey.toPublicKey();
            membershipZkApp = new Membership(membershipZkAppAddress);
            console.log('membershipZkAppPrivateKey: ', membershipZkAppPrivateKey.toBase58(), ' ,  membershipZkAppAddress: ', membershipZkAppAddress.toBase58());

            zkAppPrivateKey = PrivateKey.fromBase58('EKEKv6ZCt5eZ5DF3DupbnWZMFp7NVzGGvSyrDByZNywPDeLDUpPg');
            zkAppAddress = zkAppPrivateKey.toPublicKey();
            zkApp = new XTokenContract(zkAppAddress);
            console.log('xTokenContractZkAppPrivateKey: ', zkAppPrivateKey.toBase58(), ' , xTokenContractZkAppAddress: ', zkAppAddress.toBase58());

            let needDeployMembership = false;
            let needDeployXTokenContract = false;
            if (deployToBerkeley) {// Berkeley
                XTokenContractTestProfiler.start('Mina.fetchAccount(zkAppAddress)');
                let membershipZkAppAccountInfo = await fetchAccount({ publicKey: membershipZkAppAddress });
                XTokenContractTestProfiler.stop();
                if (membershipZkAppAccountInfo.account?.zkapp == undefined) {
                    // check if need to deploy to Berkeley Network
                    needDeployMembership = true;
                }

                XTokenContractTestProfiler.start('Mina.fetchAccount(zkAppAddress)');
                let zkAppAccountInfo = await fetchAccount({ publicKey: zkAppAddress });
                XTokenContractTestProfiler.stop();
                if (zkAppAccountInfo.account?.zkapp == undefined) {
                    // check if need to deploy to Berkeley Network
                    needDeployXTokenContract = true;
                }
            } else {
                needDeployMembership = true;
                needDeployXTokenContract = true;
            }

            if (needDeployMembership) {
                // deploy zkApp
                let tx = await Mina.transaction(deployerAccount, () => {
                    AccountUpdate.fundNewAccount(deployerAccount);
                    membershipZkApp.deploy({ zkappKey: membershipZkAppPrivateKey, verificationKey: membershipVerificationKey });
                });
                let txId = await tx.sign([deployerKey]).send();
                await txId.wait();
                console.log(`membershipZkApp deployment tx sent: txId.isSuccess:`, txId.isSuccess);
            }
            if (needDeployXTokenContract) {
                // deploy zkApp
                let tx = await Mina.transaction(deployerAccount, () => {
                    AccountUpdate.fundNewAccount(deployerAccount);
                    zkApp.deploy({ zkappKey: zkAppPrivateKey, verificationKey: zkAppVerificationKey });
                });
                let txId = await tx.sign([deployerKey]).send();
                await txId.wait();
                console.log(`xTokenContractZkApp deployment tx sent: txId.isSuccess:`, txId.isSuccess);
            }

            xTokenContractMerkleMap = new MerkleMap();
            const merkleRoot0 = xTokenContractMerkleMap.getRoot();
            console.log(`xTokenContractMerkleMap's initial root: ${merkleRoot0.toString()}`);

            // initialize XTokenContract
            XTokenContractTestProfiler.start('initialize XTokenContract');

            const hashx = Poseidon.hash([...tokenSupply.toFields(), ...maximumPurchasingAmount.toFields(), ...memberShipContractAddress.toFields(), ...purchaseStartBlockHeight.toFields(), ...purchaseEndBlockHeight.toFields()]);
            let adminSignature = Signature.create(zkAppPrivateKey, [hashx]);
            const tx = await Mina.transaction(senderAccount, () => {
                zkApp.initInfo(
                    tokenSupply,
                    maximumPurchasingAmount,
                    memberShipContractAddress,
                    purchaseStartBlockHeight,
                    purchaseEndBlockHeight,
                    adminSignature
                );
            });
            XTokenContractTestProfiler.stop();
            XTokenContractTestProfiler.start('tx.prove()');
            await tx.prove();
            XTokenContractTestProfiler.stop();
            tx.sign([senderKey]);
            XTokenContractTestProfiler.start('tx.send()');
            await tx.send();
            XTokenContractTestProfiler.stop();

            XTokenContractTestProfiler.store();
        });
        /* 
                it(`purchase tokens by an non-existing user`, async () => {
                    let totalAmountInCirculation0 = zkApp.totalAmountInCirculation.get();
                    let memberTreeRoot0 = xTokenContractMerkleMap.getRoot();
        
                    let userPriKey = PrivateKey.random();
                    await constructOneUserAndPurchase(userPriKey, maximumPurchasingAmount, (senderAccount0: PublicKey, userPriKey0: PrivateKey) => {
                        let accUpdt = AccountUpdate.fundNewAccount(senderAccount0, 2);
                        accUpdt.send({ to: userPriKey0.toPublicKey(), amount: 15 * 1e9 });
                    });
        
                    expect(membershipZkApp.memberTreeRoot.get()).not.toEqual(memberTreeRoot0);
                    expect(membershipZkApp.memberTreeRoot.get()).toEqual(xTokenContractMerkleMap.getRoot());
                    expect(membershipZkApp.memberCount.get()).toEqual(UInt32.from(1));
                    expect(zkApp.totalAmountInCirculation.get()).toEqual(totalAmountInCirculation0.add(2));
                })
        
        
                it(`purchase tokens by an existing user`, async () => {
                    let totalAmountInCirculation0 = zkApp.totalAmountInCirculation.get();
                    let memberTreeRoot0 = xTokenContractMerkleMap.getRoot();
                    let memberCount0 = membershipZkApp.memberCount.get();
        
                    let userPriKey = PrivateKey.random();
                    await constructOneUserAndPurchase(userPriKey, maximumPurchasingAmount, (senderAccount0: PublicKey, userPriKey0: PrivateKey) => {
                        let accUpdt = AccountUpdate.fundNewAccount(senderAccount0, 2);
                        accUpdt.send({ to: userPriKey0.toPublicKey(), amount: 15 * 1e9 });
                    });
        
                    expect(membershipZkApp.memberTreeRoot.get()).not.toEqual(memberTreeRoot0);
                    expect(membershipZkApp.memberCount.get()).toEqual(UInt32.from(1));
                    expect(zkApp.totalAmountInCirculation.get()).toEqual(totalAmountInCirculation0.add(2));
        
                    console.log('=======================the same user purchases tokens again=======================');
                    totalAmountInCirculation0 = zkApp.totalAmountInCirculation.get();
                    memberTreeRoot0 = membershipZkApp.memberTreeRoot.get();
                    memberCount0 = membershipZkApp.memberCount.get();
        
                    // construct a tx and send
                    await constructOneUserAndPurchase(userPriKey, maximumPurchasingAmount, (senderAccount0: PublicKey, userPriKey0: PrivateKey) => {
                        let accUpdt = AccountUpdate.fundNewAccount(senderAccount0);
                        accUpdt.send({ to: userPriKey0.toPublicKey(), amount: 15 * 1e9 });
                    });
        
                    expect(membershipZkApp.memberTreeRoot.get()).toEqual(memberTreeRoot0);// should equal
                    expect(membershipZkApp.memberCount.get()).toEqual(memberCount0);
                    expect(zkApp.totalAmountInCirculation.get()).toEqual(totalAmountInCirculation0);
        
                    XTokenContractTestProfiler.store();
                });
         
        it(`purchase tokens when exceeding precondition.network.blockchainLength`, async () => {
            let totalAmountInCirculation0 = zkApp.totalAmountInCirculation.get();
            let memberCount0 = membershipZkApp.memberCount.get();
            let merkleRoot0 = membershipZkApp.memberTreeRoot.get();

            console.log('currentSlot0', Blockchain.currentSlot().toString());
            Blockchain.setGlobalSlot(purchaseEndBlockHeight.add(1));// TODO how to take this into Berkeley Network?
            console.log('currentSlot1', Blockchain.currentSlot().toString());

            let userPriKey = PrivateKey.random();
            await constructOneUserAndPurchase(userPriKey, maximumPurchasingAmount, (senderAccount0: PublicKey, userPriKey0: PrivateKey) => {
                let accUpdt = AccountUpdate.fundNewAccount(senderAccount0, 2);
                accUpdt.send({ to: userPriKey0.toPublicKey(), amount: 15 * 1e9 });
            });

            expect(membershipZkApp.memberTreeRoot.get()).toEqual(merkleRoot0);
            expect(membershipZkApp.memberCount.get()).toEqual(memberCount0);
            expect(zkApp.totalAmountInCirculation.get()).toEqual(totalAmountInCirculation0);

            XTokenContractTestProfiler.store();
        });


        it(`purchase tokens when exceeding maximum purchasing amount`, async () => {
            let totalAmountInCirculation0 = zkApp.totalAmountInCirculation.get();
            let memberCount0 = membershipZkApp.memberCount.get();
            let merkleRoot0 = membershipZkApp.memberTreeRoot.get();

            let userPriKey = PrivateKey.random();
            await constructOneUserAndPurchase(userPriKey, maximumPurchasingAmount.add(1), (senderAccount0: PublicKey, userPriKey0: PrivateKey) => {
                let accUpdt = AccountUpdate.fundNewAccount(senderAccount0, 2);
                accUpdt.send({ to: userPriKey0.toPublicKey(), amount: 15 * 1e9 });
            });

            expect(membershipZkApp.memberTreeRoot.get()).toEqual(merkleRoot0);
            expect(membershipZkApp.memberCount.get()).toEqual(memberCount0);
            expect(zkApp.totalAmountInCirculation.get()).toEqual(totalAmountInCirculation0);

            XTokenContractTestProfiler.store();
        });


        it(`purchase tokens when (totalAmountInCirculation + purchasingAmount)>SUPPLY `, async () => {
            console.log('========================firstUser starts========================');
            let userPriKeyFirst = PrivateKey.random();
            await constructOneUserAndPurchase(userPriKeyFirst, maximumPurchasingAmount, (senderAccount0: PublicKey, userPriKey0: PrivateKey) => {
                let accUpdt = AccountUpdate.fundNewAccount(senderAccount0, 2);
                accUpdt.send({ to: userPriKey0.toPublicKey(), amount: 15 * 1e9 });
            });

            console.log('========================secUser starts========================');
            let userPriKeySec = PrivateKey.random();
            await constructOneUserAndPurchase(userPriKeySec, maximumPurchasingAmount, (senderAccount0: PublicKey, userPriKey0: PrivateKey) => {
                let accUpdt = AccountUpdate.fundNewAccount(senderAccount0, 2);
                accUpdt.send({ to: userPriKey0.toPublicKey(), amount: 15 * 1e9 });
            });

            console.log('========================thirdUser starts========================');
            let totalAmountInCirculation0 = zkApp.totalAmountInCirculation.get();
            let memberCount0 = membershipZkApp.memberCount.get();
            let merkleRoot0 = membershipZkApp.memberTreeRoot.get();

            let userPriKeyThird = PrivateKey.random();
            await constructOneUserAndPurchase(userPriKeyThird, maximumPurchasingAmount.add(1), (senderAccount0: PublicKey, userPriKey0: PrivateKey) => {
                let accUpdt = AccountUpdate.fundNewAccount(senderAccount0, 2);
                accUpdt.send({ to: userPriKey0.toPublicKey(), amount: 15 * 1e9 });
            });

            expect(membershipZkApp.memberTreeRoot.get()).toEqual(merkleRoot0);
            expect(membershipZkApp.memberCount.get()).toEqual(memberCount0);
            expect(zkApp.totalAmountInCirculation.get()).toEqual(totalAmountInCirculation0);

            XTokenContractTestProfiler.store();
        });
*/
    }

    runTests(false);
    // runTests(true);
});