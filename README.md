# Mina zkApp: Myproject

## Desciption
This zkApp is an MVP working for ICO activities, covering features as below:
1) initialize or reset token info, like tokenSupply, tokenSymbol, maximumPurchasingAmount per address, zkappUri,
2) specify which block height the ICO starts & ends,
3) purchase tokens(mint), and record the initial members during ICO,
4) initial members vote to burn extra tokens or not if there are tokens lefts,
5) automatically timing-lock partial MINA and release periodically,
6) initial members vote to set new 'delegate' address,

Within the MVP, there are three key smart contracts and one zkProgram circuit:
	smart contracts: XTokenContract.ts, Membership.ts, VoteDelegateContract.ts 
	zkProgram circuit: vote.ts

to make a demo presentation and convenient test, I choose to use simple test data during Unit Tests
	XTokenContract.ts：
		token SUPPLY: 6,
		totalAmountInCirculation: 0 initially, and increase as purchasing ,
		maximumPurchasingAmount: 2 ,
		purchaseStartBlockHeight: defaultly at when contract deploy,
		purchaseEndBlockHeight: purchaseStartBlockHeight + 5 ,
		actionHashVote: Reducer.initialActionsHash ,

You could set TEST_ON_BERKELEY=true/false to start unit tests.











Reducer.initialActionsHash.toString():  12935064460869035604753254773225484359407575580289870070671311469994328713165

    sender's privateKey:  EKES8JCycxtwX6xpcZrbR88tnL435vUKfLSZNnjbrD911TaXdnPq pubKey:  B62qqj9q9nFXMy2ALbZtTYCX19j4X523rMGhWwrtjZbweq5eSvBRNSv

    sender's privateKey:  EKEde6QgkRQZLKazUAWnv7aNTh4KQgDk7RyMjscPwa96bxbVMN36 pubKey:  B62qom8mTj7UFpByWkP7UNxgeSPZviHbZRGMN5jGyckUY99SFBSLg71

    sender's privateKey:  EKFYsKLtugSjmSTVtPy5MJ5dgYY4x3JVRASEoJpw5hekcFkZtiin pubKey:  B62qkGVrNA1WmPTBuwHEmY7B7dcSb1Ys4eiacqPLCmYurZbe2uFEWoW

    sender's privateKey:  EKEG5erbvMjiFkMbzvfiTeq5JPv9AXuZrJ6cM9ksm6u4QuCrpStF pubKey:  B62qrGHY712Y9Rg5u25D6sF2swgjka7tmhw7fEw5gJrcHdLAkyH6wyw


sender's privateKey:  EKDmWEWjC6UampzAph9ddAbnmuBgHAfiQhAmSVT6ACJgPFzCsoTW  pubKey:  B62qkvenQ4bZ5qt5QJN8bmEq92KskKH4AZP7pgbMoyiMAccWTWjHRoD

sender's privateKey:  EKE4pXwzokMAMos8JLzZgs51zcTccbwBHSoWKJon9paYKC7GqT9a  pubKey:  B62qou6LbyAh2PbestqdQE3PMPL57ct4eQ6hSNT15CpTgTz5YHhy9ad

sender private key: EKEvpZnLn2nMtnpwkfJJ3sLVCKxZFJguBLEhsr4PLrX4Qx7xhgAm    public key: B62qpBXC73946qhNhZLrc4SRqN6AQB4chEL6b5w4uMkZks9Mrz8YphK

sender private key0: EKEYaNo9HxkMpNrjuAYCXug42TJnij36MkEnDsx58TfF3cFNff3n   public key0: B62qk1UHVMMQ28U54vayJuXxLo9wd8vo5vEMNoLuK3haFN8kziKcAiX

senderKey: EKEEBkoXHsUQke7BzjgYXEwVbgP4Eep7Xgb3FNbnodQdiMpTnayQ,  senderAccount: B62qjbaHXVVNYD2GrRUWqveo5BSt9k7p7ySMj7q354L6WqgK5qoMKqQ

sample - XTokenContract's privateKey:  EKEHu59a3GUam6rhuVUaA5wXeunJ1mmxgPVZABCj3ix1hVaXgJZK pubKey:  B62qpnMzvx87c8QFh8wNHVKizwunyoKwHaA44CibxEob9gJZsexPuPr

sample - Membership's privateKey:  EKFRWWuziCMDCoTqzhsaYBeRPDt2tKbPEYwCLgecfsYgUPnaJfji pubKey:  B62qrBB4Fpkv7vpU9QoQX9YTqB99whpE47CSsLqUB4q1xTxnUjxs965

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

## License

[Apache-2.0](LICENSE)
