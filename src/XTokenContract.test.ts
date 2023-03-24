import { AccountUpdate, Experimental, fetchAccount, Field, isReady, MerkleMap, Mina, Poseidon, PrivateKey, PublicKey, Reducer, shutdown, Signature, UInt32, UInt64 } from 'snarkyjs';
import { XTokenContract, NormalTokenUser } from './XTokenContract.js';
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

        let normalTokenUserVerificationKey: any;

        let purchaseStartBlockHeight: UInt32;
        let purchaseEndBlockHeight: UInt32;
        let tokenSupply: UInt64;
        let maximumPurchasingAmount: UInt64;
        let memberShipContractAddress: PublicKey;

        const constructOneUserAndPurchase = async (userPriKey: PrivateKey, purchaseAmount0: UInt64, prePurchaseCallback: any) => {
            let userPubKey = userPriKey.toPublicKey();
            console.log(`userPriKey: ${userPriKey.toBase58()},  userPubKey: ${userPubKey.toBase58()}`)

            // get witness for existence
            let indx = Poseidon.hash(userPubKey.toFields());
            let userValue = xTokenContractMerkleMap.get(indx);
            console.log(`userValue: ${userValue.toString()}`);
            let userMerkleMapWitness = xTokenContractMerkleMap.getWitness(indx);
            console.log(`userMerkleMapWitness: ${userMerkleMapWitness.toJSON()}`)

            try {
                // construct a tx and send
                XTokenContractTestProfiler.start('Mina.transaction()');
                let tx = await Mina.transaction(senderAccount, () => {
                    prePurchaseCallback(senderAccount, userPriKey);
                    zkApp.purchaseToken(userPubKey, purchaseAmount0, userMerkleMapWitness);
                });
                XTokenContractTestProfiler.stop();
                XTokenContractTestProfiler.start('tx.prove()');
                await tx.prove();
                XTokenContractTestProfiler.stop();
                tx.sign([senderKey, userPriKey]);
                console.log('constructOneUserAndPurchase_tx: ', tx.toJSON());
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

            normalTokenUserVerificationKey = NormalTokenUser.compile()

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

            const tx = await Mina.transaction(senderAccount, () => {
                zkApp.initInfo(
                    tokenSupply,
                    maximumPurchasingAmount,
                    memberShipContractAddress,
                    purchaseStartBlockHeight,
                    purchaseEndBlockHeight,
                    zkAppPrivateKey
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

            // 错误api使用：expect(zkApp.account.tokenSymbol).toEqual('XTKN');
            const symbol = Mina.getAccount(zkAppAddress).tokenSymbol;
            expect(symbol).toEqual('XTKN');

            // 错误api使用：expect(zkApp.account.zkappUri).toEqual('https://github.com/coldstar1993/mina-zkapp-e2e-testing');
            const zkAppUri = Mina.getAccount(zkAppAddress).zkapp?.zkappUri;
            expect(zkAppUri).toEqual('https://github.com/coldstar1993/mina-zkapp-e2e-testing');

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


        it(`Check if timing-lock Mina balance when totalAmountInCirculation == SUPPLY`, async () => {
            console.log('currentSlot1', Blockchain.currentSlot().toString());
            console.log('blockchainLength1', Mina.getNetworkState().blockchainLength.toString());

            console.log('========================firstUser starts========================');
            let userPriKeyFirst = PrivateKey.random();
            await constructOneUserAndPurchase(userPriKeyFirst, maximumPurchasingAmount, (senderAccount0: PublicKey, userPriKey0: PrivateKey) => {
                let accUpdt = AccountUpdate.fundNewAccount(senderAccount0, 2);
                accUpdt.send({ to: userPriKey0.toPublicKey(), amount: 15 * 1e9 });
            });

            console.log('currentSlot2', Blockchain.currentSlot().toString());
            console.log('blockchainLength2', Mina.getNetworkState().blockchainLength.toString());
            console.log('========================secUser starts========================');
            let userPriKeySec = PrivateKey.random();
            await constructOneUserAndPurchase(userPriKeySec, maximumPurchasingAmount, (senderAccount0: PublicKey, userPriKey0: PrivateKey) => {
                let accUpdt = AccountUpdate.fundNewAccount(senderAccount0, 2);
                accUpdt.send({ to: userPriKey0.toPublicKey(), amount: 15 * 1e9 });
            });

            console.log('currentSlot3', Blockchain.currentSlot().toString());
            console.log('blockchainLength3', Mina.getNetworkState().blockchainLength.toString());
            console.log('========================thirdUser starts========================');
            let userPriKeyThird = PrivateKey.random();
            await constructOneUserAndPurchase(userPriKeyThird, maximumPurchasingAmount, (senderAccount0: PublicKey, userPriKey0: PrivateKey) => {
                let accUpdt = AccountUpdate.fundNewAccount(senderAccount0, 2);
                accUpdt.send({ to: userPriKey0.toPublicKey(), amount: 15 * 1e9 });
            });
            XTokenContractTestProfiler.store();

            // TODO should fetchAccount?
            expect(zkApp.account.balance.get()).toEqual(UInt64.from(30e9));

            console.log('currentSlot4', Blockchain.currentSlot().toString());
            console.log('blockchainLength4', Mina.getNetworkState().blockchainLength.toString());
            Blockchain.setGlobalSlot(purchaseEndBlockHeight.add(1));// TODO how to take this into Berkeley Network?
            console.log('currentSlot5', Blockchain.currentSlot().toString());
            console.log('blockchainLength5', Mina.getNetworkState().blockchainLength.toString());

            console.log('========================try to transfer excess amounts ========================');
            let currentAcctBalance0 = zkApp.account.balance.get();
            let userPriKeyRecipient = PrivateKey.random();
            let userPubKeyRecipient = userPriKeyRecipient.toPublicKey();
            let transferedAmount = currentAcctBalance0.div(3).add(1);// to make it excess
            try {
                let tx = await Mina.transaction(senderAccount, () => {
                    AccountUpdate.fundNewAccount(senderAccount);
                    zkApp.transferMina(userPubKeyRecipient, transferedAmount, zkAppPrivateKey);
                });
                await tx.prove();
                tx.sign([senderKey]);
                await tx.send();
            } catch (error) {
                console.error(error);
            }
            expect(zkApp.account.balance.get()).toEqual(currentAcctBalance0);

            console.log('currentSlot6', Blockchain.currentSlot().toString());
            console.log('blockchainLength6', Mina.getNetworkState().blockchainLength.toString());
            console.log('========================try to transfer suitable amounts ========================');
            let transferedAmount1 = currentAcctBalance0.div(3);// to make it suitable
            try {
                let tx = await Mina.transaction(senderAccount, () => {
                    AccountUpdate.fundNewAccount(senderAccount);
                    zkApp.transferMina(userPubKeyRecipient, transferedAmount1, zkAppPrivateKey);
                });
                await tx.prove();
                tx.sign([senderKey]);
                await tx.send();
            } catch (error) {
                console.error(error);
            }
            expect(zkApp.account.balance.get()).toEqual(currentAcctBalance0.sub(transferedAmount1));
            console.log('currentSlot7', Blockchain.currentSlot().toString());
            console.log('blockchainLength7', Mina.getNetworkState().blockchainLength.toString());

        });
        */
        /* 
                it(`Check if one can only vote for one time To Process Rest Tokens `, async () => {
                    console.log('========================one User starts========================');
                    let userPriKeyFirst = PrivateKey.random();
                    let userPubKeyFirst = userPriKeyFirst.toPublicKey();
                    await constructOneUserAndPurchase(userPriKeyFirst, maximumPurchasingAmount, (senderAccount0: PublicKey, userPriKey0: PrivateKey) => {
                        let accUpdt = AccountUpdate.fundNewAccount(senderAccount0, 2);
                        accUpdt.send({ to: userPriKey0.toPublicKey(), amount: 15 * 1e9 });
                    });
        
                    console.log('========== first vote ==========')
                    let pendingActions0 = zkApp.reducer.getActions({ fromActionHash: Reducer.initialActionsHash });
                    console.log(pendingActions0);
                    try {
                        let tx = await Mina.transaction(userPubKeyFirst, () => {
                            let voter = userPriKeyFirst;
                            let voteOption = UInt64.from(1);
                            let voterMerkleMapWitness = xTokenContractMerkleMap.getWitness(Poseidon.hash(voter.toPublicKey().toFields()));
                            zkApp.voteToProcessRestTokens(voter, voteOption, voterMerkleMapWitness);
                        });
                        await tx.prove();
                        tx.sign([userPriKeyFirst]);
                        await tx.send();
        
                    } catch (error) {
                        console.error(error);
                    }
                    expect(zkApp.reducer.getActions({ fromActionHash: Reducer.initialActionsHash }).length).toBeGreaterThan(pendingActions0.length);
        
                    console.log('========== vote again ==========')
                    let pendingActions1 = zkApp.reducer.getActions({ fromActionHash: Reducer.initialActionsHash });
                    try {
                        let tx1 = await Mina.transaction(userPubKeyFirst, () => {
                            let voter = userPriKeyFirst;
                            let voteOption = UInt64.from(1);
                            let voterMerkleMapWitness = xTokenContractMerkleMap.getWitness(Poseidon.hash(voter.toPublicKey().toFields()));
                            zkApp.voteToProcessRestTokens(voter, voteOption, voterMerkleMapWitness);
                        });
                        await tx1.prove();
                        tx1.sign([userPriKeyFirst]);
                        await tx1.send();
                    } catch (error) {
                        console.error(error);
                    }
                    expect(zkApp.reducer.getActions({ fromActionHash: Reducer.initialActionsHash }).length).toEqual(pendingActions1.length);
                })
         */
        /* 
        it(`Check rollup VoteNotes by reducing Actions`, async () => {
            console.log('========================firstUser starts========================');
            let userPriKeyFirst = PrivateKey.random();
            let userPubKeyFirst = userPriKeyFirst.toPublicKey();
            await constructOneUserAndPurchase(userPriKeyFirst, maximumPurchasingAmount, (senderAccount0: PublicKey, userPriKey0: PrivateKey) => {
                let accUpdt = AccountUpdate.fundNewAccount(senderAccount0, 2);
                accUpdt.send({ to: userPriKey0.toPublicKey(), amount: 15 * 1e9 });
            });
            console.log('     =================firstUser votes===================     ');
            let voteTx1 = await Mina.transaction(userPubKeyFirst, () => {
                let voter = userPriKeyFirst;
                let voteOption = UInt64.from(1);// vote to Burn the extra tokens
                let voterMerkleMapWitness = xTokenContractMerkleMap.getWitness(Poseidon.hash(voter.toPublicKey().toFields()));
                zkApp.voteToProcessRestTokens(voter, voteOption, voterMerkleMapWitness);
            });
            await voteTx1.prove();
            voteTx1.sign([userPriKeyFirst]);
            await voteTx1.send();

            console.log('========================secUser starts========================');
            let userPriKeySec = PrivateKey.random();
            let userPubKeySec = userPriKeySec.toPublicKey();
            await constructOneUserAndPurchase(userPriKeySec, maximumPurchasingAmount.sub(1), (senderAccount0: PublicKey, userPriKey0: PrivateKey) => {
                let accUpdt = AccountUpdate.fundNewAccount(senderAccount0, 2);
                accUpdt.send({ to: userPriKey0.toPublicKey(), amount: 15 * 1e9 });
            });
            console.log('     =================secUser votes===================     ');
            let voteTx2 = await Mina.transaction(userPubKeySec, () => {
                let voter = userPriKeySec;
                let voteOption = UInt64.from(1);// vote to Burn the extra tokens
                let voterMerkleMapWitness = xTokenContractMerkleMap.getWitness(Poseidon.hash(voter.toPublicKey().toFields()));
                zkApp.voteToProcessRestTokens(voter, voteOption, voterMerkleMapWitness);
            });
            await voteTx2.prove();
            voteTx2.sign([userPriKeySec]);
            await voteTx2.send();

            console.log('========================check rollup can\'t be executed without 51% member\'s votes========================');
            // check rollup can't be executed without 51% member's votes.
            let actionHashVote0 = zkApp.actionHashVote.get();
            try {
                let tx = await Mina.transaction(senderAccount, () => {
                    AccountUpdate.fundNewAccount(senderAccount);
                    zkApp.rollupVoteNote();
                });
                await tx.prove();
                tx.sign([senderKey]);
                await tx.send();
            } catch (error) {
                console.error(error);
            }
            expect(zkApp.actionHashVote.get()).toEqual(actionHashVote0);

            console.log('========================thirdUser starts========================');
            let userPriKeyThird = PrivateKey.random();
            let userPubKeyThird = userPriKeyThird.toPublicKey();
            await constructOneUserAndPurchase(userPriKeyThird, maximumPurchasingAmount.sub(1), (senderAccount0: PublicKey, userPriKey0: PrivateKey) => {
                let accUpdt = AccountUpdate.fundNewAccount(senderAccount0, 2);
                accUpdt.send({ to: userPriKey0.toPublicKey(), amount: 15 * 1e9 });
            });
            console.log('     =================thirdUser votes===================     ');
            let voteTx3 = await Mina.transaction(userPubKeyThird, () => {
                let voter = userPriKeyThird;
                let voteOption = UInt64.from(2);// vote to keep the extra tokens
                let voterMerkleMapWitness = xTokenContractMerkleMap.getWitness(Poseidon.hash(voter.toPublicKey().toFields()));
                zkApp.voteToProcessRestTokens(voter, voteOption, voterMerkleMapWitness);
            });
            await voteTx3.prove();
            voteTx3.sign([userPriKeyThird]);
            await voteTx3.send();

            XTokenContractTestProfiler.store();

            console.log('currentSlot0', Blockchain.currentSlot().toString());
            Blockchain.setGlobalSlot(purchaseEndBlockHeight.add(1));// TODO how to take this into Berkeley Network?
            console.log('currentSlot1', Blockchain.currentSlot().toString());

            let actionHashVote01 = zkApp.actionHashVote.get();
            try {
                let tx = await Mina.transaction(senderAccount, () => {
                    AccountUpdate.fundNewAccount(senderAccount);
                    zkApp.rollupVoteNote();
                });
                await tx.prove();
                tx.sign([senderKey]);
                await tx.send();
            } catch (error) {
                console.error(error);
            }

            expect(zkApp.actionHashVote.get()).not.toEqual(actionHashVote01);

        });
        */

        /*         it(`transfer custom tokens without token owner's signature-- !! Need to Research!!`, async () => {
                    let userPriKey = PrivateKey.random();
                    let userPubKey = userPriKey.toPublicKey();
                    console.log('userPubKey: ', userPubKey.toBase58());
                    await constructOneUserAndPurchase(userPriKey, maximumPurchasingAmount, (senderAccount0: PublicKey, userPriKey0: PrivateKey) => {
                        let accUpdt = AccountUpdate.fundNewAccount(senderAccount0, 2);
                        accUpdt.send({ to: userPriKey0.toPublicKey(), amount: 15 * 1e9 });
                    });
        
                    let userPriKey1 = PrivateKey.random();
                    let userPubKey1 = userPriKey1.toPublicKey();
                    console.log('userPubKey1: ', userPubKey1.toBase58());
                    let tx = await Mina.transaction(userPubKey, () => {
                        AccountUpdate.fundNewAccount(userPubKey);
                        zkApp.token.send({ from: userPubKey, to: userPubKey1, amount: 1 });
                        AccountUpdate.attachToTransaction(zkApp.self);
                    });
                    await tx.prove();
                    tx.sign([userPriKey, userPriKey1]);
                    console.log('zkApp.token.send_tx: ', tx.toJSON());
                    await tx.send();
                }) */

        it(`transfer custom tokens with proof authorization`, async () => {
            let tokenId = zkApp.token.id;
            let userPriKey = PrivateKey.random();
            let userPubKey = userPriKey.toPublicKey();
            console.log('userPubKey: ', userPubKey.toBase58());

            let userPriKey1 = PrivateKey.random();
            let userPubKey1 = userPriKey1.toPublicKey();
            console.log('userPubKey1: ', userPubKey1.toBase58());

            // deploy NormalTokenUser Zkapp
            let tx0 = await Mina.transaction(senderAccount, () => {
                AccountUpdate.fundNewAccount(senderAccount, 2);
                zkApp.deployZkapp(userPubKey, NormalTokenUser._verificationKey!);
                zkApp.deployZkapp(userPubKey1, NormalTokenUser._verificationKey!);
            });
            await tx0.prove();
            tx0.sign([senderKey, userPriKey, userPriKey1]);
            console.log('deploy NormalTokenUser tx: ', tx0.toJSON());
            await tx0.send();

            // user purchase token
            await constructOneUserAndPurchase(userPriKey, maximumPurchasingAmount, (senderAccount0: PublicKey, userPriKey0: PrivateKey) => {
                // let accUpdt = AccountUpdate.fundNewAccount(senderAccount0);
                let accUpdt = AccountUpdate.createSigned(senderAccount0);
                accUpdt.send({ to: userPriKey0.toPublicKey(), amount: 15 * 1e9 });
            });
            // user1 purchase token
            await constructOneUserAndPurchase(userPriKey1, maximumPurchasingAmount, (senderAccount0: PublicKey, userPriKey0: PrivateKey) => {
                let accUpdt = AccountUpdate.createSigned(senderAccount0);
                accUpdt.send({ to: userPriKey0.toPublicKey(), amount: 15 * 1e9 });
            });

            let normalTokenUser = new NormalTokenUser(userPubKey, zkApp.token.id);
            let tx1 = await Mina.transaction(userPubKey, () => {
                let approveSendingCallback = Experimental.Callback.create(
                    normalTokenUser,
                    'approveTokenTransfer',
                    [UInt64.from(1)]
                );
                zkApp.approveTransferCallback(
                    userPubKey,
                    userPubKey1,
                    UInt64.from(1),
                    approveSendingCallback
                );
            });
            await tx1.prove();
            tx1.sign([userPriKey]);
            console.log('approveTokenTransfer\'s tx:', tx1.toJSON());
            await tx1.send();

            expect(
                Mina.getBalance(userPubKey, tokenId).value.toBigInt()
            ).toEqual(1n);
            expect(
                Mina.getBalance(userPubKey1, tokenId).value.toBigInt()
            ).toEqual(3n);
        })
    }

    runTests(false);
    // runTests(true);
});