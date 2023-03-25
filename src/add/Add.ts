import { Field, SmartContract, state, State, method, UInt32, UInt64, Permissions } from 'snarkyjs';

export class Add extends SmartContract {
  @state(Field) num = State<Field>();

  init() {
    super.init();
    this.num.set(Field(1));
    this.account.permissions.set({
      ...Permissions.default(),
      setTiming: Permissions.proofOrSignature()
    });

    console.log('init() within Add...');
  }

  @method update() {
    const currentState = this.num.get();
    this.num.assertEquals(currentState); // precondition that links this.num.get() to the actual on-chain state
    const newState = currentState.add(2);
    this.num.set(newState);

    this.account.timing.set({ 
      initialMinimumBalance: UInt64.from(0), 
      cliffTime: UInt32.from(2), 
      cliffAmount: UInt64.from(1), 
      vestingPeriod: UInt32.from(1), 
      vestingIncrement: UInt64.from(0) 
    });
  }
}
