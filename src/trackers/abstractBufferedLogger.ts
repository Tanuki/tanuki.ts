import * as fs from 'fs';
import BloomFilter from '../bloomFilter';
import IBloomFilterPersistence from '../persistence/iBloomFilterPersistence';
import { FunctionExample } from '../models/functionExample';
import { IDatasetWorker } from './IDatasetWorker';
import { FunctionConfig } from '../models/functionConfig';
import {
  ALIGN_FILE_EXTENSION,
  DEFAULT_DISTILLED_MODEL_NAME,
  DEFAULT_TEACHER_MODELS,
  EXPECTED_ITEMS,
  FALSE_POSITIVE_RATE,
  NEGATIVE_FILE_EXTENSION,
  PATCH_FILE_EXTENSION,
  POSITIVE_FILE_EXTENSION,
  DEFAULT_STUDENT_MODELS,
} from '../constants';
import { ModelConfigFactory } from '../languageModels/llmConfigs/modelConfigFactory';
abstract class AbstractBufferedLogger implements IDatasetWorker {
  private buffers: Record<string, Buffer>;
  missCount: number;
  hitCount: number;
  private flushLimit: Record<string, number>;
  private bufferRollingSize: Record<string, number>;
  private writeCount: number;
  private writeLimit: number;
  bloomFilter!: BloomFilter;

  // Default configuration for FunctionConfig
  defaultFunctionConfig: FunctionConfig = {
    distilledModel: DEFAULT_STUDENT_MODELS[DEFAULT_DISTILLED_MODEL_NAME],
    currentModelStats: { trainedOnDatapoints: 0, runningFaults: [] },
    lastTrainingRun: { jobId: '', trainedOnDatapoints: 0, lastChecked: '' },
    currentTrainingRun: { jobId: '', trainedOnDatapoints: 0, lastChecked: '' },
    teacherModels: Object.values(DEFAULT_TEACHER_MODELS),
    nrOfTrainingRuns: 0,
  };

  constructor() {
    this.buffers = {};
    this.missCount = 0;
    this.hitCount = 0;
    this.flushLimit = {};
    this.bufferRollingSize = {};
    this.writeCount = 0;
    this.writeLimit = 1000; // Save the Bloom filter every 1000 writes
  }

  abstract loadDataset(
    datasetType: string,
    funcHash: string,
    returnType: 'length' | 'dataset' | 'both'
  ): number | string | [number, string | null] | null;
  abstract getBloomFilterPersistence(): IBloomFilterPersistence;
  abstract loadExistingDatasets(): Record<string, Record<string, any>>;
  abstract ensurePersistenceLocationExists(): void;
  abstract getPatchLocationForFunction(
    funcHash: string,
    extension: string
  ): string;
  abstract write(
    path: string,
    data: Buffer | string,
    mode: 'w' | 'a' | 'a+b' | 'a+'
  ): void;
  abstract read(path: string): string;
  abstract getHashFromPath(path: string): string;
  abstract doesObjectExist(path: string): boolean;

  createBloomFilter(): BloomFilter {
    const bloomFilterPersistence = this.getBloomFilterPersistence();
    return new BloomFilter(
      bloomFilterPersistence,
      EXPECTED_ITEMS,
      FALSE_POSITIVE_RATE
    );
  }

  public loadBloomFilter(): void {
    try {
      this.bloomFilter.load(); // Assuming 'load' method exists on BloomFilter
    } catch (error) {
      // @ts-ignore
      if (error.code == 'ENOENT') {
        // 'ENOENT' is typically the error code for a missing file in Node.js
        this.debug('No Bloom filter found. Creating a new one.');
      } else {
        // Re-throw the error if it's not a file not found error
        throw error;
      }
      //{
      //   "errno": -2,
      //   "code": "ENOENT",
      //   "syscall": "open",
      //   "path": "/var/folders/k4/30j4ydp16q1dh2yn06yjv13w0000gn/T/tanuki-Ggct7B/bloom_filter_state.bin"
      // }
    }
  }

