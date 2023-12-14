import * as fs from 'fs';
import * as path from 'path';
import IBloomFilterPersistence from './iBloomFilterPersistence';

class BloomFilterFileSystemDriver implements IBloomFilterPersistence {
  private logDirectory: string;

  constructor(logDirectory: string) {
    this.logDirectory = logDirectory;
  }

  public save(bitArray: boolean[]): void {
    const bloomFilterPath = path.join(this.logDirectory, 'bloom_filter_state.bin');
    const byteArray = this.booleanArrayToByteArray(bitArray);
    fs.writeFileSync(bloomFilterPath, Buffer.from(byteArray));
  }

  public load(): boolean[] {
    const bloomFilterPath = path.join(this.logDirectory, 'bloom_filter_state.bin');
    const fileBuffer = fs.readFileSync(bloomFilterPath);
    return this.byteArrayToBooleanArray([...fileBuffer]);
  }

  private booleanArrayToByteArray(bitArray: boolean[]): number[] {
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

  private byteArrayToBooleanArray(byteArray: number[]): boolean[] {
    const bitArray = [];
    for (const byte of byteArray) {
      for (let i = 0; i < 8; i++) {
        bitArray.push((byte & (1 << i)) !== 0);
      }
    }
    return bitArray;
  }
}

export default BloomFilterFileSystemDriver;