// You might need to adjust these constants based on your implementation
import FilesystemBufferedLogger from '../src/trackers/filesystemBufferedLogger';
import { FunctionExample } from '../src/models/functionExample';
import BloomFilter from '../src/bloomFilter';
import * as fs from 'fs';

const EXPECTED_ITEMS = 100;
const FALSE_POSITIVE_RATE = 0.05;

const logger = new FilesystemBufferedLogger();
const bloomFilterPersistence = logger.getBloomFilterPersistence();
describe('Bloom Filter Tests', () => {
  test('test_add', () => {
    const example = new FunctionExample([0], {});
    const exampleData = JSON.stringify(example) + '\n';
    const nrOfCalls = 10;
    let nrOfErrors = 0;

    for (let i = 0; i < nrOfCalls; i++) {
      const randomString = generateRandomString(30);
      const beforeBitArray = logger.bloomFilter.bitArray.slice();

      logger.logSymbolicPatch(`test_${randomString}`, example);

      const afterBitArray = logger.bloomFilter.bitArray;
      const isSame = arraysEqual(beforeBitArray, afterBitArray);
      const lookedUp = logger.bloomFilter.lookup(
        `test_${randomString}_${exampleData}`
      );

      if (!lookedUp || isSame) {
        nrOfErrors++;
      }
    }

    expect(nrOfErrors / nrOfCalls).toBeLessThanOrEqual(0.2);
  });

  test('test_add_lookup', () => {
    const bf1 = new BloomFilter(
      bloomFilterPersistence,
      EXPECTED_ITEMS,
      FALSE_POSITIVE_RATE
    );
    const example = new FunctionExample([0], {});
    let nrOfErrors = 0;
    const nrOfCalls = 10;

    for (let i = 0; i < nrOfCalls; i++) {
      const randomString = generateRandomString(30);
      const bloomFilterInput = `${randomString}_${JSON.stringify(example)}`;
      bf1.add(bloomFilterInput);
      const lookedUp = bf1.lookup(bloomFilterInput);

      if (!lookedUp) {
        nrOfErrors++;
      }
    }

    expect(nrOfErrors / nrOfCalls).toBeLessThanOrEqual(0.2);
  });

  test('test_multiple_loggers', () => {
    const example = new FunctionExample([0], {});
    const exampleData = JSON.stringify(example) + '\n';
    let nrOfErrors = 0;
    const nrOfCalls = 10;

    for (let i = 0; i < nrOfCalls; i++) {
      const logger1 = new FilesystemBufferedLogger();
      const randomString = generateRandomString(30);
      logger1.logSymbolicPatch(`test_${randomString}`, example);

      const logger2 = new FilesystemBufferedLogger();
      const lookedUp = logger2.bloomFilter.lookup(`test_${randomString}_${exampleData}`);

      if (!lookedUp) {
        nrOfErrors++;
      }
    }

    expect(nrOfErrors / nrOfCalls).toBeLessThanOrEqual(0.2);
  });

  test('test_file_content_consistency', () => {
    const bf1 = new BloomFilter(
      bloomFilterPersistence,
      EXPECTED_ITEMS,
      FALSE_POSITIVE_RATE
    );

    bf1.bitArray[bf1.bitArray.length - 1] = true;
    bf1.save();
    const log_dir = logger.getLogDirectory()

    const filePath = 'bloom_filter_state.bin';
    const fileDir = log_dir;
    // eslint-disable-next-line @typescript-eslint/no-unsafe-call,@typescript-eslint/no-unsafe-member-access
    const savedData = fs.readFileSync(fileDir + '/' + filePath);

    const bf2 = new BloomFilter(
      bloomFilterPersistence,
      EXPECTED_ITEMS,
      FALSE_POSITIVE_RATE
    );
    bf2.load();
    expect(Buffer.from(booleanArrayToByteArray(bf2.bitArray))).toEqual(savedData);
  });


  test('test_bit_array_length', () => {
    const bf1 = new BloomFilter(
      bloomFilterPersistence,
      EXPECTED_ITEMS,
      FALSE_POSITIVE_RATE
    );

    bf1.bitArray[bf1.bitArray.length - 1] = true;
    bf1.save();

    const filePath = 'bloom_filter_state.bin';
    const log_dir = logger.getLogDirectory();
    // eslint-disable-next-line @typescript-eslint/no-unsafe-call,@typescript-eslint/no-unsafe-member-access
    const fileSize = fs.statSync(log_dir + '/' + filePath).size;
    console.log("Size of saved file (in bytes):", fileSize);

    const bf2 = new BloomFilter(
      bloomFilterPersistence,
      EXPECTED_ITEMS,
      FALSE_POSITIVE_RATE
    );
    bf2.load();

    expect(
      booleanArrayToByteArray(bf1.bitArray).length
    ).toBe(
      booleanArrayToByteArray(bf2.bitArray).length
    );
  });


  test('test_bloom_filter_persistence', () => {
    // Creating and populating the first Bloom filter
    const bf1 = new BloomFilter(
      bloomFilterPersistence,
      EXPECTED_ITEMS,
      FALSE_POSITIVE_RATE
    );
    for (let i = 0; i < 10; i++) {
      bf1.add(i.toString());
    }

    // Save the state of bf1
    bf1.save();
    const savedBytes = booleanArrayToByteArray(bf1.bitArray);

    const filePath = 'test.bin';
    // eslint-disable-next-line @typescript-eslint/no-unsafe-call,@typescript-eslint/no-unsafe-member-access
    fs.writeFileSync(filePath, Buffer.from(savedBytes));

    // Manual loading from a file
    // eslint-disable-next-line @typescript-eslint/no-unsafe-call,@typescript-eslint/no-unsafe-member-access
    const manualLoadedBytes = fs.readFileSync(filePath);

    expect(Buffer.from(savedBytes)).toEqual(manualLoadedBytes);

    // Creating and loading the state into the second Bloom filter
    const bf2 = new BloomFilter(
      bloomFilterPersistence,
      EXPECTED_ITEMS,
      FALSE_POSITIVE_RATE
    );
    bf2.load();
    // eslint-disable-next-line @typescript-eslint/no-unsafe-call
    const bf1LoadedBytes = booleanArrayToByteArray(bf1.bitArray);
    const bf2LoadedBytes = booleanArrayToByteArray(bf2.bitArray);

    expect(bf1LoadedBytes).toEqual(bf2LoadedBytes);

    // Checking each bit for equality
    for (let i = 0; i < bf1.bitArray.length; i++) {
      expect(bf1.bitArray[i]).toEqual(bf2.bitArray[i]);
    }

    // Checking if the loaded Bloom filter behaves as expected
    for (let i = 0; i < 10; i++) {
      expect(bf2.lookup(i.toString())).toBeTruthy();
    }
  });
});

function generateRandomString(length: number): string {
  const characters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let result = '';
  for (let i = 0; i < length; i++) {
    result += characters.charAt(Math.floor(Math.random() * characters.length));
  }
  return result;
}

function arraysEqual(a: any[], b: any[]): boolean {
  if (a === b) return true;
  if (a == null || b == null) return false;
  if (a.length !== b.length) return false;

  for (let i = 0; i < a.length; ++i) {
    if (a[i] !== b[i]) return false;
  }
  return true;
}

function booleanArrayToByteArray(bitArray: boolean[]): number[] {
  const byteArray = [];
  for (let i = 0; i < bitArray.length; i += 8) {
    let byte = 0;
    for (let j = 0; j < 8; j++) {
      if (i + j < bitArray.length && bitArray[i + j]) {
        byte |= (1 << j);
      }
    }
    byteArray.push(byte);
  }
  return byteArray;
}