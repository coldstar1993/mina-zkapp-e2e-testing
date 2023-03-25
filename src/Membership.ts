import { Bool, Field, MerkleMapWitness, method, PublicKey, SmartContract, State, state, Permissions, UInt32, MerkleMap, Poseidon, Circuit, CircuitString, PrivateKey } from "snarkyjs";

export class Membership extends SmartContract {
    // member tree root
    @state(Field) memberTreeRoot = State<Field>();

    @state(UInt32) memberCount = State<UInt32>();

    init() {
        super.init();
        // set account permissions
        this.account.permissions.set({
            ...Permissions.default(),
            editState: Permissions.proof(),
            send: Permissions.proofOrSignature()
        });

        this.memberTreeRoot.set(new MerkleMap().getRoot());
        this.memberCount.set(UInt32.from(0));
    }

    // events
    events = {
        "add-a-new-member": PublicKey
    }

    @method initOrReset(memberTreeRoot: Field, memberCount: UInt32, admin: PrivateKey) {
        // check if admin
        this.address.assertEquals(admin.toPublicKey());

        this.memberTreeRoot.assertNothing();// no need assertEquals
        this.memberCount.assertNothing();// no need assertEquals

        this.memberTreeRoot.set(memberTreeRoot);
        this.memberCount.set(memberCount);
    }

    @method addNewMember(member: PublicKey, witness: MerkleMapWitness) {
        const memberCount0 = this.memberCount.get();
        this.memberCount.assertNothing();// no need assertEquals

        // check non-existence
        const checkRs = this.checkMemberShip(member, witness);
        checkRs.assertFalse();
        Circuit.log('check non-existence', checkRs);

        // update root
        let [newMemberTreeRoot, _] = witness.computeRootAndKey(Field(1));
        this.memberTreeRoot.set(newMemberTreeRoot);
        // add one to memberCount
        this.memberCount.set(memberCount0.add(1));
    }

    checkMemberShip(pub: PublicKey, witness: MerkleMapWitness): Bool {
        const memberTreeRoot0 = this.memberTreeRoot.get();
        this.memberTreeRoot.assertEquals(memberTreeRoot0);

        let [root1, pubKey1] = witness.computeRootAndKey(Field(1));

        const pubHash = Poseidon.hash(pub.toFields());
        pubHash.assertEquals(pubKey1);// need to assert here!

        return Circuit.if(memberTreeRoot0.equals(root1), Bool(true), Bool(false));
    }

    @method assertMemberShip(pub: PublicKey, witness: MerkleMapWitness) {
        this.checkMemberShip(pub, witness).assertTrue();
    }
}
