import { Circuit, MerkleMapWitness, Field, method, Permissions, PrivateKey, PublicKey, Reducer, Signature, SmartContract, state, State, Struct, UInt32, UInt64, CircuitString, Poseidon, Account, AccountUpdate } from "snarkyjs"
import { Membership } from "./Membership";

class PurchaseEvent extends Struct({ purchaser: PublicKey, purchasingAmount: UInt64 }) {
    static createEmptyEntity() {
        return new PurchaseEvent({ purchaser: PrivateKey.random().toPublicKey(), purchasingAmount: UInt64.zero });
    }
}

class VoteNote extends Struct({ voter: PublicKey, voteOption: UInt64 }) {
    static createEmptyEntity() {
        return new VoteNote({ voter: PrivateKey.random().toPublicKey(), voteOption: UInt64.zero });
    }
}


export class XTokenContract extends SmartContract {
    // events
    events = {
        "purchase-tokens": PurchaseEvent
    }
    // reducer
    reducer = Reducer({ actionType: VoteNote })

    @state(UInt64) SUPPLY = State<UInt64>();
    @state(UInt64) totalAmountInCirculation = State<UInt64>();

    @state(UInt64) maximumPurchasingAmount = State<UInt64>();
    @state(Field) actionHashVote = State<Field>();

    @state(UInt32) purchaseStartBlockHeight = State<UInt32>();
    @state(UInt32) purchaseEndBlockHeight = State<UInt32>();
    @state(PublicKey) memberShipContractAddress = State<PublicKey>();

    init() {
        super.init();
        // set account permissions
        const permissionToEdit = Permissions.proof();
        this.account.permissions.set({
            ...Permissions.default(),
            editState: permissionToEdit,
            send: permissionToEdit,
            receive: permissionToEdit,
            setZkappUri: permissionToEdit,
            setTokenSymbol: permissionToEdit,
            setTiming: Permissions.proofOrSignature()
        });
    }

    /**
     * init
     */
    @method initInfo(supply: UInt64, maximumPurchasingAmount: UInt64, memberShipContractAddress: PublicKey, purchaseStartBlockHeight: UInt32, purchaseEndBlockHeight: UInt32, adminSignature: Signature) {
        const hashx = Poseidon.hash([...supply.toFields(), ...maximumPurchasingAmount.toFields(), ...memberShipContractAddress.toFields(), ...purchaseStartBlockHeight.toFields(), ...purchaseEndBlockHeight.toFields()]);
        adminSignature.verify(this.address, [hashx]).assertTrue();

        this.account.zkappUri.set('https://github.com/coldstar1993/mina-zkapp-e2e-testing');
        this.account.tokenSymbol.set('XTKN');
        this.totalAmountInCirculation.set(new UInt64(0));

        this.SUPPLY.set(supply);
        this.maximumPurchasingAmount.set(maximumPurchasingAmount);
        this.memberShipContractAddress.set(memberShipContractAddress);
        this.purchaseStartBlockHeight.set(purchaseStartBlockHeight);
        this.purchaseEndBlockHeight.set(purchaseEndBlockHeight);
        // initialze states
        this.actionHashVote.set(Reducer.initialActionsHash);
    }

    /**
     * need proof to transfer Mina
     */
    @method transferMina(to: PublicKey, amount: UInt64) {
        const SUPPLY0 = this.SUPPLY.get();
        this.SUPPLY.assertEquals(SUPPLY0);  

        const totalAmountInCirculation0 = this.totalAmountInCirculation.get();
        this.totalAmountInCirculation.assertEquals(totalAmountInCirculation0);

        const purchaseEndBlockHeight0 = this.purchaseEndBlockHeight.get();
        this.purchaseEndBlockHeight.assertEquals(purchaseEndBlockHeight0);

        const blockchainLength0 = this.network.blockchainLength.get();
        this.network.blockchainLength.assertEquals(blockchainLength0);

        // check precondition_network.blockHeight
        blockchainLength0.assertGreaterThan(this.purchaseEndBlockHeight.get(), 'meets precondition_network.blockchainLength');// TODO

        // check if timingLocked Mina
        SUPPLY0.assertEquals(totalAmountInCirculation0);

        // send mina, underlyingly check if current amount is beyond the timing-locking amount.
        this.send({ to, amount });
    }

