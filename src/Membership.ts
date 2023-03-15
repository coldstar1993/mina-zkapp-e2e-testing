import { Bool, Field, MerkleWitness, method, PublicKey, SmartContract, State, state, Struct, UInt32 } from "snarkyjs";

export class MembershipWitness extends MerkleWitness(6) { }

export class Membership extends SmartContract {
    // member tree root
    @state(Field) memberTreeRoot = State<Field>();

    // events
    events = {
        "add-a-new-member": PublicKey
    }

    @method addNewMember(pub: PublicKey, witness: MembershipWitness) {
        // check non-existence

        // update root
    }

    @method checkMemberShip(pub: PublicKey, witness: MembershipWitness): Bool {
        return Bool(true);
    }
}
