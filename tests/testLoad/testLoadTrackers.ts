import fs from 'fs';
import path from 'path';
import os from 'os';
import FilesystemBufferedLogger from "../../lib/trackers/filesystemBufferedLogger";
import { FunctionExample } from "../../lib/models/functionExample";

describe('FilesystemBufferedLogger Tests', () => {
  let logDirectory: string;
  let logger: FilesystemBufferedLogger;

  beforeAll(() => {
    logDirectory = fs.mkdtempSync(path.join(os.tmpdir(), 'tanuki-'));
    logger = new FilesystemBufferedLogger(logDirectory);
  });

  afterAll(() => {
    fs.rmdirSync(logDirectory, { recursive: true });
  });

  it('test_patch_one_function_many_times', () => {
    const runs = 100;
    logger.createBloomFilter();

    const startTime = Date.now();
    for (let i = 0; i < runs; i++) {
      const example = new FunctionExample([i],  i * 2);
      const beforeBitArray = logger.bloomFilter.bitArray.slice();

      logger.logSymbolicPatch('test', example);

      const afterBitArray = logger.bloomFilter.bitArray;
      const isSame = beforeBitArray.toString() === afterBitArray.toString();
      expect(isSame).toBe(false);
    }

    logger.saveBloomFilter();
    const elapsedTime = (Date.now() - startTime) / 1000;
    console.log(`Time taken for ${logger.constructor.name} to patch function ${runs} times: ${elapsedTime} seconds`);
    console.log(`Hits: ${logger.hitCount}, Misses: ${logger.missCount}`);
  });

  // Additional tests can be added here
});
