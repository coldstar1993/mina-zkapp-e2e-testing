import { Int64, Experimental, Circuit, MerkleMapWitness, Field, method, Permissions, PrivateKey, PublicKey, Reducer, Signature, SmartContract, state, State, Struct, UInt32, UInt64, CircuitString, Poseidon, Account, AccountUpdate, Bool, VerificationKey } from "snarkyjs"
import { syncAcctInfo } from "./utils.js";
import { XTokenContract } from "./XTokenContract.js";

/**
 * a consumer demo to transfer tokens from holders
 */
export class ConsumerContract extends SmartContract {
    @state(PublicKey) xTokenContractAddress = State<PublicKey>();
    @state(UInt64) cost = State<UInt64>();

    init() {
        super.init();
        // set account permissions
        const permissionToEdit = Permissions.proof();
        this.account.permissions.set({
            ...Permissions.default(),
            editState: permissionToEdit,
            send: permissionToEdit,

        });
    }

    @method initOrReset(xTokenContractAddress: PublicKey, cost: UInt64, adminPriKey: PrivateKey) {
        this.address.assertEquals(adminPriKey.toPublicKey());

        this.xTokenContractAddress.set(xTokenContractAddress);
        this.cost.set(cost);
    }

    @method consume(consumerAddr: PublicKey) {
        this.xTokenContractAddress.assertEquals(this.xTokenContractAddress.get());
        this.cost.assertEquals(this.cost.get());

        const xTokenContract = new XTokenContract(this.xTokenContractAddress.get());
        xTokenContract.sendTokens(consumerAddr, this.address, this.cost.get());
    }
}