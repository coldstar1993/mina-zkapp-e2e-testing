import { AccountUpdate, Bool, Experimental, fetchAccount, fetchLastBlock, Field, isReady, MerkleMap, Mina, Poseidon, PrivateKey, PublicKey, Reducer, shutdown, Signature, Types, UInt32, UInt64 } from 'snarkyjs';
import { XTokenContract, NormalTokenUser } from './XTokenContract.js';
import { Membership } from './Membership.js';
import { VoteProof, VoteZkProgram, VoteState } from "./vote.js";
import { VoteDelegateContract } from './VoteDelegateContract.js';

describe('test fuctions inside VoteDelegateContract', () => {
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

    let voteDelegateContractPrivateKey: PrivateKey;
    let voteDelegateContractAddress: PublicKey;
    let voteDelegateContract: VoteDelegateContract;
    let voteDelegateContractVerificationKey: any;
    let voterNullifierMerkleMap: MerkleMap;

    let voteZkProgramVerificationKey: any;

    let purchaseStartBlockHeight: UInt32;
    let purchaseEndBlockHeight: UInt32;
    let tokenSupply: UInt64;
    let maximumPurchasingAmount: UInt64;

    let newDelegateTargetKey: PrivateKey;
    let newDelegateTargetAddress: PublicKey;

    let voteDelegateContractAcctInfo: Types.Account | undefined;
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
        let beforePurchaseTxBlockHeight = (await syncNetworkStatus()).blockchainLength;
        await syncAllAccountInfo();

        let userPubKey = userPriKey.toPublicKey();

        // get merkle witness
        let indx = Poseidon.hash(userPubKey.toFields());
        let userValue = tokenMembersMerkleMap.get(indx);
        console.log(`user.Value inside merkle map: ${userValue.toString()}`);
        let userMerkleMapWitness = tokenMembersMerkleMap.getWitness(indx);

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
        txId.wait({ maxAttempts: 1000 });
        console.log(`purchaseToken's tx confirmed...`);

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

        zkAppVerificationKey = (await XTokenContract.compile()).verificationKey;
        console.log(`XTokenContract.compile done!`);

        voteZkProgramVerificationKey = await VoteZkProgram.compile();
        console.log(`VoteZkProgram.compile done!`);

        voteDelegateContractVerificationKey = (await VoteDelegateContract.compile()).verificationKey;
        console.log(`VoteDelegateContract.compile done!`);

    });

    afterAll(() => {
        setInterval(shutdown, 0);
    });

    beforeEach(async () => {
        await syncNetworkStatus();

        if (process.env.TEST_ON_BERKELEY! == 'true') {// Berkeley
            senderKey = PrivateKey.fromBase58('EKDmWEWjC6UampzAph9ddAbnmuBgHAfiQhAmSVT6ACJgPFzCsoTW');
            senderAccount = senderKey.toPublicKey();//EKDmWEWjC6UampzAph9ddAbnmuBgHAfiQhAmSVT6ACJgPFzCsoTW  pubKey:  B62qkvenQ4bZ5qt5QJN8bmEq92KskKH4AZP7pgbMoyiMAccWTWjHRoD

            console.log(`Funding fee payer ${senderAccount.toBase58()} and waiting for inclusion in a block..`);
            await Mina.faucet(senderAccount);
            await fetchAccount({ publicKey: senderAccount });
            console.log('senderAccount is funded!');

        } else {// Local
            ({ privateKey: senderKey, publicKey: senderAccount } = Blockchain.testAccounts[0]);
        }

        console.log(`senderKey: ${senderKey.toBase58()}, senderAccount: ${senderAccount.toBase58()}`);
        let { nonce, balance } = await syncAcctInfo(senderAccount);
        console.log(`initially, senderAccount.nonce: ${nonce}, senderAccount.balance: ${balance}`);

        membershipZkAppPrivateKey = needDeployContractEachTime ? PrivateKey.random() : PrivateKey.fromBase58('EKFRWWuziCMDCoTqzhsaYBeRPDt2tKbPEYwCLgecfsYgUPnaJfji');
        membershipZkAppAddress = membershipZkAppPrivateKey.toPublicKey();
        membershipZkApp = new Membership(membershipZkAppAddress);
        console.log('membershipZkApp\'s PrivateKey: ', membershipZkAppPrivateKey.toBase58(), ' ,  membershipZkApp\'s Address: ', membershipZkAppAddress.toBase58());

        zkAppPrivateKey = needDeployContractEachTime ? PrivateKey.random() : PrivateKey.fromBase58('EKEHu59a3GUam6rhuVUaA5wXeunJ1mmxgPVZABCj3ix1hVaXgJZK');
        zkAppAddress = zkAppPrivateKey.toPublicKey();
        zkApp = new XTokenContract(zkAppAddress);
        console.log('xTokenContractZkApp\'s PrivateKey: ', zkAppPrivateKey.toBase58(), ' , xTokenContractZkApp\'s Address: ', zkAppAddress.toBase58());

        voteDelegateContractPrivateKey = needDeployContractEachTime ? PrivateKey.random() : PrivateKey.fromBase58('');
        voteDelegateContractAddress = voteDelegateContractPrivateKey.toPublicKey();
        voteDelegateContract = new VoteDelegateContract(voteDelegateContractAddress);
        console.log('voteDelegateContract\'s PrivateKey: ', voteDelegateContractPrivateKey.toBase58(), ' , voteDelegateContract\'s Address: ', voteDelegateContractAddress.toBase58());

        // init appStatus values
        purchaseStartBlockHeight = Mina.activeInstance.getNetworkState().blockchainLength;
        purchaseEndBlockHeight = Mina.activeInstance.getNetworkState().blockchainLength.add(5);// TODO
        tokenSupply = UInt64.from(6);
        maximumPurchasingAmount = UInt64.from(2);

        newDelegateTargetKey = PrivateKey.random();
        newDelegateTargetAddress = newDelegateTargetKey.toPublicKey();
        console.log('newDelegateTarget\'s PrivateKey: ', voteDelegateContractPrivateKey.toBase58(), ' , newDelegateTarget\'s Address: ', newDelegateTargetAddress.toBase58());

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

            console.log(`VoteDelegateContract: deploying...`);
            // deploy VoteDelegateContract
            let tx_deployVoteDelegateContract = await Mina.transaction({ sender: senderAccount, fee: transactionFee }, () => {
                AccountUpdate.fundNewAccount(senderAccount);
                voteDelegateContract.deploy({ zkappKey: voteDelegateContractPrivateKey, verificationKey: voteDelegateContractVerificationKey });
            });
            let txId_deployVoteDelegateContract = await tx_deployVoteDelegateContract.sign([senderKey]).send();
            console.log(`VoteDelegateContract: deployment tx[${txId_deployVoteDelegateContract.hash()!}] sent...`);
            await txId_deployVoteDelegateContract.wait({ maxAttempts: 1000 });
            console.log(`voteDelegateContract: txId.isSuccess:`, txId_deployVoteDelegateContract.isSuccess);
        }

        await syncAllAccountInfo();

        tokenMembersMerkleMap = new MerkleMap();
        const merkleRoot0 = tokenMembersMerkleMap.getRoot();
        console.log(`tokenMembersMerkleMap's initial root: ${merkleRoot0.toString()}`);

        voterNullifierMerkleMap = new MerkleMap();
        const voterNullifierMerkleMapRoot0 = voterNullifierMerkleMap.getRoot();
        console.log(`voterNullifierMerkleMap's initial root: ${voterNullifierMerkleMapRoot0.toString()}`);

        await syncNetworkStatus();

        // initialize or reset XTokenContract & MembershipZkApp & VoteDelegateContract
        console.log(`trigger all contracts to initialize...`);
        console.log(`
            ================ params for xTokenContract: 
            tokenSupply: ${tokenSupply.toString()},\n
            maximumPurchasingAmount: ${maximumPurchasingAmount.toString()},\n
            membershipZkAppAddress: ${membershipZkAppAddress.toBase58()},\n
            purchaseStartBlockHeight: ${purchaseStartBlockHeight.toString()},\n
            purchaseEndBlockHeight: ${purchaseEndBlockHeight.toString()},\n

            ================ params for voteDelegateContract: 
            zkAppAddress: ${zkAppAddress.toBase58()},\n
            membershipZkAppAddress: ${membershipZkAppAddress.toBase58()},\n
            newDelegateTargetAddress: ${newDelegateTargetAddress.toBase58()}\n
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

            voteDelegateContract.initOrReset(zkAppAddress, membershipZkAppAddress, new MerkleMap().getRoot(), newDelegateTargetAddress, voteDelegateContractPrivateKey);
        });
        await tx.prove();
        let txId = await tx.sign([senderKey]).send();
        console.log(`trigger xTokenContract.initOrReset(*): tx[${txId.hash()!}] sent...`);
        await txId.wait({
            maxAttempts: 1000,
        });
        console.log(`trigger xTokenContract.initOrReset(*): tx confirmed!`);

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

    it(`CHECK all members votes to set delegate`, async () => {
        console.log('===================[CHECK all members votes to set delegate]===================');

        console.log('========================firstUser starts========================');
        let userPriKeyFirst = PrivateKey.random();
        let userPubKeyFirst = userPriKeyFirst.toPublicKey();
        await constructOneUserAndPurchase(userPriKeyFirst, maximumPurchasingAmount, (senderAccount0: PublicKey, userPriKey0: PrivateKey) => {
            let accUpdt = AccountUpdate.fundNewAccount(senderAccount0, 2);
            accUpdt.send({ to: userPriKey0.toPublicKey(), amount: 3 * 1e9 });
        });
        console.log('========================secUser starts========================');
        let userPriKeySec = PrivateKey.random();
        let userPubKeySec = userPriKeySec.toPublicKey();
        await constructOneUserAndPurchase(userPriKeySec, maximumPurchasingAmount.sub(1), (senderAccount0: PublicKey, userPriKey0: PrivateKey) => {
            let accUpdt = AccountUpdate.fundNewAccount(senderAccount0, 2);
            accUpdt.send({ to: userPriKey0.toPublicKey(), amount: 3 * 1e9 });
        });

        console.log('========================thirdUser starts========================');
        let userPriKeyThird = PrivateKey.random();
        let userPubKeyThird = userPriKeyThird.toPublicKey();
        await constructOneUserAndPurchase(userPriKeyThird, maximumPurchasingAmount.sub(1), (senderAccount0: PublicKey, userPriKey0: PrivateKey) => {
            let accUpdt = AccountUpdate.fundNewAccount(senderAccount0, 2);
            accUpdt.send({ to: userPriKey0.toPublicKey(), amount: 3 * 1e9 });
        });

        // wait for blockheight grows
        await waitBlockHeightToExceed(purchaseEndBlockHeight);

        console.log('======================== start recursively voting========================');
        console.log('zkAppAcctInfo: ', JSON.stringify(await syncAcctInfo(zkAppAddress)));
        console.log('voteDelegateContractAcctInfo: ', JSON.stringify(await syncAcctInfo(voteDelegateContractAddress)));

        let delegate0 = zkApp.account.delegate.get();
        console.log('original delegate address: ', delegate0.toBase58());

        console.log('new delegate address: ', voteDelegateContract.targetDelegateTo.get().toBase58());

        console.log('making zero_proof... ');
        const vote0 = VoteState.newVote(tokenMembersMerkleMap.getRoot());
        const proof0 = await VoteZkProgram.create(vote0);

        console.log('making proof 1 - userPriKeyFirst...');
        const nullifierKey1 = Poseidon.hash(userPriKeyFirst.toFields());
        const nullifierWitness1 = voterNullifierMerkleMap.getWitness(nullifierKey1)
        const tokenMembersWitness1 = tokenMembersMerkleMap.getWitness(Poseidon.hash(userPubKeyFirst.toFields()));

        const vote1 = VoteState.applyVote(vote0, Bool(true), userPriKeyFirst, tokenMembersWitness1, nullifierWitness1);
        const proof1 = await VoteZkProgram.applyVote(vote1, proof0, Bool(true), userPriKeyFirst, tokenMembersWitness1, nullifierWitness1);
        voterNullifierMerkleMap.set(nullifierKey1, Field(1));

        console.log('making proof 2 - userPriKeySec...');
        const nullifierKey2 = Poseidon.hash(userPriKeySec.toFields());
        const nullifierWitness2 = voterNullifierMerkleMap.getWitness(nullifierKey2)
        const tokenMembersWitness2 = tokenMembersMerkleMap.getWitness(Poseidon.hash(userPubKeySec.toFields()));

        const vote2 = VoteState.applyVote(vote1, Bool(true), userPriKeySec, tokenMembersWitness2, nullifierWitness2);
        const proof2 = await VoteZkProgram.applyVote(vote2, proof1, Bool(true), userPriKeySec, tokenMembersWitness2, nullifierWitness2);
        voterNullifierMerkleMap.set(nullifierKey2, Field(1));

        console.log('making proof 3 - userPriKeyThird...');
        const nullifierKey3 = Poseidon.hash(userPriKeyThird.toFields());
        const nullifierWitness3 = voterNullifierMerkleMap.getWitness(nullifierKey3)
        const tokenMembersWitness3 = tokenMembersMerkleMap.getWitness(Poseidon.hash(userPubKeyThird.toFields()));

        const vote3 = VoteState.applyVote(vote2, Bool(true), userPriKeyThird, tokenMembersWitness3, nullifierWitness3);
        const proof3 = await VoteZkProgram.applyVote(vote3, proof2, Bool(true), userPriKeyThird, tokenMembersWitness3, nullifierWitness3);
        voterNullifierMerkleMap.set(nullifierKey3, Field(1));

        let tx = await Mina.transaction({ sender: senderAccount, fee: transactionFee }, () => {
            voteDelegateContract.voteDelegateTo(zkAppPrivateKey, proof3);
        });
        await tx.prove();
        tx.sign([senderKey]);
        await tx.send();
        let txId = await tx.send();
        console.log(`[recursively voting]'s tx[${txId.hash()!}] sent...`);
        txId.wait({ maxAttempts: 1000 });

        console.log('ZkAppAcctInfo: ', JSON.stringify(await syncAcctInfo(zkAppAddress)));
        expect(zkApp.account.delegate.get()).not.toEqual(delegate0);
        expect(zkApp.account.delegate.get()).toEqual(voteDelegateContract.targetDelegateTo.get());
    });

});