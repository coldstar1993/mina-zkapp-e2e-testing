import { Account, AccountUpdate, fetchAccount, Field, isReady, MerkleMap, Mina, Poseidon, PrivateKey, PublicKey, shutdown, Types, UInt64 } from 'snarkyjs';
import { Membership } from './Membership.js';
import { getProfiler } from "./profiler.js";

describe('test fuctions inside Membership', () => {
    async function runTests(deployToBerkeley = false) {
        let Blockchain: any;
        let deployerAccount: PublicKey,
            deployerKey: PrivateKey,
            senderAccount: PublicKey,
            senderKey: PrivateKey,
            zkAppVerificationKey: any,
            zkAppAddress: PublicKey,
            zkAppPrivateKey: PrivateKey,
            zkApp: Membership,
            membershipMerkleMap: MerkleMap;
        let MembershipTestProfiler = getProfiler('Membership zkApp');

        beforeAll(async () => {
            MembershipTestProfiler.start('isReady');
            await isReady;
            MembershipTestProfiler.stop();

            MembershipTestProfiler.start('Membership.compile');
            zkAppVerificationKey = (await Membership.compile()).verificationKey;
            MembershipTestProfiler.stop();

            Blockchain = deployToBerkeley ? Mina.Network('https://proxy.berkeley.minaexplorer.com/graphql') : Mina.LocalBlockchain({ proofsEnabled: true });
            Mina.setActiveInstance(Blockchain);
        });

        afterAll(() => {
            setInterval(shutdown, 0);
        });

        beforeEach(async () => {
            if (deployToBerkeley) {// Berkeley
                deployerKey = PrivateKey.fromBase58('EKEvpZnLn2nMtnpwkfJJ3sLVCKxZFJguBLEhsr4PLrX4Qx7xhgAm');
                deployerAccount = deployerKey.toPublicKey();

                console.log('to fetchAccount for deployerAccount...');
                let deployerAccountInfo: any;
                try {
                    deployerAccountInfo = await fetchAccount({ publicKey: deployerAccount });
                } catch (error) {
                    console.error(error);
                }
                try {
                    if (deployerAccountInfo == undefined) {
                        MembershipTestProfiler.start('Mina.faucet(deployerAccount)');
                        await Mina.faucet(deployerAccount);
                        MembershipTestProfiler.stop();
                    }
                } catch (error) {
                    console.error(error);
                }              
                console.log('done!');

                senderKey = PrivateKey.fromBase58('EKEYaNo9HxkMpNrjuAYCXug42TJnij36MkEnDsx58TfF3cFNff3n');
                senderAccount = senderKey.toPublicKey();

                console.log('to fetchAccount for senderAccount...');
                let senderAccountInfo: any;
                try {
                    senderAccountInfo = await fetchAccount({ publicKey: deployerAccount });
                } catch (error) {
                    console.error(error);
                }
                try {
                    if (senderAccountInfo == undefined) {
                        MembershipTestProfiler.start('Mina.faucet(senderAccount)');
                        await Mina.faucet(senderAccount);
                        MembershipTestProfiler.stop();
                    }
                } catch (error) {
                    console.error(error);
                }
                console.log('done!');

            } else {// Local
                ({ privateKey: deployerKey, publicKey: deployerAccount } = Blockchain.testAccounts[0]);
                ({ privateKey: senderKey, publicKey: senderAccount } = Blockchain.testAccounts[1]);
            }

            console.log(`deployerKey: ${deployerKey.toBase58()}, deployerPubKey: ${deployerAccount.toBase58()}`);
            console.log('initially deployerAccount.balance: ', Mina.getAccount(deployerAccount).balance.div(1e9).toString());
            console.log(`senderKey: ${senderKey.toBase58()}, senderAccount: ${senderAccount.toBase58()}`);
            console.log('initially senderAccount.balance: ', Mina.getAccount(senderAccount).balance.div(1e9).toString());

            zkAppPrivateKey = PrivateKey.random();
            zkAppAddress = zkAppPrivateKey.toPublicKey();
            zkApp = new Membership(zkAppAddress);
            console.log('zkAppAddress: ', zkAppAddress.toBase58());

            let needDeploy = false;
            if (deployToBerkeley) {// Berkeley
                MembershipTestProfiler.start('Mina.fetchAccount(zkAppAddress)');
                let zkAppAccountInfo: any;
                try {
                    zkAppAccountInfo = await fetchAccount({ publicKey: zkAppAddress });
                } catch (error) {
                    console.error(error);
                }
                MembershipTestProfiler.stop();
                if (zkAppAccountInfo == undefined || zkAppAccountInfo.account == undefined) {
                    // check if need to deploy to Berkeley Network
                    needDeploy = true;
                }
            }

            if (!deployToBerkeley || needDeploy) {
                // deploy zkApp
                let tx = await Mina.transaction(deployerAccount, () => {
                    AccountUpdate.fundNewAccount(deployerAccount);
                    zkApp.deploy({ zkappKey: zkAppPrivateKey, verificationKey: zkAppVerificationKey });
                });
                let txId = await tx.sign([deployerKey]).send();
                console.log(`deployment tx send-0: txId.isSuccess:`, txId.isSuccess);
                await txId.wait();
                console.log(`deployment tx send-1: txId.isSuccess:`, txId.isSuccess);
            }

            membershipMerkleMap = new MerkleMap();
            const merkleRoot0 = membershipMerkleMap.getRoot();
            console.log(`membershipMerkleMap's initial root: ${merkleRoot0.toString()}`);
        });

        it(`store an existing user`, async () => {
            let oneUserPriKey = PrivateKey.random();
            let oneUserPubKey = oneUserPriKey.toPublicKey();
            console.log(`oneUserPriKey: ${oneUserPriKey.toBase58()},  oneUserPubKey: ${oneUserPubKey.toBase58()}`)
            let indx = Poseidon.hash(oneUserPubKey.toFields());
            // store the user
            membershipMerkleMap.set(indx, Field(1));
            // get witness for existence
            let oneUserMerkleMapWitness = membershipMerkleMap.getWitness(indx);
            console.log(`oneUserMerkleMapWitness: ${oneUserMerkleMapWitness}`)
            // construct a tx and send
            MembershipTestProfiler.start('Mina.transaction()');
            const tx = await Mina.transaction(senderAccount, () => {
                zkApp.addNewMember(oneUserPubKey, oneUserMerkleMapWitness);
            });
            MembershipTestProfiler.stop();
            MembershipTestProfiler.start('tx.prove()');
            await tx.prove();
            MembershipTestProfiler.stop();
            tx.sign([senderKey]);
            MembershipTestProfiler.start('tx.send()');
            await tx.send();
            MembershipTestProfiler.stop();
        });

        it(`store an non-existing user`, async () => {
            let oneUserPriKey = PrivateKey.random();
            let oneUserPubKey = oneUserPriKey.toPublicKey();
            console.log(`oneUserPriKey: ${oneUserPriKey.toBase58()},  oneUserPubKey: ${oneUserPubKey.toBase58()}`)

            // get witness for existence
            let indx = Poseidon.hash(oneUserPubKey.toFields());
            let oneUserValue = membershipMerkleMap.get(indx);
            console.log(`oneUserValue: ${oneUserValue.toString()}`);
            let oneUserMerkleMapWitness = membershipMerkleMap.getWitness(indx);
            console.log(`oneUserMerkleMapWitness: ${oneUserMerkleMapWitness.toJSON()}`)

            // construct a tx and send
            MembershipTestProfiler.start('Mina.transaction()');
            const tx = await Mina.transaction(senderAccount, () => {
                zkApp.addNewMember(oneUserPubKey, oneUserMerkleMapWitness);
            });
            MembershipTestProfiler.stop();

            MembershipTestProfiler.start('tx.prove()');
            await tx.prove();
            MembershipTestProfiler.stop();

            tx.sign([senderKey]);
            MembershipTestProfiler.start('tx.send()');
            await tx.send();
            MembershipTestProfiler.stop().store();

            // store the user
            // membershipMerkleMap.set(indx, Field(1));
        });
    }

    //  runTests(false);
    runTests(true);
});