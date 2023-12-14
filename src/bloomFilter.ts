import * as crypto from 'crypto';
import IBloomFilterPersistence from './persistence/iBloomFilterPersistence';

class BloomFilter {
  private size: number;
  private hashCount: number;
  private bitArray: boolean[];
  private persistence: IBloomFilterPersistence;

  constructor(
    persistence: IBloomFilterPersistence,
    size?: number,
    hashCount?: number,
    expectedNumberOfElements?: number,
    falsePositiveProbability?: number
  ) {
    if (!persistence) {
      throw new Error("Persistence cannot be None, it must be an instance of IBloomFilterPersistence");
    }

    if (!size && !hashCount && !expectedNumberOfElements && !falsePositiveProbability) {
      throw new Error("Must specify either (size, hashCount) or (expectedNumberOfElements, falsePositiveProbability)");
    }

    if (expectedNumberOfElements && falsePositiveProbability) {
      [size, hashCount] = BloomFilter.optimalBloomFilterParams(expectedNumberOfElements, falsePositiveProbability);
    }

    if (!size || !hashCount) {
      throw new Error("Size and hashCount not set. This should never happen.");
    }

    this.size = size;
    this.hashCount = hashCount;
    this.bitArray = this.initBitArray(size);
    this.persistence = persistence;
  }

  private initBitArray(size: number): boolean[] {
    return new Array<boolean>(size).fill(false);
  }

  private hashFunctions(str: string): [number, number] {
    const hash1 = parseInt(crypto.createHash('sha256').update(str).digest('hex'), 16);
    const hash2 = parseInt(crypto.createHash('md5').update(str).digest('hex'), 16);
    return [hash1, hash2];
  }

  public lookup(str: string): boolean {
    const [hash1, hash2] = this.hashFunctions(str);
    for (let seed = 0; seed < this.hashCount; seed++) {
      const index = (hash1 + seed * hash2) % this.size;
      if (!this.bitArray[index]) {
        return false;
      }
    }
    return true;
  }

  public add(str: string): void {
    const [hash1, hash2] = this.hashFunctions(str);
    for (let seed = 0; seed < this.hashCount; seed++) {
      const index = (hash1 + seed * hash2) % this.size;
      this.bitArray[index] = true;
    }
  }

  public save(): void {
    this.persistence.save(this.bitArray);
  }

  public load(): void {
    this.bitArray = this.persistence.load();
    // Add additional handling for bit array length checking if needed
  }

  public static optimalBloomFilterParams(n: number, p: number): [number, number] {
    const m = - (n * Math.log(p)) / (Math.log(2) ** 2);
    const k = (m / n) * Math.log(2);
    return [Math.ceil(m), Math.ceil(k)];
  }
}

export default BloomFilter;