    @method purchaseToken(purchaser: PublicKey, purchasingAmount: UInt64, witness: MerkleMapWitness) {
        purchasingAmount.assertGreaterThan(UInt64.from(0));

        const SUPPLY0 = this.SUPPLY.get();
        this.SUPPLY.assertEquals(SUPPLY0);
        const totalAmountInCirculation0 = this.totalAmountInCirculation.get();
        this.totalAmountInCirculation.assertEquals(totalAmountInCirculation0);

        const memberShipContractAddress0 =this.memberShipContractAddress.get();
        this.memberShipContractAddress.assertEquals(memberShipContractAddress0);

        const purchaseStartBlockHeight0 = this.purchaseStartBlockHeight.get();
        this.purchaseStartBlockHeight.assertEquals(purchaseStartBlockHeight0);
        const purchaseEndBlockHeight0 = this.purchaseEndBlockHeight.get();
        this.purchaseEndBlockHeight.assertEquals(purchaseEndBlockHeight0);

        const blockchainLength0 = this.network.blockchainLength.get();
        this.network.blockchainLength.assertEquals(blockchainLength0);

        const maximumPurchasingAmount0 = this.maximumPurchasingAmount.get();
        this.maximumPurchasingAmount.assertEquals(maximumPurchasingAmount0);
        
        // check enough
        SUPPLY0.sub(totalAmountInCirculation0).assertGreaterThanOrEqual(purchasingAmount, 'restAmount is enough for purchasingAmount');

        // check maximum purchasing amount
        maximumPurchasingAmount0.assertGreaterThanOrEqual(purchasingAmount, 'purchasingAmount is not beyond MaximumPurchasingAmount');

        // check precondition_network.blockchainLength
        blockchainLength0.assertGreaterThanOrEqual(purchaseStartBlockHeight0);
        blockchainLength0.assertLessThanOrEqual(purchaseEndBlockHeight0);

        // check if members are of non-existence and add a member if non-existent
        const membershipContract = new Membership(memberShipContractAddress0);
        membershipContract.addNewMember(purchaser, witness);

        let minaCost = purchasingAmount.mul(5e9);
        let purchaserAccountUpdate = AccountUpdate.createSigned(purchaser);
        purchaserAccountUpdate.balance.subInPlace(minaCost);
        this.balance.addInPlace(minaCost);

        Circuit.log('to mint...');
        // mint tokens
        this.token.mint({
            address: purchaser,
            amount: purchasingAmount
        });
        this.emitEvent("purchase-tokens", new PurchaseEvent({ purchaser, purchasingAmount }));

        // update totalAmountInCirculation
        const totalAmountInCirculation1 = totalAmountInCirculation0.add(purchasingAmount);
        this.totalAmountInCirculation.set(totalAmountInCirculation1);

        // timing-lock Mina balance if totalAmountInCirculation == SUPPLY
        this.account.balance.assertEquals(this.account.balance.get());
        const initialMinimumBalance0 = Circuit.if(totalAmountInCirculation1.equals(SUPPLY0), this.account.balance.get().div(3).mul(2), UInt64.from(0));
        Circuit.log('initialMinimumBalance0:', initialMinimumBalance0);

        const cliffTime0 = UInt32.from('2');// TODO
        const cliffAmount0 = UInt64.from(initialMinimumBalance0.div(10));
        const vestingPeriod0 = UInt32.from('1');
        const vestingIncrement0 = UInt64.from(initialMinimumBalance0.div(10));
        this.timingLockToken(initialMinimumBalance0, cliffTime0, cliffAmount0, vestingPeriod0, vestingIncrement0);
    }

    /**
     * 
     * @param voter 
     * @param voteOption 
     * @param witness 
     */
    @method voteToProcessRestTokens(voter: PublicKey, voteOption: UInt64, witness: MerkleMapWitness) {
        const totalAmountInCirculation0 = this.totalAmountInCirculation.get();
        this.totalAmountInCirculation.assertEquals(totalAmountInCirculation0);
        const SUPPLY0 = this.SUPPLY.get();
        this.SUPPLY.assertEquals(SUPPLY0);
        const memberShipContractAddress0 =this.memberShipContractAddress.get();
        this.memberShipContractAddress.assertEquals(memberShipContractAddress0);

        // check if SUPPLY > totalAmountInCirculation
        SUPPLY0.assertGreaterThan(totalAmountInCirculation0);

        // check if the member is of token-keeper.
        const membershipContract = new Membership(memberShipContractAddress0);
        membershipContract.checkMemberShip(voter, witness).assertEquals(true);

        // check voteOption is valid
        voteOption.assertGreaterThan(UInt64.from(0));
        voteOption.assertLessThanOrEqual(UInt64.from(3));

        this.reducer.dispatch(new VoteNote({ voter, voteOption }));
    }

