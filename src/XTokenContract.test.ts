import { AccountUpdate, Experimental, fetchAccount, fetchLastBlock, Field, isReady, MerkleMap, Mina, Poseidon, PrivateKey, PublicKey, Reducer, shutdown, Signature, Types, UInt32, UInt64 } from 'snarkyjs';
import { XTokenContract, NormalTokenUser } from './XTokenContract.js';
import { getProfiler } from "./profiler.js";
import { Membership } from './Membership.js';

describe('test fuctions inside XTokenContract', () => {
    async function runTests(deployToBerkeley = false, needDeployContractEachTime = true) {
        let Blockchain: any;
        let transactionFee = 100_000_000;

        let
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

        let senderAcctInfo: Types.Account;
        let membershipAcctInfo: Types.Account;
        let zkAppAcctInfo: Types.Account;

        async function blockchainHeightToExceed() {
            if (deployToBerkeley) {
                // wait for Berkeley's blockchainLength > purchaseEndBlockHeight
                while (true) {
                    await fetchLastBlock();
                    console.log('sync Berkeley Network status: done!');

                    let blockchainLength = Mina.activeInstance.getNetworkState().blockchainLength;
                    console.log(`purchaseEndBlockHeight: ${purchaseEndBlockHeight.toString()}, blockchainLength: ${blockchainLength.toString()}`);

                    if (purchaseEndBlockHeight.lessThan(blockchainLength).toBoolean()) {
                        break;
                    }

                    let blockGap = Number.parseInt(purchaseEndBlockHeight.sub(blockchainLength).toString());
                    blockGap = blockGap == 0 ? 1 : blockGap;
                    await new Promise((resolve) => setTimeout(resolve, blockGap * 3 * 60 * 1000));// about 3 minutes/block
                }
            }
            console.log('current network state: ', JSON.stringify(Mina.activeInstance.getNetworkState()));

            if (!deployToBerkeley) {
                Blockchain.setBlockchainLength(purchaseEndBlockHeight.add(1));
                console.log('after setBlockchainLength(*), current network state: ', JSON.stringify(Mina.activeInstance.getNetworkState()));
            }
        }

        const constructOneUserAndPurchase = async (userPriKey: PrivateKey, purchaseAmount0: UInt64, prePurchaseCallback: any) => {
            if (deployToBerkeley) {
                await fetchLastBlock();
                console.log('sync Berkeley Network status: done!');
            }
            console.log('current network state: ', JSON.stringify(Mina.activeInstance.getNetworkState()));
            if (deployToBerkeley) {
                console.log('Fetching accounts[membershipZkAppAddress, zkAppAddress]...');
                membershipAcctInfo = (await fetchAccount({ publicKey: membershipZkAppAddress })).account!;
                console.log('current membershipAcctInfo: ', JSON.stringify(membershipAcctInfo));
                zkAppAcctInfo = (await fetchAccount({ publicKey: zkAppAddress })).account!;
                console.log('current zkAppAcctInfo: ', JSON.stringify(zkAppAcctInfo));
            }

            let userPubKey = userPriKey.toPublicKey();
            console.log(`create one user with PrivateKey: ${userPriKey.toBase58()},  PublicKey: ${userPubKey.toBase58()}`);

            // get merkle witness
            let indx = Poseidon.hash(userPubKey.toFields());
            let userValue = xTokenContractMerkleMap.get(indx);
            console.log(`user.Value inside merkle map: ${userValue.toString()}`);
            let userMerkleMapWitness = xTokenContractMerkleMap.getWitness(indx);
            // console.log(`user.MerkleMapWitness: ${JSON.stringify(userMerkleMapWitness.toJSON())}`);

            try {
                // construct a tx and send
                console.log(`user purchase Tokens...`);
                let tx = await Mina.transaction({ sender: senderAccount, fee: transactionFee }, () => {
                    prePurchaseCallback(senderAccount, userPriKey);
                    zkApp.purchaseToken(userPubKey, purchaseAmount0, userMerkleMapWitness);
                });

                await tx.prove();
                tx.sign([senderKey, userPriKey]);
                // console.log('constructOneUserAndPurchase_tx: ', tx.toJSON());
                let txId = await tx.send();
                console.log(`purchaseToken's tx[${txId.hash()!}] sent...`);
                txId.wait({ maxAttempts: 200 });
                console.log(`purchaseToken's tx confirmed...`);

                // store the user
                xTokenContractMerkleMap.set(indx, Field(1));
            } catch (error) {
                console.error(error);
            }

            if (deployToBerkeley) {
                console.log('Fetching updated accounts..');
                membershipAcctInfo = (await fetchAccount({ publicKey: membershipZkAppAddress })).account!;
                zkAppAcctInfo = (await fetchAccount({ publicKey: zkAppAddress })).account!;
            }
        }

        beforeAll(async () => {
            await isReady;

            console.log('Reducer.initialActionsHash: ', Reducer.initialActionsHash.toString());
            let tmp1 = PrivateKey.random();
            console.log('sample - Membership\'s privateKey: ', tmp1.toBase58(), 'pubKey: ', tmp1.toPublicKey().toBase58());
            let tmp0 = PrivateKey.random();
            console.log('sample - XTokenContract\'s privateKey: ', tmp0.toBase58(), 'pubKey: ', tmp0.toPublicKey().toBase58());

            Blockchain = deployToBerkeley ? Mina.Network({
                mina: 'https://proxy.berkeley.minaexplorer.com/graphql',
                archive: 'https://archive.berkeley.minaexplorer.com/',
            }) : Mina.LocalBlockchain({ proofsEnabled: true });
            Mina.setActiveInstance(Blockchain);

            membershipVerificationKey = (await Membership.compile()).verificationKey;
            console.log(`Membership.compile done!`);

            normalTokenUserVerificationKey = NormalTokenUser.compile();
            console.log(`NormalTokenUser.compile done!`);

            zkAppVerificationKey = (await XTokenContract.compile()).verificationKey;
            console.log(`XTokenContract.compile done!`);
        });

        afterAll(() => {
            setInterval(shutdown, 0);
        });

        beforeEach(async () => {
            if (deployToBerkeley) {
                await fetchLastBlock();
                console.log('sync Berkeley Network status: done!');
            }
            console.log('current network state: ', JSON.stringify(Mina.activeInstance.getNetworkState()));

            if (deployToBerkeley) {// Berkeley
                // senderKey = PrivateKey.fromBase58('EKEYaNo9HxkMpNrjuAYCXug42TJnij36MkEnDsx58TfF3cFNff3n');
                senderKey = PrivateKey.fromBase58('EKEEBkoXHsUQke7BzjgYXEwVbgP4Eep7Xgb3FNbnodQdiMpTnayQ');
                senderAccount = senderKey.toPublicKey();//B62qk1UHVMMQ28U54vayJuXxLo9wd8vo5vEMNoLuK3haFN8kziKcAiX

                console.log(`Funding fee payer ${senderAccount.toBase58()} and waiting for inclusion in a block..`);
                //await Mina.faucet(senderAccount);
                await fetchAccount({ publicKey: senderAccount });
                console.log('senderAccount is funded!');

            } else {// Local
                ({ privateKey: senderKey, publicKey: senderAccount } = Blockchain.testAccounts[0]);
            }

            console.log(`senderKey: ${senderKey.toBase58()}, senderAccount: ${senderAccount.toBase58()}`);
            let senderAccountInfo = Blockchain.getAccount(senderAccount);// to avoid network issue?
            let { nonce, balance } = senderAccountInfo;
            console.log(`initially, senderAccount.nonce: ${nonce}, senderAccount.balance: ${balance}`);


            membershipZkAppPrivateKey = needDeployContractEachTime ? PrivateKey.random() : PrivateKey.fromBase58('EKFRWWuziCMDCoTqzhsaYBeRPDt2tKbPEYwCLgecfsYgUPnaJfji');
            membershipZkAppAddress = membershipZkAppPrivateKey.toPublicKey();
            membershipZkApp = new Membership(membershipZkAppAddress);
            console.log('membershipZkApp\'s PrivateKey: ', membershipZkAppPrivateKey.toBase58(), ' ,  membershipZkApp\'s Address: ', membershipZkAppAddress.toBase58());

            zkAppPrivateKey = needDeployContractEachTime ? PrivateKey.random() : PrivateKey.fromBase58('EKEHu59a3GUam6rhuVUaA5wXeunJ1mmxgPVZABCj3ix1hVaXgJZK');
            zkAppAddress = zkAppPrivateKey.toPublicKey();
            zkApp = new XTokenContract(zkAppAddress);
            console.log('xTokenContractZkApp\'s PrivateKey: ', zkAppPrivateKey.toBase58(), ' , xTokenContractZkApp\'s Address: ', zkAppAddress.toBase58());

            // init some values
            purchaseStartBlockHeight = Mina.activeInstance.getNetworkState().blockchainLength;
            purchaseEndBlockHeight = Mina.activeInstance.getNetworkState().blockchainLength.add(5);// TODO
            tokenSupply = UInt64.from(6);
            maximumPurchasingAmount = UInt64.from(2);

            let needDeployMembership = false;
            let needDeployXTokenContract = false;
            if (deployToBerkeley) {// Berkeley
                let membershipZkAppAccountInfo = await fetchAccount({ publicKey: membershipZkAppAddress });
                if (membershipZkAppAccountInfo.account?.zkapp == undefined) {
                    // check if need to deploy to Berkeley Network
                    needDeployMembership = true;
                }

                let zkAppAccountInfo = await fetchAccount({ publicKey: zkAppAddress });
                if (zkAppAccountInfo.account?.zkapp == undefined) {
                    // check if need to deploy to Berkeley Network
                    needDeployXTokenContract = true;
                }
            } else {
                let membershipZkAppAccountInfo = Mina.activeInstance.getAccount(membershipZkAppAddress);
                if (membershipZkAppAccountInfo?.zkapp == undefined) {
                    // check if need to deploy to Berkeley Network
                    needDeployMembership = true;
                }
                let zkAppAccountInfo = Mina.activeInstance.getAccount(zkAppAddress);
                if (zkAppAccountInfo?.zkapp == undefined) {
                    // check if need to deploy to Berkeley Network
                    needDeployXTokenContract = true;
                }
            }

            // TODO to confirm if need deploy token each time
            if (needDeployContractEachTime) {
                needDeployMembership = true;
                needDeployXTokenContract = true;
            }

            if (needDeployMembership) {
                console.log(`Membership Contract: deploying...`);
                let tx = await Mina.transaction({ sender: senderAccount, fee: transactionFee }, () => {
                    AccountUpdate.fundNewAccount(senderAccount);
                    membershipZkApp.deploy({ zkappKey: membershipZkAppPrivateKey, verificationKey: membershipVerificationKey });
                });
                let txId = await tx.sign([senderKey]).send();
                console.log(`Membership Contract: deployment tx[${txId.hash()!}] sent...`);
                await txId.wait({ maxAttempts: 200 });
                console.log(`Membership Contract: txId.isSuccess:`, txId.isSuccess);

                if (deployToBerkeley) {
                    console.log('fetchAccount{senderAccount}...');
                    await fetchAccount({ publicKey: senderAccount });
                }
                let senderAccountInfo = Blockchain.getAccount(senderAccount);// to avoid network issue?
                let { nonce, balance } = senderAccountInfo;
                console.log(`now, senderAccount.nonce: ${nonce}, senderAccount.balance: ${balance}`);
            }
            if (needDeployXTokenContract) {
                console.log(`XTokenContract: deploying...`);
                // deploy zkApp
                let tx = await Mina.transaction({ sender: senderAccount, fee: transactionFee }, () => {
                    AccountUpdate.fundNewAccount(senderAccount);
                    zkApp.deploy({ zkappKey: zkAppPrivateKey, verificationKey: zkAppVerificationKey });
                });
                let txId = await tx.sign([senderKey]).send();
                console.log(`XTokenContract: deployment tx[${txId.hash()!}] sent...`);

                await txId.wait({ maxAttempts: 200 });
                console.log(`xTokenContract: txId.isSuccess:`, txId.isSuccess);
            }

            if (deployToBerkeley) {
                console.log('fetchAccount{senderAccount, membership, xTokenContract}...');
                senderAcctInfo = (await fetchAccount({ publicKey: senderAccount })).account!;
                membershipAcctInfo = (await fetchAccount({ publicKey: membershipZkAppAddress })).account!;
                zkAppAcctInfo = (await fetchAccount({ publicKey: zkAppAddress })).account!;
            }

            xTokenContractMerkleMap = new MerkleMap();
            const merkleRoot0 = xTokenContractMerkleMap.getRoot();
            console.log(`xTokenContractMerkleMap's initial root: ${merkleRoot0.toString()}`);

            if (deployToBerkeley) {
                await fetchLastBlock();
                console.log('sync Berkeley Network status: done!');
            }
            console.log('current network state: ', JSON.stringify(Mina.activeInstance.getNetworkState()));

            // initialize or reset XTokenContract & MembershipZkApp
            console.log(`trigger xTokenContract.initOrReset(*) to initialize...`);
            console.log(`
                tokenSupply: ${tokenSupply.toString()},\n
                maximumPurchasingAmount: ${maximumPurchasingAmount.toString()},\n
                membershipZkAppAddress: ${membershipZkAppAddress.toBase58()},\n
                purchaseStartBlockHeight: ${purchaseStartBlockHeight.toString()},\n
                purchaseEndBlockHeight: ${purchaseEndBlockHeight.toString()}\n
            `);

            const tx = await Mina.transaction({ sender: senderAccount, fee: transactionFee }, () => {
                zkApp.initOrReset(
                    tokenSupply,
                    maximumPurchasingAmount,
                    membershipZkAppAddress,
                    purchaseStartBlockHeight,
                    purchaseEndBlockHeight,
                    zkAppPrivateKey
                );

                membershipZkApp.initOrReset(new MerkleMap().getRoot(), UInt32.from(0), membershipZkAppPrivateKey);
            });
            await tx.prove();
            let txId = await tx.sign([senderKey]).send();
            console.log(`trigger xTokenContract.initOrReset(*): tx[${txId.hash()!}] sent...`);
            await txId.wait({
                maxAttempts: 200,
            });
            console.log(`trigger xTokenContract.initOrReset(*): tx confirmed!`);

            if (deployToBerkeley) {
                console.log('fetchAccount{senderAccount, membership, xTokenContract}...');
                senderAcctInfo = (await fetchAccount({ publicKey: senderAccount })).account!;
                membershipAcctInfo = (await fetchAccount({ publicKey: membershipZkAppAddress })).account!;
                zkAppAcctInfo = (await fetchAccount({ publicKey: zkAppAddress })).account!;
            }

            const tokenSymbol = Blockchain.getAccount(zkAppAddress).tokenSymbol;
            expect(tokenSymbol).toEqual('XTKN');

            const zkAppUri = Blockchain.getAccount(zkAppAddress).zkapp?.zkappUri;
            expect(zkAppUri).toEqual('https://github.com/coldstar1993/mina-zkapp-e2e-testing');

        });

        it(`CHECK tx should succeed purchase tokens by an non-existing user`, async () => {
            let totalAmountInCirculation0 = zkApp.totalAmountInCirculation.get();
            let memberTreeRoot0 = xTokenContractMerkleMap.getRoot();

            let userPriKey = PrivateKey.random();
            await constructOneUserAndPurchase(userPriKey, maximumPurchasingAmount, (senderAccount0: PublicKey, userPriKey0: PrivateKey) => {
                let accUpdt = AccountUpdate.fundNewAccount(senderAccount0, 2);
                accUpdt.send({ to: userPriKey0.toPublicKey(), amount: 3 * 1e9 });
            });

            expect(membershipZkApp.memberTreeRoot.get()).not.toEqual(memberTreeRoot0);
            expect(membershipZkApp.memberTreeRoot.get()).toEqual(xTokenContractMerkleMap.getRoot());
            expect(membershipZkApp.memberCount.get()).toEqual(UInt32.from(1));
            expect(zkApp.totalAmountInCirculation.get()).toEqual(totalAmountInCirculation0.add(2));
        })

        it(`CHECK tx should fail when purchase tokens by an existing user`, async () => {
            let totalAmountInCirculation0 = zkApp.totalAmountInCirculation.get();
            let memberTreeRoot0 = xTokenContractMerkleMap.getRoot();
            let memberCount0 = membershipZkApp.memberCount.get();

            let userPriKey = PrivateKey.random();
            await constructOneUserAndPurchase(userPriKey, maximumPurchasingAmount, (senderAccount0: PublicKey, userPriKey0: PrivateKey) => {
                let accUpdt = AccountUpdate.fundNewAccount(senderAccount0, 2);
                accUpdt.send({ to: userPriKey0.toPublicKey(), amount: 3 * 1e9 });
            });

            expect(membershipZkApp.memberTreeRoot.get()).not.toEqual(memberTreeRoot0);
            expect(membershipZkApp.memberCount.get()).toEqual(UInt32.from(1));
            expect(zkApp.totalAmountInCirculation.get()).toEqual(totalAmountInCirculation0.add(2));

            if (deployToBerkeley) {
                console.log('fetchAccount{senderAccount, membership, xTokenContract}...');
                senderAcctInfo = (await fetchAccount({ publicKey: senderAccount })).account!;
                membershipAcctInfo = (await fetchAccount({ publicKey: membershipZkAppAddress })).account!;
                zkAppAcctInfo = (await fetchAccount({ publicKey: zkAppAddress })).account!;
            }

            console.log('=======================the same user purchases tokens again=======================');
            totalAmountInCirculation0 = zkApp.totalAmountInCirculation.get();
            memberTreeRoot0 = membershipZkApp.memberTreeRoot.get();
            memberCount0 = membershipZkApp.memberCount.get();

            // construct a tx and send
            await constructOneUserAndPurchase(userPriKey, maximumPurchasingAmount, (senderAccount0: PublicKey, userPriKey0: PrivateKey) => {
                let accUpdt = AccountUpdate.fundNewAccount(senderAccount0);
                accUpdt.send({ to: userPriKey0.toPublicKey(), amount: 3 * 1e9 });
            });

            expect(membershipZkApp.memberTreeRoot.get()).toEqual(memberTreeRoot0);// should equal
            expect(membershipZkApp.memberCount.get()).toEqual(memberCount0);
            expect(zkApp.totalAmountInCirculation.get()).toEqual(totalAmountInCirculation0);

        });


        it(`CHECK tx should fail when purchase tokens when exceeding precondition.network.blockchainLength`, async () => {
            let totalAmountInCirculation0 = zkApp.totalAmountInCirculation.get();
            let memberCount0 = membershipZkApp.memberCount.get();
            let merkleRoot0 = membershipZkApp.memberTreeRoot.get();

            // wait for blockchainHeight
            await blockchainHeightToExceed();

            let userPriKey = PrivateKey.random();
            await constructOneUserAndPurchase(userPriKey, maximumPurchasingAmount, (senderAccount0: PublicKey, userPriKey0: PrivateKey) => {
                let accUpdt = AccountUpdate.fundNewAccount(senderAccount0, 2);
                accUpdt.send({ to: userPriKey0.toPublicKey(), amount: 3 * 1e9 });
            });

            expect(membershipZkApp.memberTreeRoot.get()).toEqual(merkleRoot0);
            expect(membershipZkApp.memberCount.get()).toEqual(memberCount0);
            expect(zkApp.totalAmountInCirculation.get()).toEqual(totalAmountInCirculation0);
        });

        it(`CHECK tx should fail when purchase tokens when exceeding maximum purchasing amount`, async () => {
            let totalAmountInCirculation0 = zkApp.totalAmountInCirculation.get();
            let memberCount0 = membershipZkApp.memberCount.get();
            let merkleRoot0 = membershipZkApp.memberTreeRoot.get();

            let userPriKey = PrivateKey.random();
            await constructOneUserAndPurchase(userPriKey, maximumPurchasingAmount.add(1), (senderAccount0: PublicKey, userPriKey0: PrivateKey) => {
                let accUpdt = AccountUpdate.fundNewAccount(senderAccount0, 2);
                accUpdt.send({ to: userPriKey0.toPublicKey(), amount: 3 * 1e9 });
            });

            expect(membershipZkApp.memberTreeRoot.get()).toEqual(merkleRoot0);
            expect(membershipZkApp.memberCount.get()).toEqual(memberCount0);
            expect(zkApp.totalAmountInCirculation.get()).toEqual(totalAmountInCirculation0);


        });


        it(`CHECK tx should fail when purchase tokens when (totalAmountInCirculation + purchasingAmount)>SUPPLY `, async () => {
            console.log('========================firstUser starts========================');
            let userPriKeyFirst = PrivateKey.random();
            await constructOneUserAndPurchase(userPriKeyFirst, maximumPurchasingAmount, (senderAccount0: PublicKey, userPriKey0: PrivateKey) => {
                let accUpdt = AccountUpdate.fundNewAccount(senderAccount0, 2);
                accUpdt.send({ to: userPriKey0.toPublicKey(), amount: 3 * 1e9 });
            });

            console.log('========================secUser starts========================');
            let userPriKeySec = PrivateKey.random();
            await constructOneUserAndPurchase(userPriKeySec, maximumPurchasingAmount, (senderAccount0: PublicKey, userPriKey0: PrivateKey) => {
                let accUpdt = AccountUpdate.fundNewAccount(senderAccount0, 2);
                accUpdt.send({ to: userPriKey0.toPublicKey(), amount: 3 * 1e9 });
            });

            console.log('========================thirdUser starts========================');
            let totalAmountInCirculation0 = zkApp.totalAmountInCirculation.get();
            let memberCount0 = membershipZkApp.memberCount.get();
            let merkleRoot0 = membershipZkApp.memberTreeRoot.get();

            let userPriKeyThird = PrivateKey.random();
            await constructOneUserAndPurchase(userPriKeyThird, maximumPurchasingAmount.add(1), (senderAccount0: PublicKey, userPriKey0: PrivateKey) => {
                let accUpdt = AccountUpdate.fundNewAccount(senderAccount0, 2);
                accUpdt.send({ to: userPriKey0.toPublicKey(), amount: 3 * 1e9 });
            });

            expect(membershipZkApp.memberTreeRoot.get()).toEqual(merkleRoot0);
            expect(membershipZkApp.memberCount.get()).toEqual(memberCount0);
            expect(zkApp.totalAmountInCirculation.get()).toEqual(totalAmountInCirculation0);


        });

        it(`CHECK if timing-lock Mina balance when totalAmountInCirculation == SUPPLY`, async () => {
            console.log('========================firstUser starts========================');
            let userPriKeyFirst = PrivateKey.random();
            await constructOneUserAndPurchase(userPriKeyFirst, maximumPurchasingAmount, (senderAccount0: PublicKey, userPriKey0: PrivateKey) => {
                let accUpdt = AccountUpdate.fundNewAccount(senderAccount0, 2);
                accUpdt.send({ to: userPriKey0.toPublicKey(), amount: 3 * 1e9 });
            });

            console.log('========================secUser starts========================');
            let userPriKeySec = PrivateKey.random();
            await constructOneUserAndPurchase(userPriKeySec, maximumPurchasingAmount, (senderAccount0: PublicKey, userPriKey0: PrivateKey) => {
                let accUpdt = AccountUpdate.fundNewAccount(senderAccount0, 2);
                accUpdt.send({ to: userPriKey0.toPublicKey(), amount: 3 * 1e9 });
            });

            console.log('========================thirdUser starts========================');
            let userPriKeyThird = PrivateKey.random();
            await constructOneUserAndPurchase(userPriKeyThird, maximumPurchasingAmount, (senderAccount0: PublicKey, userPriKey0: PrivateKey) => {
                let accUpdt = AccountUpdate.fundNewAccount(senderAccount0, 2);
                accUpdt.send({ to: userPriKey0.toPublicKey(), amount: 3 * 1e9 });
            });


            // TODO should fetchAccount?
            // expect(zkApp.account.balance.get()).toEqual(UInt64.from(9e9));

            // wait for blocks grow...
            await blockchainHeightToExceed();

            console.log('========================try to transfer excess amounts ========================');
            let currentAcctBalance0 = zkApp.account.balance.get();
            let userPriKeyRecipient = PrivateKey.random();
            let userPubKeyRecipient = userPriKeyRecipient.toPublicKey();
            let transferedAmount = currentAcctBalance0.div(3).add(1);// to make it excess
            try {
                let tx = await Mina.transaction({ sender: senderAccount, fee: transactionFee }, () => {
                    AccountUpdate.fundNewAccount(senderAccount);
                    zkApp.transferMina(userPubKeyRecipient, transferedAmount, zkAppPrivateKey);
                });
                await tx.prove();
                tx.sign([senderKey]);
                await tx.send();
            } catch (error) {
                console.error(error);
            }

            if (deployToBerkeley) {
                console.log('Fetching accounts[zkAppAddress]...');
                zkAppAcctInfo = (await fetchAccount({ publicKey: zkAppAddress })).account!;
                console.log('current zkAppAcctInfo: ', JSON.stringify(zkAppAcctInfo));
            }
            expect(zkApp.account.balance).toEqual(currentAcctBalance0);

            console.log('========================try to transfer suitable amounts ========================');
            let transferedAmount1 = currentAcctBalance0.div(3);// to make it suitable
            try {
                let tx = await Mina.transaction({ sender: senderAccount, fee: transactionFee }, () => {
                    AccountUpdate.fundNewAccount(senderAccount);
                    zkApp.transferMina(userPubKeyRecipient, transferedAmount1, zkAppPrivateKey);
                });
                await tx.prove();
                tx.sign([senderKey]);
                await tx.send();
            } catch (error) {
                console.error(error);
            }
            if (deployToBerkeley) {
                console.log('Fetching accounts[zkAppAddress]...');
                zkAppAcctInfo = (await fetchAccount({ publicKey: zkAppAddress })).account!;
                console.log('current zkAppAcctInfo: ', JSON.stringify(zkAppAcctInfo));
            }
            expect(zkApp.account.balance.get()).toEqual(currentAcctBalance0.sub(transferedAmount1));
        });

        it(`CHECK if one can only vote for one time To Process Rest Tokens `, async () => {
            console.log('========================one User starts========================');
            let userPriKeyFirst = PrivateKey.random();
            let userPubKeyFirst = userPriKeyFirst.toPublicKey();
            await constructOneUserAndPurchase(userPriKeyFirst, maximumPurchasingAmount, (senderAccount0: PublicKey, userPriKey0: PrivateKey) => {
                let accUpdt = AccountUpdate.fundNewAccount(senderAccount0, 2);
                accUpdt.send({ to: userPriKey0.toPublicKey(), amount: 3 * 1e9 });
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

        /* 
        it(`CHECK rollup VoteNotes by reducing Actions`, async () => {
            console.log('========================firstUser starts========================');
            let userPriKeyFirst = PrivateKey.random();
            let userPubKeyFirst = userPriKeyFirst.toPublicKey();
            await constructOneUserAndPurchase(userPriKeyFirst, maximumPurchasingAmount, (senderAccount0: PublicKey, userPriKey0: PrivateKey) => {
                let accUpdt = AccountUpdate.fundNewAccount(senderAccount0, 2);
                accUpdt.send({ to: userPriKey0.toPublicKey(), amount: 3 * 1e9 });
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
                accUpdt.send({ to: userPriKey0.toPublicKey(), amount: 3 * 1e9 });
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
                let tx = await Mina.transaction({sender: senderAccount, fee: transactionFee }, () => {
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
                accUpdt.send({ to: userPriKey0.toPublicKey(), amount: 3 * 1e9 });
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

            

            console.log('currentSlot0', Blockchain.currentSlot().toString());
            Blockchain.setGlobalSlot(purchaseEndBlockHeight.add(1));// TODO how to take this into Berkeley Network?
            console.log('currentSlot1', Blockchain.currentSlot().toString());

            let actionHashVote01 = zkApp.actionHashVote.get();
            try {
                let tx = await Mina.transaction({sender: senderAccount, fee: transactionFee }, () => {
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

        /*         it(`CHECK transfer custom tokens without token owner's signature-- !! Need to Research!!`, async () => {
                    let userPriKey = PrivateKey.random();
                    let userPubKey = userPriKey.toPublicKey();
                    console.log('userPubKey: ', userPubKey.toBase58());
                    await constructOneUserAndPurchase(userPriKey, maximumPurchasingAmount, (senderAccount0: PublicKey, userPriKey0: PrivateKey) => {
                        let accUpdt = AccountUpdate.fundNewAccount(senderAccount0, 2);
                        accUpdt.send({ to: userPriKey0.toPublicKey(), amount: 3 * 1e9 });
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
        /* 
                it(`CHECK transfer custom tokens with proof authorization`, async () => {
                    let tokenId = zkApp.token.id;
                    let userPriKey = PrivateKey.random();
                    let userPubKey = userPriKey.toPublicKey();
                    console.log('userPubKey: ', userPubKey.toBase58());
        
                    let userPriKey1 = PrivateKey.random();
                    let userPubKey1 = userPriKey1.toPublicKey();
                    console.log('userPubKey1: ', userPubKey1.toBase58());
        
                    // deploy NormalTokenUser Zkapp
                    let tx0 = await Mina.transaction({sender: senderAccount, fee: transactionFee }, () => {
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
                        accUpdt.send({ to: userPriKey0.toPublicKey(), amount: 3 * 1e9 });
                    });
                    // user1 purchase token
                    await constructOneUserAndPurchase(userPriKey1, maximumPurchasingAmount, (senderAccount0: PublicKey, userPriKey0: PrivateKey) => {
                        let accUpdt = AccountUpdate.createSigned(senderAccount0);
                        accUpdt.send({ to: userPriKey0.toPublicKey(), amount: 3 * 1e9 });
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
                }) */
    }



    // runTests(false);
    runTests(true);
});
