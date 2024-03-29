import * as fs from 'fs';
//import { existsSync, mkdirSync, readFileSync, writeFileSync, readdirSync } from 'fs';
import { join } from 'path';
import IBloomFilterPersistence from '../persistence/iBloomFilterPersistence';
import BloomFilterFileSystemDriver from '../persistence/bloomFilterFileSystemDriver';
import AbstractBufferedLogger from './abstractBufferedLogger';
import { userDataDir } from '../utils';
import {
  ALIGN_FILE_EXTENSION,
  LIB_NAME,
  NEGATIVE_EMBEDDABLE_ALIGNMENTS,
  NEGATIVE_FILE_EXTENSION,
  PATCH_FILE_EXTENSION,
  PATCHES,
  POSITIVE_EMBEDDABLE_ALIGNMENTS,
  POSITIVE_FILE_EXTENSION,
  SYMBOLIC_ALIGNMENTS,
} from '../constants';
//const path = require('path');
import * as path from 'path';
export class FilesystemBufferedLogger extends AbstractBufferedLogger {
  private logDirectory: string;

  constructor(logDirectory?: string) {
    super();
    this.logDirectory = logDirectory || this.getLogDirectory();

    // These have to be called after the log directory is set, and not in the abstract constructor
    // This differs from the Python implementation, as in Python, super() doesn't have to be called first.
    this.bloomFilter = this.createBloomFilter();
    this.loadBloomFilter();
  }

  getBloomFilterPersistence(): IBloomFilterPersistence {
    return new BloomFilterFileSystemDriver(this.logDirectory);
  }

  getPatchLocationForFunction(funcHash: string, extension = ''): string {
    return join(this.logDirectory, funcHash + extension);
  }

  ensurePersistenceLocationExists(): void {
    if (!fs.existsSync(this.logDirectory)) {
      fs.mkdirSync(this.logDirectory, { recursive: true });
    }
  }

  doesObjectExist(path: string): boolean {
    return fs.existsSync(path);
  }

  public getLogDirectory(): string {
    const filename = 'functions';

    // If explicitly defined
    const envDir = process.env.ENVVAR;
    if (envDir && fs.existsSync(envDir)) {
      return join(envDir, filename);
    }

    // If installed as a library, use the user's data directory
    const libraryDir = join(userDataDir(LIB_NAME), filename);
    if (fs.existsSync(libraryDir) || !fs.existsSync(libraryDir)) {
      return libraryDir;
    }

    // Try to find the git root
    let currentDir = process.cwd();
    while (currentDir !== '/') {
      if (fs.readdirSync(currentDir).includes('.git')) {
        return join(currentDir, filename);
      }
      // eslint-disable-next-line @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
      currentDir = path.dirname(currentDir) || '/';
    }

    return join(process.cwd(), filename);
  }

  loadDataset(
    datasetType: string,
    funcHash: string,
    returnType: 'both' | 'dataset' | 'length'
  ): number | string | [number, string | null] | null {
    const datasetTypeMap: { [key: string]: string } = {
      alignments: ALIGN_FILE_EXTENSION,
      positive: POSITIVE_FILE_EXTENSION,
      negative: NEGATIVE_FILE_EXTENSION,
      patches: PATCH_FILE_EXTENSION,
    };

    const logFilePath = join(
      this.logDirectory,
      funcHash + datasetTypeMap[datasetType]
    );
    if (!fs.existsSync(logFilePath)) {
      if (returnType === 'both') return [0, null];
      if (returnType === 'dataset') return null;
      return 0;
    }

    try {
      const dataset = fs.readFileSync(logFilePath, 'utf-8');
      const datasetLength = dataset.split('\n').length;
      return returnType === 'both'
        ? [datasetLength, dataset]
        : returnType === 'dataset'
        ? dataset
        : datasetLength;
    } catch (e) {
      return returnType === 'both'
        ? [0, null]
        : returnType === 'dataset'
        ? null
        : 0;
    }
  }

  loadExistingDatasets(): Record<string, Record<string, number>> {
    const datasetLengths: Record<string, Record<string, number>> = {};
    datasetLengths[SYMBOLIC_ALIGNMENTS] = {};
    datasetLengths[POSITIVE_EMBEDDABLE_ALIGNMENTS] = {};
    datasetLengths[NEGATIVE_EMBEDDABLE_ALIGNMENTS] = {};
    datasetLengths[PATCHES] = {};

    if (!fs.existsSync(this.logDirectory)) {
      fs.mkdirSync(this.logDirectory, { recursive: true });
    }

    const files = fs
      .readdirSync(this.logDirectory)
      .filter(file => !file.endsWith('.json'));

    for (const file of files) {
      let datasetType = '';
      if (file.includes(ALIGN_FILE_EXTENSION)) {
        datasetType = SYMBOLIC_ALIGNMENTS;
      } else if (file.includes(POSITIVE_FILE_EXTENSION)) {
        datasetType = POSITIVE_EMBEDDABLE_ALIGNMENTS;
      } else if (file.includes(NEGATIVE_FILE_EXTENSION)) {
        datasetType = NEGATIVE_EMBEDDABLE_ALIGNMENTS;
      } else if (file.includes(PATCH_FILE_EXTENSION)) {
        datasetType = PATCHES;
      }
      const funcHash = file
        .replace(ALIGN_FILE_EXTENSION, '')
        .replace(PATCH_FILE_EXTENSION, '');
      if (datasetType in datasetLengths) {
        datasetLengths[datasetType][funcHash] = -1;
      }
    }

    return datasetLengths;
  }

  write(
    path: string,
    data: string,
    mode: 'w' | 'a' | 'a+b' | 'a+' = 'w'
  ): void {
    fs.writeFileSync(path, data, { flag: mode });
  }

  read(path: string): string {
    return fs.readFileSync(path, 'utf-8');
  }

  getHashFromPath(path: string): string {
    return path
      .replace(PATCH_FILE_EXTENSION, '')
      .replace(this.logDirectory, '')
      .replace(/\\/g, '');
  }
}

export default FilesystemBufferedLogger;