    @method rollupVoteNote() {
        const actionHashVote0 = this.actionHashVote.get();
        this.actionHashVote.assertEquals(actionHashVote0);
        const totalAmountInCirculation0 = this.totalAmountInCirculation.get();
        this.totalAmountInCirculation.assertEquals(totalAmountInCirculation0);
        const SUPPLY0 = this.SUPPLY.get();
        this.SUPPLY.assertEquals(SUPPLY0);
        
        const memberShipContractAddress0 =this.memberShipContractAddress.get();
        this.memberShipContractAddress.assertEquals(memberShipContractAddress0);

        const purchaseEndBlockHeight0 = this.purchaseEndBlockHeight.get();
        this.purchaseEndBlockHeight.assertEquals(purchaseEndBlockHeight0);

        const membershipContract = new Membership(memberShipContractAddress0);
        const members = membershipContract.memberCount.get();
        membershipContract.memberCount.assertEquals(members);

        const blockchainLength0 = this.network.blockchainLength.get();
        this.network.blockchainLength.assertEquals(blockchainLength0);

        // check precondition_network.blockHeight
        blockchainLength0.assertGreaterThan(this.purchaseEndBlockHeight.get(), 'meets precondition_network.blockchainLength');

        const pendingActions = this.reducer.getActions({ fromActionHash: this.actionHashVote.get() });
        Circuit.log('pendingActions: ', pendingActions);

        let actionsYCount = UInt32.from(0);
        let actionsFCount = UInt32.from(0);
        let { state: result, actionsHash: newActionHash } = this.reducer.reduce(pendingActions, VoteNote, (state: VoteNote, action: VoteNote) => {
            actionsYCount.add(Circuit.if(action.voteOption.equals(UInt64.from(1)), UInt32.from(1), UInt32.from(0)));
            actionsFCount.add(Circuit.if(action.voteOption.equals(UInt64.from(2)), UInt32.from(1), UInt32.from(0)));
            return state;
        }, { state: VoteNote.createEmptyEntity(), actionsHash: actionHashVote0 });

        // check if voters's number is beyond 51%
        const { quotient, rest } = members.divMod((actionsYCount.add(actionsFCount)))
        quotient.assertEquals(UInt32.from(1));
        rest.assertGreaterThanOrEqual(UInt32.from(1));

        // process 
        // if Y > F, 则burn the rest token, else do nothing.
        const newSupply = Circuit.if(actionsYCount.greaterThan(actionsFCount), totalAmountInCirculation0, SUPPLY0);
        this.SUPPLY.set(newSupply);

        // update actionHash
        this.actionHashVote.set(newActionHash);

        // timing-lock Mina balance
        this.account.balance.assertEquals(this.account.balance.get());
        const initialMinimumBalance0 = this.account.balance.get().div(3).mul(2);
        const cliffTime0 = UInt32.from('2');// TODO
        const cliffAmount0 = UInt64.from(initialMinimumBalance0.div(10));
        const vestingPeriod0 = UInt32.from('1');
        const vestingIncrement0 = UInt64.from(initialMinimumBalance0.div(10));
        this.timingLockToken(initialMinimumBalance0, cliffTime0, cliffAmount0, vestingPeriod0, vestingIncrement0);
    }

    timingLockToken(initialMinimumBalanceX: UInt64, cliffTimeX: UInt32, cliffAmountX: UInt64, vestingPeriodX: UInt32, vestingIncrementX: UInt64) {
        // timing-lock Mina balance
        this.account.timing.set({ initialMinimumBalance: initialMinimumBalanceX, cliffTime: cliffTimeX, cliffAmount: cliffAmountX, vestingPeriod: vestingPeriodX, vestingIncrement: vestingIncrementX });
    }
}