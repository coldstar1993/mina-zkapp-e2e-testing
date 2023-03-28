# Mina zkApp: ICO-Token Demo

## Desciption
This zkApp is an demo working for ICO activities, covering features as below:
1) initialize or reset token info, like tokenSupply, tokenSymbol, maximumPurchasingAmount per address, zkappUri,

2) specify which block height the ICO starts & ends,

3) purchase tokens(mint), and record the initial members during ICO,

4) initial members vote to burn extra tokens or not if there are tokens lefts,

5) automatically timing-lock partial MINA and release periodically,

6) initial members vote to set new 'delegate' address,


Within the MVP, there are three key smart contracts and one zkProgram circuit:

​	smart contracts: `XTokenContract.ts, Membership.ts, VoteDelegateContract.ts` 

​	zkProgram circuit: `vote.ts`

to make a demo presentation and convenient test, I choose to use simple test data during Unit Tests
	token info inside `XTokenContract.ts`：

```
		token SUPPLY: 6,
		totalAmountInCirculation: 0 initially, and increase as purchasing ,
		maximumPurchasingAmount: 2 ,
		purchaseStartBlockHeight: defaultly at when contract deploy,
		purchaseEndBlockHeight: purchaseStartBlockHeight + 5 ,
		actionHashVote: Reducer.initialActionsHash ,
```

You could set `TEST_ON_BERKELEY=true/false` to start unit tests.

## Surface Areas
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
  - Set Timing
* 9Tokens

4) initial members vote to burn extra tokens or not if there are tokens lefts,

* 3Actions

5) automatically timing-lock partial MINA and release periodically,

	* 5Preconditions (account)

* 7Permissions
     * Set Timing

6) initial members vote to set new 'delegate' address,

* 1Recursion

* 7.Permissions
  * Set Delegate


## Unit Test
* XTokenContract.test.ts
  	* CHECK tx should succeed when purchase tokens by an non-existing user, but should fail when purchase by an existing user
  	* CHECK tx should fail when purchase tokens with EXCEEDING precondition.network.blockchainLength
  	* CHECK tx should fail when purchase tokens when EXCEEDING maximum purchasing amount
  	* CHECK tx should fail when purchase tokens when (totalAmountInCirculation + purchasingAmount) > SUPPLY
  	* CHECK if (timing-lock Mina balance when totalAmountInCirculation == SUPPLY) AND (Mina of 'cliffAmount' cannot be transferred before 'cliffTime')
  	* CHECK if one can ONLY vote for ONE time To Process Rest Tokens 
  	* CHECK if one can ONLY vote for ONE time To Process Rest Tokens AND rollup VoteNotes by reducing Actions	
  	* CHECK transfer custom tokens with proof authorization

* VoteDelegateContract.test.ts
  	* CHECK all members (recursively) votes to set delegate

* Membership.test.ts
  	* CHECK tx should fail when store an existing user
	* CHECK tx should succeed when store an non-existing user

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



## License

[Apache-2.0](LICENSE)
