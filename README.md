# Mina E2E zkApp: ICO-Token Demo

## Desciption

This zkApp is an demo working for ICO activities, covering features as below:
1. initialize or reset token info, like tokenSupply, tokenSymbol, maximumPurchasingAmount per address, zkappUri,

2. specify which block height the ICO starts & ends,

3. purchase tokens(by mint), and record the initial members during ICO,

4. initial members vote to burn extra tokens or not if there are tokens lefts,

5. automatically timing-lock partial MINA and release them periodically,

6. transfer custom tokens by proof auth & by holders' signature, burn custom tokens by holders' signature,

7. initial members vote to set new 'delegate' address,


Within the MVP, there are three key smart contracts and one zkProgram circuit:

- smart contracts: `XTokenContract.ts, Membership.ts, VoteDelegateContract.ts, ConsumerContract.ts`

- zkProgram circuit: `vote.ts`

to make a demo presentation and convenient test, I choose to use simple test data during Unit Tests
token info inside `XTokenContract.ts`：

```
		token SUPPLY: 6,
		totalAmountInCirculation: 0 initially, and increase as purchasing ,
		maximumPurchasingAmount: 2 ,
		purchaseStartBlockHeight: defaultly at when contract deploy,
		purchaseEndBlockHeight: purchaseStartBlockHeight + `icoBlocksRangeWindow` ,
		actionHashVote: Reducer.initialActionsHash ,
```

**NOTE: due to the dynamic traffic status of Berkeley Network, `icoBlocksRangeWindow` need to be adjusted to be bigger properly. Otherwise, when at heavy traffic status, pending transactions upon purchasing token might fail later because of exceeding `purchaseEndBlockHeight`, thus the test case would fail!**

**NOTE：both 'dynamic traffic status of Berkeley Network' and `purchaseEndBlockHeight` impact the time cost of test cases!!**

## Verification Keys

* [XTokenContract_verification_key.json](./src/XTokenContract_verification_key.json)
* [Membership_verification_key.json](./src/Membership_verification_key.json)
* [ConsumerContract_verification_key.json](./src/ConsumerContract_verification_key.json)
* [VoteDelegateContract_verification_key.json](./src/VoteDelegateContract_verification_key.json)

## Surface Areas
Features and corresonding Surface Areas:

1) initialize or reset token info, like tokenSupply, tokenSymbol, maximumPurchasingAmount per address, zkappUri,
	* 7Permissions
	  * URI
	  * Set Token Symbol

2) specify which block height the ICO starts & ends,

	* 6Pre-conditions (network)

3) purchase tokens(mint), and record the initial members during ICO,
	* 2Call stack composability
	* 4Events
	* 7Permissions
	  * Set Timing
	* 9Tokens

4) initial members vote to burn extra tokens or not if there are tokens lefts,
	* 3Actions

5) automatically timing-lock partial MINA and release periodically,
	* 5Preconditions (account)
	* 7Permissions
		* Set Timing

6) transfer custom tokens by proof auth & by signature, burn custom tokens by signature,
	* 2Call stack composability
	* 9Tokens

7) initial members vote to set new 'delegate' address,
	* 1Recursion
	* 2Call stack composability
	* 7Permissions
		* Set Delegate

8) deploy all contracts
	* 8Deploy Smart Contract

## Unit Test
**NOTE：both 'dynamic traffic status of Berkeley Network' and `purchaseEndBlockHeight` impact the time cost of test cases!!**

Totally, Run these Unit Tests in sequence will cost 40mins almost locally, and 60mins almost On Berkeley.

* Membership.test.ts【**!!NOTE: cost almost 10mins Locally, 20 mins on Berkeley & 4G memory resource**】
  	* CHECK tx should fail when store an existing user
	* CHECK tx should succeed when store an non-existing user

* XTokenContract.test.ts【**!!NOTE: cost almost 20mins Locally, at least 120 mins on Berkeley & 8G memory resource**】
  	* CHECK tx should succeed when purchase tokens by an non-existing user, but should fail when purchase by an existing user
  	* CHECK tx should fail when purchase tokens with EXCEEDING precondition.network.blockchainLength
  	* CHECK tx should fail when purchase tokens when EXCEEDING maximum purchasing amount
  	* CHECK tx should fail when purchase tokens when (totalAmountInCirculation + purchasingAmount) > SUPPLY
  	* CHECK if (timing-lock Mina balance when totalAmountInCirculation == SUPPLY) AND (Mina of 'cliffAmount' cannot be transferred before 'cliffTime')
  	* CHECK if one can ONLY vote for ONE time To Process Rest Tokens AND rollup VoteNotes by reducing Actions	
  	* CHECK transfer custom tokens with proof authorization
	* CHECK transfer custom tokens with holders' signature
	* CHECK burn custom tokens by holders' signature
	* CHECK 'setDelegate' with Permission.proof cannot be set with Signature authorization

* VoteDelegateContract.test.ts【**!!NOTE: cost almost 30mins Locally, at least 50 mins on Berkeley & 8G memory resource**】
  	* CHECK all members (recursively) votes to set delegate

* ConsumerContract.test.ts【**!!NOTE: cost almost 10mins Locally,  at least 20 mins on Berkeley & 4G memory resource**】
    * Check thirdpart zkapp could successfully transfer custom token by holders' signature from XTokenContract.

**NOTE**: 
* You could set `cross-env TEST_ON_BERKELEY=true/false` to start unit tests.
* For the memory resource cost of UT, pls set `--max-old-space-size=8192` for Node Runtime.
* For the time cost of UT, pls set `testTimeout: 10000 * 1000` inside `jest.config.js` to extend jest time limitation.

The config above is set in `script` section inside `package.json`, so you could just run `npm run test`.

## How to build

```sh
npm run build
```

## How to run tests

```sh
npm run test
npm run testw # watch mode
```

## How to run coverage

```sh
npm run coverage
```

## How to deploy
tips: You could see the sequences inside the test cases.

* firstly, deploy `Membership` and later trigger a tx to init it as below:
	```
				membershipZkApp.initOrReset(new MerkleMap().getRoot(), UInt32.from(0), membershipZkAppPrivateKey);
	```
* secondly, deploy `XTokenContract` and later trigger a tx to init it with Membership account and some other parameters as below:.
	```
		        xTokenContract.initOrReset(
                    tokenSupply,
                    maximumPurchasingAmount,
                    membershipZkAppAddress,
                    purchaseStartBlockHeight,
                    purchaseEndBlockHeight,
                    zkAppPrivateKey
                );
	```
* thirdly, deploy `VoteDelegateContract` and later trigger a tx to init it with Membership & XTokenContract accounts and some other parameters as below:.
	```
		        voteDelegateContract.initOrReset(zkAppAddress, membershipZkAppAddress, new MerkleMap().getRoot(), newDelegateTargetAddress, voteDelegateContractPrivateKey);
	```
* forthly, deploy `ConsumerContract` and later trigger a tx to init it with Membership account and some other parameters as below:.
	```
				consumerContract.initOrReset(zkAppAddress, UInt64.from(1), consumerContractPrivateKey);
	```

## License

[Apache-2.0](LICENSE)
