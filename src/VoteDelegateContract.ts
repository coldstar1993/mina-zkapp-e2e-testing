import { Proof, Int64, Experimental, Circuit, MerkleMapWitness, Field, method, Permissions, PrivateKey, PublicKey, Reducer, Signature, SmartContract, state, State, Struct, UInt32, UInt64, CircuitString, Poseidon, Account, AccountUpdate, Bool, VerificationKey, MerkleMap } from "snarkyjs"
import { Membership } from "./Membership.js";
import { VoteProof } from "./vote.js";
import { XTokenContract } from "./XTokenContract.js";

export class VoteDelegateContract extends SmartContract {
    // events
    events = {
        "init-delegate-target": PublicKey,
        "set-delegate-to-XTokenContract": PublicKey,
    }
    @state(PublicKey) xTokenContractAddress = State<PublicKey>();

    @state(PublicKey) memberShipContractAddress = State<PublicKey>();

    @state(Field) voterNullifierTreeRoot = State<Field>();

    @state(PublicKey) targetDelegateTo = State<PublicKey>();

    init() {
        super.init();
        // set account permissions
        this.account.permissions.set({
            ...Permissions.default(),
            editState: Permissions.proofOrSignature(),
        });
    }

    @method initOrReset(xTokenContractAddress: PublicKey, memberShipContractAddress: PublicKey, voterNullifierTreeRoot: Field, newDelegateTarget: PublicKey, adminPriKey: PrivateKey) {
        // check if admin
        this.address.assertEquals(adminPriKey.toPublicKey());

        this.xTokenContractAddress.set(xTokenContractAddress);
        this.memberShipContractAddress.set(memberShipContractAddress);
        this.voterNullifierTreeRoot.set(voterNullifierTreeRoot);
        this.targetDelegateTo.set(newDelegateTarget);

        this.emitEvent("init-delegate-target", newDelegateTarget);
    }

    @method voteDelegateTo(xTokenContractAdminPriKey: PrivateKey, proof: VoteProof) {
        proof.verify();
        const voteState = proof.publicInput;
        // voteFor should be greater than voteAgainst
        voteState.voteFor.assertGreaterThan(voteState.voteAgainst);

        const memberShipContractAddress0 = this.memberShipContractAddress.get();
        this.memberShipContractAddress.assertEquals(memberShipContractAddress0);

        const xTokenContractAddress0 = this.xTokenContractAddress.get();
        this.xTokenContractAddress.assertEquals(xTokenContractAddress0);

        const membershipContract = new Membership(memberShipContractAddress0);
        const memberTreeRoot0 = membershipContract.memberTreeRoot.get();
        membershipContract.memberTreeRoot.assertEquals(memberTreeRoot0);
        const memberCount0 = membershipContract.memberCount.get();
        membershipContract.memberCount.assertEquals(memberCount0);

        // voters' number should meet all members' count 
        memberTreeRoot0.assertEquals(proof.publicInput.tokenMemberTreeRoot);
        memberCount0.assertEquals(UInt32.from(voteState.voteFor.add(voteState.voteAgainst)));

        // invoke xTokenContract to set delegate target
        const targetDelegateTo0 = this.targetDelegateTo.get();
        this.targetDelegateTo.assertEquals(targetDelegateTo0);
        const xTokenContract = new XTokenContract(xTokenContractAddress0);
        xTokenContract.delegateTo(targetDelegateTo0, xTokenContractAdminPriKey);

        // update voterNullifierTreeRoot
        this.voterNullifierTreeRoot.assertEquals(this.voterNullifierTreeRoot.get());
        this.voterNullifierTreeRoot.set(voteState.nullifierMapRoot);

        this.emitEvent("set-delegate-to-XTokenContract", targetDelegateTo0);

    }
}