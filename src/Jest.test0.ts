import { isReady, Mina, shutdown } from 'snarkyjs';
import { Add } from './Add';

describe('foo', () => {
  async function runTests(deployToBerkeley = false) {
    let Blockchain;
    beforeAll(async () => {
      await isReady;
      await Add.compile();

      Blockchain = deployToBerkeley
        ? Mina.LocalBlockchain()
        : Mina.Network('https://proxy.berkeley.minaexplorer.com/graphql');
      Mina.setActiveInstance(Blockchain);
    });

    afterAll(() => {
      setInterval(shutdown, 0);
    });

    it(`1 equals 1 - deployToBerkeley?: ${deployToBerkeley}`, () => {
      expect(1).toEqual(1);
    });

    it(`2 equals 2 - deployToBerkeley?: ${deployToBerkeley}`, () => {
      expect(2).toEqual(2);
    });

    it(`3 not equals 5 - deployToBerkeley?: ${deployToBerkeley}`, () => {
      expect(3).not.toEqual(5);
    });
  }

  runTests(false);
  runTests(true);
});


/*
    ✓ 1 equals 1 - deployToBerkeley?: false (1 ms)
    ✓ 2 equals 2 - deployToBerkeley?: false
    ✓ 3 not equals 5 - deployToBerkeley?: false
    ✓ 1 equals 1 - deployToBerkeley?: true
    ✓ 2 equals 2 - deployToBerkeley?: true
    ✓ 3 not equals 5 - deployToBerkeley?: true (1 ms)
Test Suites: 1 passed, 1 total
Tests:       6 passed, 6 total
Snapshots:   0 total
Time:        21.503 s, estimated 22 s
*/