  public writeSymbolicAlignCall(funcHash: string, example: any): boolean {
    const logFilePath = this.getPatchLocationForFunction(
      funcHash,
      ALIGN_FILE_EXTENSION
    );
    try {
      const dumpableObject = JSON.stringify(example);
      this.write(logFilePath, dumpableObject + '\n', 'a');
      return true;
    } catch (error) {
      // Log the error or handle it as necessary
      return false;
    }
  }

  public writeEmbeddableAlignCall(
    funcHash: string,
    example: any,
    positive = true
  ): boolean {
    const extension = positive
      ? POSITIVE_FILE_EXTENSION
      : NEGATIVE_FILE_EXTENSION;
    const logFilePath = this.getPatchLocationForFunction(funcHash, extension);

    try {
      const dumpableObject = JSON.stringify(example);
      this.write(logFilePath, dumpableObject + '\n', 'a');
      return true;
    } catch (error) {
      // Log the error or handle it as necessary
      return false;
    }
  }

  public logEmbeddableAlign(
    funcHash: string,
    example: FunctionExample,
    positive = true
  ): [boolean, boolean] {
    let successfullySaved = false;
    let newDatapoint = false;

    try {
      this.ensurePersistenceLocationExists();
    } catch (error) {
      // Log the error or handle it as necessary
      return [successfullySaved, newDatapoint];
    }

    // Prepend the function hash to the example
    const bloomFilterRepresentation = `${funcHash}_${JSON.stringify(
      example
    )}\n`;

    // Check Bloom Filter
    if (this.bloomFilter.lookup(bloomFilterRepresentation)) {
      return [successfullySaved, newDatapoint];
    }

    newDatapoint = true;

    // Add to bloom filter
    this.bloomFilter.add(bloomFilterRepresentation);
    this.saveBloomFilter();

    successfullySaved = this.writeEmbeddableAlignCall(
      funcHash,
      example,
      positive
    );
    return [successfullySaved, newDatapoint];
  }

  public logSymbolicAlign(
    funcHash: string,
    example: FunctionExample
    //...args: any[]
  ): [boolean, boolean] {
    let successfullySaved = false;
    let newDatapoint = false;

    try {
      this.ensurePersistenceLocationExists();
    } catch (error) {
      // Log the error or handle it as necessary
      return [successfullySaved, newDatapoint];
    }

    // Prepend the function hash to the example
    const bloomFilterRepresentation = `${funcHash}_${JSON.stringify(
      example
    )}\n`;

    // Check Bloom Filter
    if (this.bloomFilter.lookup(bloomFilterRepresentation)) {
      return [successfullySaved, newDatapoint];
    }

    newDatapoint = true;

    // Add to bloom filter
    this.bloomFilter.add(bloomFilterRepresentation);
    this.saveBloomFilter();

    successfullySaved = this.writeSymbolicAlignCall(funcHash, example);
    return [successfullySaved, newDatapoint];
  }

  public logSymbolicPatch(
    funcHash: string,
    example: any
  ): Record<string, number> {
    const exampleData = Buffer.from(JSON.stringify(example) + '\n', 'utf-8');

    const bloomFilterRepresentation = `${funcHash}_${exampleData.toString()}`;

    // Check Bloom Filter
    if (this.bloomFilter.lookup(bloomFilterRepresentation)) {
      this.hitCount++;
      return {};
    }

    this.missCount++;

    // Add to Bloom Filter
    this.bloomFilter.add(bloomFilterRepresentation);

    try {
      this.ensurePersistenceLocationExists();
    } catch (error) {
      return {};
    }

    const logFilePath = this.getPatchLocationForFunction(
      funcHash,
      PATCH_FILE_EXTENSION
    );

    if (!this.buffers[logFilePath]) {
      this.buffers[logFilePath] = Buffer.alloc(0);
    }

    if (this.flushLimit[logFilePath] === undefined) {
      this.flushLimit[logFilePath] = 1;
    }

    this.buffers[logFilePath] = Buffer.concat([
      this.buffers[logFilePath],
      exampleData,
    ]);

    this.writeCount++;
    this.bufferRollingSize[logFilePath] =
      (this.bufferRollingSize[logFilePath] || 0) + 1;

    if (this.writeCount >= this.writeLimit) {
      const writtenDatapoints = this.flush();
      this.saveBloomFilter();
      this.writeCount = 0; // Reset counter
      return writtenDatapoints;
    }

    if (
      this.buffers[logFilePath].length >=
      Math.min(this.flushLimit[logFilePath], 4096)
    ) {
      const writtenDatapoints: Record<string, number> = {};
      try {
        this.write(logFilePath, this.buffers[logFilePath], 'a+');
        writtenDatapoints[funcHash] = this.bufferRollingSize[logFilePath];
        this.buffers[logFilePath] = Buffer.alloc(0);
        this.bufferRollingSize[logFilePath] = 0;
        this.flushLimit[logFilePath] *= 2;
        this.saveBloomFilter();
      } catch (error) {
        // Handle error
      }
      return writtenDatapoints;
    }
    return {};
  }

