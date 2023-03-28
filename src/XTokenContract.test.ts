import { AccountUpdate, Experimental, fetchAccount, fetchLastBlock, Field, isReady, MerkleMap, Mina, Poseidon, PrivateKey, PublicKey, Reducer, shutdown, Signature, Types, UInt32, UInt64 } from 'snarkyjs';
import { XTokenContract, NormalTokenUser } from './XTokenContract.js';
import { Membership } from './Membership.js';
import { loopUntilAccountExists, makeAndSendTransaction } from './utils.js';

describe('test fuctions inside XTokenContract', () => {
    let needDeployContractEachTime = true;

    let Blockchain: any;
    let transactionFee = 100_000_000;

    let
        senderAccount: PublicKey,
        senderKey: PrivateKey,
        zkAppVerificationKey: any,
        zkAppAddress: PublicKey,
        zkAppPrivateKey: PrivateKey,
        zkApp: XTokenContract,
        tokenMembersMerkleMap: MerkleMap;

    let membershipZkAppPrivateKey: PrivateKey;
    let membershipZkAppAddress: PublicKey;
    let membershipZkApp: Membership;
    let membershipVerificationKey: any;

    let normalTokenUserVerificationKey: any;

    let purchaseStartBlockHeight: UInt32;
    let purchaseEndBlockHeight: UInt32;
    let tokenSupply: UInt64;
    let maximumPurchasingAmount: UInt64;

    let senderAcctInfo: Types.Account | undefined;
    let membershipAcctInfo: Types.Account | undefined;
    let zkAppAcctInfo: Types.Account | undefined;


    async function syncNetworkStatus() {
        if (process.env.TEST_ON_BERKELEY! == 'true') {
            await fetchLastBlock();
            console.log('sync Berkeley Network status: done!');
        }
        console.log('current network state: ', JSON.stringify(Mina.activeInstance.getNetworkState()));
        return Mina.activeInstance.getNetworkState();
    }

    async function syncAcctInfo(acctAddr: PublicKey) {
        let acctInfo: Types.Account | undefined;
        if (process.env.TEST_ON_BERKELEY! == 'true') {
            acctInfo = (await fetchAccount({ publicKey: acctAddr })).account!;
        } else {
            acctInfo = Mina.activeInstance.getAccount(acctAddr);
        }

        return acctInfo;
    }

    async function syncAllAccountInfo() {
        console.log('current senderAcctInfo: ', JSON.stringify(await syncAcctInfo(senderAccount)));
        console.log('current membershipAcctInfo: ', JSON.stringify(await syncAcctInfo(membershipZkAppAddress)));
        console.log('current zkAppAcctInfo: ', JSON.stringify(await syncAcctInfo(zkAppAddress)));
    }

    async function waitBlockHeightToExceed(aHeight: UInt32) {
        if (process.env.TEST_ON_BERKELEY! == 'true') {
            // wait for Berkeley's blockchainLength > aHeight
            while (true) {
                let blockchainLength = (await syncNetworkStatus()).blockchainLength;
                console.log(`aHeight: ${aHeight.toString()}, current blockchainLength: ${blockchainLength.toString()}`);

                if (aHeight.lessThan(blockchainLength).toBoolean()) {
                    break;
                }

                let blockGap = Number.parseInt(aHeight.sub(blockchainLength).toString());
                blockGap = blockGap == 0 ? 1 : blockGap;
                await new Promise((resolve) => setTimeout(resolve, blockGap * 3 * 60 * 1000));// about 3 minutes/block
            }
        } else {
            Blockchain.setBlockchainLength(aHeight.add(1));
            console.log(`aHeight: ${aHeight.toString()}, current blockchainLength: ${Mina.activeInstance.getNetworkState().blockchainLength.toString()}`);
        }
        console.log('current network state: ', JSON.stringify(Mina.activeInstance.getNetworkState()));
    }

    const constructOneUserAndPurchase = async (userPriKey: PrivateKey, purchaseAmount0: UInt64, prePurchaseCallback: any) => {
        await syncAllAccountInfo();

        let userPubKey = userPriKey.toPublicKey();

        // get merkle witness
        let indx = Poseidon.hash(userPubKey.toFields());
        let userValue = tokenMembersMerkleMap.get(indx);
        console.log(`user.Value inside merkle map: ${userValue.toString()}`);
        let userMerkleMapWitness = tokenMembersMerkleMap.getWitness(indx);

        // construct a tx and send
        console.log(`user purchase Tokens...`);

        await makeAndSendTransaction({
            feePayerPublicKey: senderKey.toPublicKey(),
            zkAppAddress,
            mutateZkApp() {
                prePurchaseCallback(senderAccount, userPriKey);
                zkApp.purchaseToken(userPubKey, purchaseAmount0, userMerkleMapWitness);
            },
            transactionFee,
            signTx(tx: Mina.Transaction) {
                tx.sign([senderKey, userPriKey]);
            },
            getState() {
                return zkApp.totalAmountInCirculation.get();
            },
            statesEqual(state1, state2) {
                return state2.equals(state1).toBoolean();
            },
        });
        // store the user
        tokenMembersMerkleMap.set(indx, Field(1));

        await syncAllAccountInfo();
    }

    beforeAll(async () => {
        await isReady;

        let tmp1 = PrivateKey.random();
        console.log('sample - Membership\'s privateKey: ', tmp1.toBase58(), 'pubKey: ', tmp1.toPublicKey().toBase58());
        let tmp0 = PrivateKey.random();
        console.log('sample - XTokenContract\'s privateKey: ', tmp0.toBase58(), 'pubKey: ', tmp0.toPublicKey().toBase58());

        Blockchain = process.env.TEST_ON_BERKELEY! == 'true' ? Mina.Network({
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
        await syncNetworkStatus();

        if (process.env.TEST_ON_BERKELEY! == 'true') {// Berkeley
            senderKey = PrivateKey.fromBase58('EKDmWEWjC6UampzAph9ddAbnmuBgHAfiQhAmSVT6ACJgPFzCsoTW');
            senderAccount = senderKey.toPublicKey();//    pubKey:  B62qkvenQ4bZ5qt5QJN8bmEq92KskKH4AZP7pgbMoyiMAccWTWjHRoD

            console.log(`Funding fee payer ${senderAccount.toBase58()} and waiting for inclusion in a block..`);
            // await Mina.faucet(senderAccount);
            await loopUntilAccountExists({
                address: senderAccount,
                eachTimeNotExist: () => { console.log('[loopUntilAccountExists] senderAccount is still not exiting, loop&wait...'); },
                isZkAppAccount: false,
                isLocalBlockChain: false
            });
            console.log('senderAccount is funded!');

        } else {// Local
            ({ privateKey: senderKey, publicKey: senderAccount } = Blockchain.testAccounts[0]);
        }

        console.log(`senderKey: ${senderKey.toBase58()}, senderAccount: ${senderAccount.toBase58()}`);
        senderAcctInfo = await syncAcctInfo(senderAccount);
        let { nonce, balance } = senderAcctInfo;
        console.log(`initially, senderAccount.nonce: ${nonce}, senderAccount.balance: ${balance}`);

        membershipZkAppPrivateKey = needDeployContractEachTime ? PrivateKey.random() : PrivateKey.fromBase58('EKFRWWuziCMDCoTqzhsaYBeRPDt2tKbPEYwCLgecfsYgUPnaJfji');
        membershipZkAppAddress = membershipZkAppPrivateKey.toPublicKey();
        membershipZkApp = new Membership(membershipZkAppAddress);
        console.log('membershipZkApp\'s PrivateKey: ', membershipZkAppPrivateKey.toBase58(), ' ,  membershipZkApp\'s Address: ', membershipZkAppAddress.toBase58());

        zkAppPrivateKey = needDeployContractEachTime ? PrivateKey.random() : PrivateKey.fromBase58('EKEHu59a3GUam6rhuVUaA5wXeunJ1mmxgPVZABCj3ix1hVaXgJZK');
        zkAppAddress = zkAppPrivateKey.toPublicKey();
        zkApp = new XTokenContract(zkAppAddress);
        console.log('xTokenContractZkApp\'s PrivateKey: ', zkAppPrivateKey.toBase58(), ' , xTokenContractZkApp\'s Address: ', zkAppAddress.toBase58());

        // init appStatus values
        purchaseStartBlockHeight = Mina.activeInstance.getNetworkState().blockchainLength;
        purchaseEndBlockHeight = Mina.activeInstance.getNetworkState().blockchainLength.add(5);// TODO
        tokenSupply = UInt64.from(6);
        maximumPurchasingAmount = UInt64.from(2);

        // TODO to confirm if need deploy token each time
        if (needDeployContractEachTime) {
            console.log(`Membership Contract: deploying...`);
            let tx_deployMembership = await Mina.transaction({ sender: senderAccount, fee: transactionFee }, () => {
                AccountUpdate.fundNewAccount(senderAccount);
                membershipZkApp.deploy({ zkappKey: membershipZkAppPrivateKey, verificationKey: membershipVerificationKey });
            });
            let txId_deployMembership = await tx_deployMembership.sign([senderKey]).send();
            console.log(`Membership Contract: deployment tx[${txId_deployMembership.hash()!}] sent...`);
            await txId_deployMembership.wait({ maxAttempts: 1000 });
            console.log(`Membership Contract: txId.isSuccess:`, txId_deployMembership.isSuccess);

            console.log(`XTokenContract: deploying...`);
            // deploy zkApp
            let tx_deployXTokenContract = await Mina.transaction({ sender: senderAccount, fee: transactionFee }, () => {
                AccountUpdate.fundNewAccount(senderAccount);
                zkApp.deploy({ zkappKey: zkAppPrivateKey, verificationKey: zkAppVerificationKey });
            });
            let txId_deployXTokenContract = await tx_deployXTokenContract.sign([senderKey]).send();
            console.log(`XTokenContract: deployment tx[${txId_deployXTokenContract.hash()!}] sent...`);
            await txId_deployXTokenContract.wait({ maxAttempts: 1000 });
            console.log(`xTokenContract: txId.isSuccess:`, txId_deployXTokenContract.isSuccess);
        }

        await syncAllAccountInfo();

        tokenMembersMerkleMap = new MerkleMap();
        const merkleRoot0 = tokenMembersMerkleMap.getRoot();
        console.log(`tokenMembersMerkleMap's initial root: ${merkleRoot0.toString()}`);

        // initialize or reset XTokenContract & MembershipZkApp
        await syncNetworkStatus();
        // initialize or reset XTokenContract & MembershipZkApp

        console.log(`trigger all contracts to initialize...`);
        console.log(`
            tokenSupply: ${tokenSupply.toString()},\n
            maximumPurchasingAmount: ${maximumPurchasingAmount.toString()},\n
            membershipZkAppAddress: ${membershipZkAppAddress.toBase58()},\n
            purchaseStartBlockHeight: ${purchaseStartBlockHeight.toString()},\n
            purchaseEndBlockHeight: ${purchaseEndBlockHeight.toString()}\n
        `);

        await makeAndSendTransaction({
            feePayerPublicKey: senderKey.toPublicKey(),
            zkAppAddress,
            mutateZkApp() {
                zkApp.initOrReset(
                    tokenSupply,
                    maximumPurchasingAmount,
                    membershipZkAppAddress,
                    purchaseStartBlockHeight,
                    purchaseEndBlockHeight,
                    zkAppPrivateKey
                );
                membershipZkApp.initOrReset(new MerkleMap().getRoot(), UInt32.from(0), membershipZkAppPrivateKey);
            },
            transactionFee,
            signTx(tx: Mina.Transaction) {
                tx.sign([senderKey]);
            },
            getState() {
                return (Blockchain.getAccount(zkAppAddress).tokenSymbol) as string;
            },
            statesEqual(state1, state2) {
                console.log('state1: ', state1, '  state2: ', state2);
                return state2 == state1;
            },
        });

        await syncAllAccountInfo();

        const tokenSymbol = Blockchain.getAccount(zkAppAddress).tokenSymbol;
        expect(tokenSymbol).toEqual('XTKN');

        const zkAppUri = Blockchain.getAccount(zkAppAddress).zkapp?.zkappUri;
        expect(zkAppUri).toEqual('https://github.com/coldstar1993/mina-zkapp-e2e-testing');
    });

    afterEach(async () => {
        // fetches all events from deployment
        let events = await zkApp.fetchEvents(purchaseStartBlockHeight);
        console.log(`fetchEvents(${purchaseStartBlockHeight.toString()}): `, JSON.stringify(events));
    });

    /* 
        !!!!!!!!!!!!!!!!!!! no need this test case, because other cases could cover it !!!!!!!!!!!!!!!!!!!
        it(`CHECK tx should succeed purchase tokens by an non-existing user`, async () => {
            console.log('===================[CHECK tx should succeed purchase tokens by an non-existing user] ===================')
            let totalAmountInCirculation0 = zkApp.totalAmountInCirculation.get();
            console.log('totalAmountInCirculation0: ', totalAmountInCirculation0.toString());
            let memberTreeRoot0 = tokenMembersMerkleMap.getRoot();
            console.log('memberTreeRoot0: ', memberTreeRoot0.toString());
    
            let userPriKey = PrivateKey.random();
            console.log(`create one user with PrivateKey: ${userPriKey.toBase58()},  PublicKey: ${userPriKey.toPublicKey().toBase58()}`);
            await constructOneUserAndPurchase(userPriKey, maximumPurchasingAmount, (senderAccount0: PublicKey, userPriKey0: PrivateKey) => {
                let accUpdt = AccountUpdate.fundNewAccount(senderAccount0, 2);
                accUpdt.send({ to: userPriKey0.toPublicKey(), amount: 3 * 1e9 });
            });
    
            expect(membershipZkApp.memberTreeRoot.get()).not.toEqual(memberTreeRoot0);
            expect(membershipZkApp.memberTreeRoot.get()).toEqual(tokenMembersMerkleMap.getRoot());
            expect(membershipZkApp.memberCount.get()).toEqual(UInt32.from(1));
            expect(zkApp.totalAmountInCirculation.get()).toEqual(totalAmountInCirculation0.add(2));
        })
        !!!!!!!!!!!!!!!!!!! no need this test case, because other cases could cover it !!!!!!!!!!!!!!!!!!!
     */

    it(`CHECK tx should succeed when purchase tokens by an non-existing user, but should fail when purchase by an existing user`, async () => {
        console.log('===================[CHECK tx should succeed purchase tokens by an non-existing user] ===================')
        let totalAmountInCirculation0 = zkApp.totalAmountInCirculation.get();
        console.log('totalAmountInCirculation0: ', totalAmountInCirculation0.toString());
        let memberTreeRoot0 = tokenMembersMerkleMap.getRoot();
        console.log('memberTreeRoot0: ', memberTreeRoot0.toString());

        let userPriKey = PrivateKey.random();
        console.log(`create one user with PrivateKey: ${userPriKey.toBase58()},  PublicKey: ${userPriKey.toPublicKey().toBase58()}`);
        await constructOneUserAndPurchase(userPriKey, maximumPurchasingAmount, (senderAccount0: PublicKey, userPriKey0: PrivateKey) => {
            let accUpdt = AccountUpdate.fundNewAccount(senderAccount0, 2);
            accUpdt.send({ to: userPriKey0.toPublicKey(), amount: 3 * 1e9 });
        });

        expect(membershipZkApp.memberTreeRoot.get()).not.toEqual(memberTreeRoot0);
        expect(membershipZkApp.memberTreeRoot.get()).toEqual(tokenMembersMerkleMap.getRoot());
        expect(membershipZkApp.memberCount.get()).toEqual(UInt32.from(1));
        expect(zkApp.totalAmountInCirculation.get()).toEqual(totalAmountInCirculation0.add(2));
        console.log('===================[tx succeeds when purchase tokens by an non-existing user !!] ===================')

        console.log('===================[CHECK tx should fail when purchase tokens by an existing user] ===================')
        console.log('=======================the same user purchases tokens again=======================');
        totalAmountInCirculation0 = zkApp.totalAmountInCirculation.get();
        memberTreeRoot0 = membershipZkApp.memberTreeRoot.get();
        let memberCount0 = membershipZkApp.memberCount.get();

        // construct a tx and send
        try {
            await constructOneUserAndPurchase(userPriKey, maximumPurchasingAmount, (senderAccount0: PublicKey, userPriKey0: PrivateKey) => {
                let accUpdt = AccountUpdate.fundNewAccount(senderAccount0);
                accUpdt.send({ to: userPriKey0.toPublicKey(), amount: 3 * 1e9 });
            });
        } catch (error) {
            console.log('===================[As Expected, tx fails when purchase tokens by an existing user !!] ===================')
            console.error(error);
        }

        expect(membershipZkApp.memberTreeRoot.get()).toEqual(memberTreeRoot0);// should equal
        expect(membershipZkApp.memberCount.get()).toEqual(memberCount0);
        expect(zkApp.totalAmountInCirculation.get()).toEqual(totalAmountInCirculation0);
    });

    it(`CHECK tx should fail when purchase tokens with EXCEEDING precondition.network.blockchainLength`, async () => {
        console.log('===================[CHECK tx should fail when purchase tokens with EXCEEDING precondition.network.blockchainLength] ===================')
        let totalAmountInCirculation0 = zkApp.totalAmountInCirculation.get();
        console.log('totalAmountInCirculation0: ', totalAmountInCirculation0.toString());
        let memberTreeRoot0 = membershipZkApp.memberTreeRoot.get();
        console.log('memberTreeRoot0: ', memberTreeRoot0.toString());
        let memberCount0 = membershipZkApp.memberCount.get();
        console.log('memberCount0: ', memberCount0.toString());

        // wait for blockchainHeight
        await waitBlockHeightToExceed(purchaseEndBlockHeight);

        let userPriKey = PrivateKey.random();
        try {
            await constructOneUserAndPurchase(userPriKey, maximumPurchasingAmount, (senderAccount0: PublicKey, userPriKey0: PrivateKey) => {
                let accUpdt = AccountUpdate.fundNewAccount(senderAccount0, 2);
                accUpdt.send({ to: userPriKey0.toPublicKey(), amount: 3 * 1e9 });
            });
        } catch (error) {
            console.log('========== As Expected, tx fails when purchase tokens with EXCEEDING precondition.network.blockchainLength ========== ');
            console.error(error);
        }
        expect(membershipZkApp.memberTreeRoot.get()).toEqual(memberTreeRoot0);
        expect(membershipZkApp.memberCount.get()).toEqual(memberCount0);
        expect(zkApp.totalAmountInCirculation.get()).toEqual(totalAmountInCirculation0);
    });

    it(`CHECK tx should fail when purchase tokens when EXCEEDING maximum purchasing amount`, async () => {
        console.log('===================[CHECK tx should fail when purchase tokens when EXCEEDING maximum purchasing amount] ===================')
        let totalAmountInCirculation0 = zkApp.totalAmountInCirculation.get();
        console.log('totalAmountInCirculation0: ', totalAmountInCirculation0.toString());
        let memberTreeRoot0 = membershipZkApp.memberTreeRoot.get();
        console.log('memberTreeRoot0: ', memberTreeRoot0.toString());
        let memberCount0 = membershipZkApp.memberCount.get();
        console.log('memberCount0: ', memberCount0.toString());

        let userPriKey = PrivateKey.random();
        try {
            await constructOneUserAndPurchase(userPriKey, maximumPurchasingAmount.add(1), (senderAccount0: PublicKey, userPriKey0: PrivateKey) => {
                let accUpdt = AccountUpdate.fundNewAccount(senderAccount0, 2);
                accUpdt.send({ to: userPriKey0.toPublicKey(), amount: 3 * 1e9 });
            });
        } catch (error) {
            console.log('========== As Expected, tx fails when purchase tokens when EXCEEDING maximum purchasing amount ========== ');
            console.error(error);
        }

        expect(membershipZkApp.memberTreeRoot.get()).toEqual(memberTreeRoot0);
        expect(membershipZkApp.memberCount.get()).toEqual(memberCount0);
        expect(zkApp.totalAmountInCirculation.get()).toEqual(totalAmountInCirculation0);
    });


    it(`CHECK tx should fail when purchase tokens when (totalAmountInCirculation + purchasingAmount) > SUPPLY `, async () => {
        console.log('===================[CHECK tx should fail when purchase tokens when (totalAmountInCirculation + purchasingAmount) > SUPPLY ] ===================')

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
        console.log('=========purchase tokens when (totalAmountInCirculation + purchasingAmount) > SUPPLY, (should FAIL)=========');
        let totalAmountInCirculation0 = zkApp.totalAmountInCirculation.get();
        console.log('totalAmountInCirculation0: ', totalAmountInCirculation0.toString());
        let memberTreeRoot0 = membershipZkApp.memberTreeRoot.get();
        console.log('memberTreeRoot0: ', memberTreeRoot0.toString());
        let memberCount0 = membershipZkApp.memberCount.get();
        console.log('memberCount0: ', memberCount0.toString());

        let userPriKeyThird = PrivateKey.random();
        try {
            await constructOneUserAndPurchase(userPriKeyThird, maximumPurchasingAmount.add(1), (senderAccount0: PublicKey, userPriKey0: PrivateKey) => {
                let accUpdt = AccountUpdate.fundNewAccount(senderAccount0, 2);
                accUpdt.send({ to: userPriKey0.toPublicKey(), amount: 3 * 1e9 });
            });
        } catch (error) {
            console.log('=========purchase tokens when (totalAmountInCirculation + purchasingAmount) > SUPPLY, As Expected, tx FAIL!)=========');
            console.error(error);
        }
        expect(membershipZkApp.memberTreeRoot.get()).toEqual(memberTreeRoot0);
        expect(membershipZkApp.memberCount.get()).toEqual(memberCount0);
        expect(zkApp.totalAmountInCirculation.get()).toEqual(totalAmountInCirculation0);
    });

    it(`CHECK if (timing-lock Mina balance when totalAmountInCirculation == SUPPLY) AND (Mina of 'cliffAmount' can be transferred after 'cliffTime')`, async () => {
        console.log('===================[CHECK if timing-lock Mina balance when totalAmountInCirculation == SUPPLY]===================');

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

        // wait for blocks grow...
        await waitBlockHeightToExceed(purchaseEndBlockHeight);

        console.log('========================try to transfer MINA of excess amounts (should FAIL) ========================');
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
            console.log('========================try to transfer excess amounts, As Expected, tx FAIL! ========================');
            console.error(error);
        }
        console.log('ZkAppAcctInfo: ', JSON.stringify(await syncAcctInfo(zkAppAddress)));

        expect(zkApp.account.balance.get()).toEqual(currentAcctBalance0);


        console.log('========================try to transfer MINA of suitable amounts (should SUCCEED) ========================');
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
        console.log('========================try to transfer suitable amounts, As Expected, tx: SUCCEED! ========================');
        console.log('ZkAppAcctInfo: ', JSON.stringify(await syncAcctInfo(zkAppAddress)));

        expect(zkApp.account.balance.get()).toEqual(currentAcctBalance0.sub(transferedAmount1));

        /* 
                console.log('\n\n===================[CHECK if Mina of \'cliffAmount\' can be transferred after 'cliffTime']===================');
                // wait for blocks grow...
                await waitBlockHeightToExceed(purchaseEndBlockHeight);// TODO
        
                console.log('========================try to transfer MINA of excess amounts (should FAIL) ========================');
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
                    console.log('========================try to transfer excess amounts, As Expected, tx FAIL! ========================');
                    console.error(error);
                }
                console.log('ZkAppAcctInfo: ', JSON.stringify(await syncAcctInfo(zkAppAddress)));
        
                expect(zkApp.account.balance.get()).toEqual(currentAcctBalance0); */

    });

    /*  
        !!!!!!!!!!!!!!!!!!! no need this test case, because other cases could cover it !!!!!!!!!!!!!!!!!!!
        it(`CHECK if one can ONLY vote for ONE time To Process Rest Tokens `, async () => {
            console.log('===================[CHECK if one can ONLY vote for ONE time To Process Rest Tokens]===================');
    
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
    
            let tx = await Mina.transaction(userPubKeyFirst, () => {
                let voter = userPriKeyFirst;
                let voteOption = UInt64.from(1);
                let voterMerkleMapWitness = tokenMembersMerkleMap.getWitness(Poseidon.hash(voter.toPublicKey().toFields()));
                zkApp.voteToProcessRestTokens(voter, voteOption, voterMerkleMapWitness);
            });
            await tx.prove();
            tx.sign([userPriKeyFirst]);
            await tx.send();
    
            console.log('ZkAppAcctInfo: ', JSON.stringify(await syncAcctInfo(zkAppAddress)));
    
            expect(zkApp.reducer.getActions({ fromActionHash: Reducer.initialActionsHash }).length).toBeGreaterThan(pendingActions0.length);
    
            console.log('========== vote again ==========')
            let pendingActions1 = zkApp.reducer.getActions({ fromActionHash: Reducer.initialActionsHash });
            try {
                let tx1 = await Mina.transaction(userPubKeyFirst, () => {
                    let voter = userPriKeyFirst;
                    let voteOption = UInt64.from(1);
                    let voterMerkleMapWitness = tokenMembersMerkleMap.getWitness(Poseidon.hash(voter.toPublicKey().toFields()));
                    zkApp.voteToProcessRestTokens(voter, voteOption, voterMerkleMapWitness);
                });
                await tx1.prove();
                tx1.sign([userPriKeyFirst]);
                await tx1.send();
            } catch (error) {
                console.error(error);
            }
            console.log('ZkAppAcctInfo: ', JSON.stringify(await syncAcctInfo(zkAppAddress)));
    
            expect(zkApp.reducer.getActions({ fromActionHash: Reducer.initialActionsHash }).length).toEqual(pendingActions1.length);
        })
        !!!!!!!!!!!!!!!!!!! no need this test case, because other cases could cover it !!!!!!!!!!!!!!!!!!!
     */
    /*
       it(`CHECK if one can ONLY vote for ONE time To Process Rest Tokens AND rollup VoteNotes by reducing Actions`, async () => {
           console.log('===================[CHECK if one can ONLY vote for ONE time To Process Rest Tokens AND then rollup VoteNotes by reducing Actions]===================');
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
               let voterMerkleMapWitness = tokenMembersMerkleMap.getWitness(Poseidon.hash(voter.toPublicKey().toFields()));
               zkApp.voteToProcessRestTokens(voter, voteOption, voterMerkleMapWitness);
           });
           await voteTx1.prove();
           voteTx1.sign([userPriKeyFirst]);
           let voteTx1Id = await voteTx1.send();
           console.log(`[firstUser to vote]'s tx[${voteTx1Id.hash()!}] sent...`);
           voteTx1Id.wait({ maxAttempts: 1000 });
   
           console.log('===================[CHECK if one can ONLY vote for ONE time To Process Rest Tokens]===================');
           console.log('     ========== the firstUser vote again( tx should fail ) ==========     ')
           let pendingActions1 = zkApp.reducer.getActions({ fromActionHash: Reducer.initialActionsHash });
           try {
               let tx1 = await Mina.transaction(userPubKeyFirst, () => {
                   let voter = userPriKeyFirst;
                   let voteOption = UInt64.from(1);
                   let voterMerkleMapWitness = tokenMembersMerkleMap.getWitness(Poseidon.hash(voter.toPublicKey().toFields()));
                   zkApp.voteToProcessRestTokens(voter, voteOption, voterMerkleMapWitness);
               });
               await tx1.prove();
               tx1.sign([userPriKeyFirst]);
               await tx1.send();
           } catch (error) {
               console.log('========== the firstUser vote again, and As Expected, tx failed!!! ==========')
               console.error(error);
           }
           console.log('ZkAppAcctInfo: ', JSON.stringify(await syncAcctInfo(zkAppAddress)));
           expect(zkApp.reducer.getActions({ fromActionHash: Reducer.initialActionsHash }).length).toEqual(pendingActions1.length);
   
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
               let voterMerkleMapWitness = tokenMembersMerkleMap.getWitness(Poseidon.hash(voter.toPublicKey().toFields()));
               zkApp.voteToProcessRestTokens(voter, voteOption, voterMerkleMapWitness);
           });
           await voteTx2.prove();
           voteTx2.sign([userPriKeySec]);
           let voteTx2Id = await voteTx2.send();
           console.log(`[secUser to vote]'s tx[${voteTx2Id.hash()!}] sent...`);
           voteTx2Id.wait({ maxAttempts: 1000 });
   
           console.log('========================thirdUser starts========================');
           let userPriKeyThird = PrivateKey.random();
           let userPubKeyThird = userPriKeyThird.toPublicKey();
           await constructOneUserAndPurchase(userPriKeyThird, maximumPurchasingAmount.sub(1), (senderAccount0: PublicKey, userPriKey0: PrivateKey) => {
               let accUpdt = AccountUpdate.fundNewAccount(senderAccount0, 2);
               accUpdt.send({ to: userPriKey0.toPublicKey(), amount: 3 * 1e9 });
           });
   
           console.log('===================[CHECK rollup actions WITHOUT all members\' votes ( tx should fail )]===================');
           // wait for blockheight grows
           await waitBlockHeightToExceed(purchaseEndBlockHeight);
   
           console.log('ZkAppAcctInfo: ', JSON.stringify(await syncAcctInfo(zkAppAddress)));
           await syncAcctInfo(senderAccount);
   
           let actionHashVote0 = zkApp.actionHashVote.get();
           try {
               let tx = await Mina.transaction({ sender: senderAccount, fee: transactionFee }, () => {
                   zkApp.rollupVoteNote();
               });
               await tx.prove();
               tx.sign([senderKey]);
               await tx.send();
               let txId = await tx.send();
               console.log(`[rollupVoteNote when voters' number not meet]'s tx[${txId.hash()!}] sent...`);
               txId.wait({ maxAttempts: 1000 });
           } catch (error) {
               console.log('========== rollup actions WITHOUT all members\' votes, and As Expected, tx failed!!! ==========')
               console.error(error);
           }
           // console.log('ZkAppAcctInfo: ', JSON.stringify(await syncAcctInfo(zkAppAddress)));
           expect(zkApp.actionHashVote.get()).toEqual(actionHashVote0);
   
           console.log('     =================thirdUser votes===================     ');
           let voteTx3 = await Mina.transaction(userPubKeyThird, () => {
               let voter = userPriKeyThird;
               let voteOption = UInt64.from(2);// vote to keep the extra tokens
               let voterMerkleMapWitness = tokenMembersMerkleMap.getWitness(Poseidon.hash(voter.toPublicKey().toFields()));
               zkApp.voteToProcessRestTokens(voter, voteOption, voterMerkleMapWitness);
           });
           await voteTx3.prove();
           voteTx3.sign([userPriKeyThird]);
           let voteTx3Id = await voteTx3.send();
           console.log(`[thirdUser to vote]'s tx[${voteTx3Id.hash()!}] sent...`);
           voteTx3Id.wait({ maxAttempts: 1000 });
   
           console.log('ZkAppAcctInfo: ', JSON.stringify(await syncAcctInfo(zkAppAddress)));
   
           // wait for blockheight grows
           await waitBlockHeightToExceed(purchaseEndBlockHeight);
   
           let actionHashVote01 = zkApp.actionHashVote.get();
   
           let tx = await Mina.transaction({ sender: senderAccount, fee: transactionFee }, () => {
               zkApp.rollupVoteNote();
           });
           await tx.prove();
           tx.sign([senderKey]);
           let txId = await tx.send();
           console.log(`[rollupVoteNote when voters' number meets]'s tx[${txId.hash()!}] sent...`);
           txId.wait({ maxAttempts: 1000 });
   
           expect(zkApp.actionHashVote.get()).not.toEqual(actionHashVote01);
       });
   
       it(`CHECK transfer custom tokens with proof authorization`, async () => {
           console.log('===================[CHECK transfer custom tokens with proof authorization]===================');
   
           let tokenId = zkApp.token.id;
           let userPriKey = PrivateKey.random();
           let userPubKey = userPriKey.toPublicKey();
           console.log('userPubKey: ', userPubKey.toBase58());
   
           let userPriKey1 = PrivateKey.random();
           let userPubKey1 = userPriKey1.toPublicKey();
           console.log('userPubKey1: ', userPubKey1.toBase58());
   
           // deploy NormalTokenUser Zkapp
           let tx0 = await Mina.transaction({ sender: senderAccount, fee: transactionFee }, () => {
               AccountUpdate.fundNewAccount(senderAccount, 2);
               zkApp.deployZkapp(userPubKey, NormalTokenUser._verificationKey!);
               zkApp.deployZkapp(userPubKey1, NormalTokenUser._verificationKey!);
           });
           await tx0.prove();
           tx0.sign([senderKey, userPriKey, userPriKey1]);
           // console.log('deploy NormalTokenUser tx: ', tx0.toJSON());
           let tx0Id = await tx0.send();
           console.log(`[deploy two NormalTokenUser contracts for two users]'s tx[${tx0Id.hash()!}] sent...`);
           tx0Id.wait({ maxAttempts: 1000 });
   
           // user purchase token
           await constructOneUserAndPurchase(userPriKey, maximumPurchasingAmount, (senderAccount0: PublicKey, userPriKey0: PrivateKey) => {
               let accUpdt = AccountUpdate.fundNewAccount(senderAccount0);
               accUpdt.send({ to: userPriKey0.toPublicKey(), amount: 3 * 1e9 });
           });
           // user1 purchase token
           await constructOneUserAndPurchase(userPriKey1, maximumPurchasingAmount, (senderAccount0: PublicKey, userPriKey0: PrivateKey) => {
               let accUpdt = AccountUpdate.fundNewAccount(senderAccount0);
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
           let tx1Id = await tx1.send();
           console.log(`[transfer token by proof-auth from one user to another user]'s tx[${tx1Id.hash()!}] sent...`);
           tx1Id.wait({ maxAttempts: 1000 });
   
           expect(
               Mina.getBalance(userPubKey, tokenId).value.toBigInt()
           ).toEqual(1n);
           expect(
               Mina.getBalance(userPubKey1, tokenId).value.toBigInt()
           ).toEqual(3n);
       })
   */
});
