import { EmbeddingDataType } from './embeddingDataType';

export class Embedding<T> {
  private _data: EmbeddingDataType<T>;

  constructor(data: EmbeddingDataType<T>) {
    if (Array.isArray(data)) {
      // Additional checks for element type can be performed if necessary
      this._data = data;
    } else if (data instanceof Float32Array || data instanceof Float64Array) {
      this._data = data;
    } else {
      throw new TypeError('Unsupported data type for embedding');
    }
  }

  // TypeScript doesn't support dynamic attribute access in the same way Python does
  public getData(): EmbeddingDataType<T> {
    return this._data;
  }

  public get length(): number {
    return this._data.length;
  }

  public slice(begin?: number, end?: number): Embedding<T> {
    return new Embedding(this._data.slice(begin, end));
  }

  public fill(value: number & T, start?: number, end?: number): this {
    this._data.fill(value, start, end);
    return this;
  }

  public toString(): string {
    return this._data.toString();
  }
}
