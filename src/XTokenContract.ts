import { Field, method, PrivateKey, PublicKey, Reducer, SmartContract, state, State, Struct, UInt32, UInt64 } from "snarkyjs"
import { MembershipWitness, Membership } from "./Membership";

class Purchase extends Struct({ pub: PublicKey, value: UInt64 }) {
    static createEmptyEntity() {
        return new Purchase({ pub: PrivateKey.random().toPublicKey(), value: UInt64.zero });
    }
}

export class XTokenContract extends SmartContract {
    // events
    events = {
        "puchase-tokens": Purchase
    }
    // reducer
    reducer = Reducer({ actionType: Purchase })

    @state(UInt64) SUPPLY = State<UInt64>();
    @state(UInt64) MaximumPurchasingAmount = State<UInt64>();

    @state(UInt64) restAmount = State<UInt64>();
    @state(Field) actionHash = State<Field>();

    init() {
        super.init();
        this.SUPPLY.set(new UInt64(6));
        this.restAmount.set(new UInt64(6));
        this.actionHash.set(Reducer.initialActionsHash);
        // TODO set account permissions
    }

    @method purchaseToken(purchaser: PublicKey, purchasingAmount: UInt64, witness: MembershipWitness) {
        purchasingAmount.assertGreaterThan(UInt64.from(0));

        const restAmount1 = this.restAmount.get();
        this.restAmount.assertEquals(restAmount1);
        // check enough
        restAmount1.assertGreaterThanOrEqual(purchasingAmount, 'restAmount is enough for purchasingAmount');

        // check maximum purchasing amount
        this.MaximumPurchasingAmount.get().assertGreaterThanOrEqual(purchasingAmount, 'purchasingAmount is not beyond MaximumPurchasingAmount');

        // check precondition_network.blockchainLength
        this.network.blockchainLength.assertBetween(UInt32.from(1110), UInt32.from(1111)); // TODO

        // check if members are of non-existence 
        const membershipContract = new Membership(PublicKey.fromBase58(''));//TODO
        membershipContract.addNewMember(purchaser, witness);

        // add actions
        this.reducer.dispatch(new Purchase({ pub: purchaser, value: purchasingAmount }));

        // update restAmount
        this.restAmount.set(restAmount1.sub(purchasingAmount));
    }

    @method distributeToken() {
        const actionHash0 = this.actionHash.get();
        this.actionHash.assertEquals(actionHash0);

        // check precondition_network.blockchainLength
        this.network.blockchainLength.get().assertGreaterThan(UInt32.from(''), 'meets precondition_network.blockchainLength');// TODO
        const pendingActions = this.reducer.getActions({ fromActionHash: this.actionHash.get() });

        let { state: result, actionsHash: newActionHash } = this.reducer.reduce(pendingActions, Purchase, (state: Purchase, action: Purchase) => {
            this.token.mint({
                address: action.pub,
                amount: action.value
            });
            return state;
        }, { state: Purchase.createEmptyEntity(), actionsHash: actionHash0 });

        // update actionHash
        this.actionHash.set(newActionHash);
    }
}