  public saveBloomFilter(): void {
    try {
      this.bloomFilter.save(); // Assuming 'save' method exists on BloomFilter
    } catch (error) {
      if (error instanceof Error) {
        this.warning(`Could not save Bloom filter: ${error.message}`);
      } else {
        this.warning('Could not save Bloom filter due to an unknown error.');
      }
    }
  }

  public flush(): Record<string, number> {
    const writtenDatapoints: Record<string, number> = {};

    for (const logFilePath in this.buffers) {
      const buffer = this.buffers[logFilePath];
      if (buffer && buffer.length > 0) {
        try {
          this.write(logFilePath, buffer, 'a+');
          writtenDatapoints[this.getHashFromPath(logFilePath)] =
            this.bufferRollingSize[logFilePath] || 0;
          this.bufferRollingSize[logFilePath] = 0;
          this.buffers[logFilePath] = Buffer.alloc(0); // Clear the buffer
        } catch (error) {
          // Handle the error or log it as necessary
        }
      }
    }

    return writtenDatapoints;
  }

  public loadFunctionConfig(funcHash: string): [FunctionConfig, boolean] {
    let defaultUsed = false;
    let functionConfig: FunctionConfig;

    try {
      this.ensurePersistenceLocationExists();
      const logFilePath = this.getPatchLocationForFunction(funcHash, '');
      const configPath = `${logFilePath}.json`;

      if (!this.doesObjectExist(configPath)) {
        functionConfig = this.defaultFunctionConfig;
        defaultUsed = true;
        functionConfig.teacherModels = [];
        this.writeJson(configPath, functionConfig);
      } else {
        functionConfig = ModelConfigFactory.loadFunctionConfigFromDict(
          this.readJson(configPath)
        );
      }
    } catch (error) {
      functionConfig = this.defaultFunctionConfig;
      defaultUsed = true;
    }

    return [functionConfig, defaultUsed];
  }

  public updateFunctionConfig(
    funcHash: string,
    configToBeSaved: Record<string, any>
  ): void {
    const logFilePath = this.getPatchLocationForFunction(funcHash, '');
    const configPath = `${logFilePath}.json`;

    try {
      this.writeJson(configPath, configToBeSaved);
    } catch (error) {
      console.error('Error saving function config:', error);
    }
  }

  public writeJson(path: string, data: Record<string, any>): void {
    try {
      const jsonData = JSON.stringify(data, null, 2);
      fs.writeFileSync(path, jsonData, { encoding: 'utf-8' });
    } catch (error) {
      // Handle or log the error as needed
      // e.g., console.error("Error writing JSON:", error);
    }
  }

  public readJson(path: string): Record<string, any> {
    try {
      const jsonData = fs.readFileSync(path, { encoding: 'utf-8' });
      return JSON.parse(jsonData) as Record<string, any>;
    } catch (error) {
      // Handle or log the error as needed
      console.error('Error reading JSON:', error);
      return {}; // Return an empty object or handle it differently based on your requirements
    }
  }
  private warning(message: string): void {
    console.warn(message); // Or use a more sophisticated logging mechanism
  }

  /*
  TODO: Replace this with a more sophisticated implementation
 */
  private debug(message: string): void {
    console.debug(message); // Or use a more sophisticated logging mechanism
  }
}

export default AbstractBufferedLogger;
