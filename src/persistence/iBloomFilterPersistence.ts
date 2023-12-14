interface IBloomFilterPersistence {
  save(bitArray: boolean[]): void;
  load(): boolean[];
}

export default IBloomFilterPersistence;