import {
  Field,
  Mina,
  PrivateKey,
  PublicKey,
  fetchAccount,
  Types,
} from 'snarkyjs';

async function syncAcctInfo(acctAddr: PublicKey, isLocalBlockChain?: boolean) {
  let acctInfo: Types.Account | undefined;
  if (isLocalBlockChain) {
    console.log('isLocalBlockChain: ', isLocalBlockChain);
    acctInfo = Mina.activeInstance.getAccount(acctAddr);
  } else {
    acctInfo = (await fetchAccount({ publicKey: acctAddr })).account!;
  }
  return acctInfo;
}

// ========================================================

export const checkAccountExists = async (address: PublicKey, isLocalBlockChain?: boolean) => {
  let account = await syncAcctInfo(address, isLocalBlockChain);
  let accountExists = account != undefined && account != null;
  return { accountExists, account };
}

// ========================================================

export const loopUntilAccountExists = async (
  { address,
    eachTimeNotExist,
    isZkAppAccount,
    isLocalBlockChain
  }:
    {
      address: PublicKey,
      eachTimeNotExist: () => void,
      isZkAppAccount: boolean,
      isLocalBlockChain?: boolean
    }
) => {
  for (; ;) {
    let { accountExists, account } = await checkAccountExists(address, isLocalBlockChain);
    console.log(`[checkAccountExists]: ${accountExists}, account: ${JSON.stringify(account)}`);
    if (accountExists && isZkAppAccount) {
      accountExists = accountExists && (account as any)?.zkapp.appState != null;
    }
    if (!accountExists) {
      await eachTimeNotExist();
      await new Promise((resolve) => setTimeout(resolve, 30 * 1000));
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
  mutateZkApp,
  transactionFee,
  signTx,
  getState,
  statesEqual,
  isLocalBlockChain
}: {
  feePayerPublicKey: PublicKey,
  zkAppAddress: PublicKey,
  mutateZkApp: () => void,
  transactionFee: number,
  signTx: (tx: Mina.Transaction) => void,
  getState: () => State,
  statesEqual: (state1: State, state2: State) => boolean,
  isLocalBlockChain?: boolean
}) => {
  // Why this line? It increments internal feePayer account variables, such as
  // nonce, necessary for successfully sending a transaction
  await syncAcctInfo(zkAppAddress, isLocalBlockChain);
  const initialState = getState();

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

  let state = getState();

  let stateChanged = false;
  while (!stateChanged) {
    console.log(
      'waiting for zkApp state to change... (current state: ',
      state.toString() + ')'
    );
    await new Promise((resolve) => setTimeout(resolve, 1 * 60 * 1000));
    await syncAcctInfo(zkAppAddress, isLocalBlockChain);
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
