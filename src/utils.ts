import {
  Field,
  Mina,
  PublicKey,
  fetchAccount,
  Types,
  fetchLastBlock,
  UInt32,
  Reducer,
} from 'snarkyjs';

export async function syncActions(targetAddr: PublicKey, isLocalBlockChain?: boolean) {
  if (!isLocalBlockChain) {
    for (let i = 0; i < 5; i++) {// just for 5 iterations for 5 blocks, enough
      let actionsList;
      try {
        // get the length of actions list, and compare later to confirm the tx is done!
        actionsList = await Mina.fetchActions( targetAddr, {fromActionState: Reducer.initialActionsHash});// will throw error if duplicate actions issue.
      } catch (error) {// exisitng issue: duplicate actions 
        console.log(`error: await fetchActions({ publicKey: ${targetAddr.toBase58()} }): `, JSON.stringify(error));

        console.log(`wait for a block and fetchActions again...`);
        await waitBlockHeightToExceed((await syncNetworkStatus()).blockchainLength.add(1));
      }

      if (!(actionsList instanceof Array)) {
        console.log(`error: await fetchActions({ publicKey: ${targetAddr.toBase58()} }): `, JSON.stringify(actionsList));
        throw new Error('fetchActions failed! Pls try later.');
      }

      return actionsList;
    }
  } else {
    return Mina.activeInstance.getActions(targetAddr);
  }
}

export async function syncNetworkStatus(isLocalBlockChain?: boolean) {
  if (!isLocalBlockChain) {
    await fetchLastBlock();
    console.log('sync Berkeley Network status: done!');
  }
  console.log('current network state: ', JSON.stringify(Mina.activeInstance.getNetworkState()));
  return Mina.activeInstance.getNetworkState();
}

export async function waitBlockHeightToExceed(aHeight: UInt32, isLocalBlockChain?: boolean) {
  if (!isLocalBlockChain) {
    // wait for Berkeley's blockchainLength > aHeight
    while (true) {
      let blockchainLength = (await syncNetworkStatus()).blockchainLength;
      console.log(`aHeight: ${aHeight.toString()}, current blockchainLength: ${blockchainLength.toString()}`);

      if (aHeight.lessThan(blockchainLength).toBoolean()) {
        break;
      }

      let blockGap = Number.parseInt(aHeight.sub(blockchainLength).toString());
      blockGap = blockGap == 0 ? 1 : blockGap;
      await new Promise((resolve) => setTimeout(resolve, blockGap * 3 * 60 * 1000));// about 3 minutes/block
    }
  } else {
    (Mina.activeInstance as any).setBlockchainLength(aHeight.add(1));
    console.log(`aHeight: ${aHeight.toString()}, current blockchainLength: ${Mina.activeInstance.getNetworkState().blockchainLength.toString()}`);
  }
  console.log('current network state: ', JSON.stringify(Mina.activeInstance.getNetworkState()));
}


export async function syncAcctInfo(acctAddr: PublicKey, tokenId?: Field, isLocalBlockChain?: boolean) {
  let acctInfo: Types.Account | undefined;
  if (typeof tokenId == 'undefined') {
    tokenId = Field(1);
  }
  if (isLocalBlockChain) {
    console.log('isLocalBlockChain: ', isLocalBlockChain);
    acctInfo = Mina.activeInstance.getAccount(acctAddr, tokenId);
  } else {
    acctInfo = (await fetchAccount({ publicKey: acctAddr, tokenId })).account!;
  }
  return acctInfo;
}

// ========================================================

export const checkAccountExists = async (address: PublicKey, tokenId?: Field, isLocalBlockChain?: boolean) => {
  let account = await syncAcctInfo(address, tokenId, isLocalBlockChain);
  let accountExists = account != undefined && account != null;
  return { accountExists, account };
}

// ========================================================

export const loopUntilAccountExists = async (
  { address,
    tokenId,
    eachTimeNotExist,
    isZkAppAccount,
    isLocalBlockChain
  }:
    {
      address: PublicKey,
      tokenId?: Field,
      eachTimeNotExist: () => void,
      isZkAppAccount: boolean,
      isLocalBlockChain?: boolean
    }
) => {
  for (; ;) {
    let { accountExists, account } = await checkAccountExists(address, tokenId, isLocalBlockChain);
    console.log(`[checkAccountExists]: ${accountExists}, account: ${JSON.stringify(account)}`);
    if (accountExists && isZkAppAccount) {
      accountExists = accountExists && (account as any)?.zkapp.appState != null;
    }
    if (!accountExists) {
      await eachTimeNotExist();
      await new Promise((resolve) => setTimeout(resolve, 60 * 1000));
    } else {
      // TODO add optional check that verification key is correct once this is available in SnarkyJS
      return account!;
    }
  }
};

// ========================================================

interface ToString {
  toString: () => string;
}

type FetchedAccountResponse = Awaited<ReturnType<typeof fetchAccount>>
type FetchedAccount = NonNullable<FetchedAccountResponse["account"]>

export const makeAndSendTransaction = async <State extends ToString>({
  feePayerPublicKey,
  zkAppAddress,
  tokenId,
  mutateZkApp,
  transactionFee,
  signTx,
  getState,
  statesEqual,
  isLocalBlockChain
}: {
  feePayerPublicKey: PublicKey,
  zkAppAddress: PublicKey,
  tokenId?: Field,
  mutateZkApp: () => void,
  transactionFee: number,
  signTx: (tx: Mina.Transaction) => void,
  getState: () => State,
  statesEqual: (state1: State, state2: State) => boolean,
  isLocalBlockChain?: boolean
}) => {
  // Why this line? It increments internal feePayer account variables, such as
  // nonce, necessary for successfully sending a transaction
  await syncAcctInfo(zkAppAddress, tokenId, isLocalBlockChain);
  const initialState = await getState();

  let transaction = await Mina.transaction(
    { sender: feePayerPublicKey, fee: transactionFee },
    () => {
      mutateZkApp();
    }
  );
  await transaction.prove();
  signTx(transaction);
  console.log('Sending the transaction...');
  const res = await transaction.send();
  const hash = await res.hash(); // This will change in a future version of SnarkyJS
  if (hash == null) {
    throw new Error('error sending transaction');
  } else {
    res.wait({ maxAttempts: 1000 });
    console.log(
      'See transaction at',
      'https://berkeley.minaexplorer.com/transaction/' + hash
    );
  }

  let state = await getState();

  let stateChanged = false;
  while (!stateChanged) {
    console.log(
      'waiting for zkApp state to change... (current state: ',
      state.toString() + ')'
    );
    if (!isLocalBlockChain) {
      await new Promise((resolve) => setTimeout(resolve, 1 * 60 * 1000));
    }
    await syncAcctInfo(zkAppAddress, tokenId, isLocalBlockChain);
    state = await getState();
    stateChanged = !statesEqual(initialState, state);
    console.log('==== stateChanged: ', stateChanged);
  }
};

// ========================================================

export const zkAppNeedsInitialization = async (
  { zkAppAccount }:
    { zkAppAccount: FetchedAccount }
) => {
  console.warn('warning: using a `utils.ts` written before `isProved` made available. Check https://docs.minaprotocol.com/zkapps/tutorials/deploying-to-a-live-network for updates');
  // TODO when available in the future, use isProved.
  const allZeros = (zkAppAccount as any).appState!.every((f: Field) =>
    f.equals(Field.zero).toBoolean()
  );
  const needsInitialization = allZeros;
  return needsInitialization;
}

// ========================================================
