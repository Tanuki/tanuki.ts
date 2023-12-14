import { FunctionExample } from '../models/functionExample';

interface IDatasetWorker {
  loadExistingDatasets(): Record<string, Record<string, number>>;

  logSymbolicAlign(
    funcHash: string,
    example: FunctionExample,
    ...args: any[]
  ): [boolean, boolean];

  logEmbeddableAlign(
    funcHash: string,
    example: FunctionExample,
    positive: boolean,
    ...args: any[]
  ): [boolean, boolean];

  logSymbolicPatch(
    funcHash: string,
    example: FunctionExample
  ): Record<string, number>;

  loadFunctionConfig(funcHash: string): [FunctionConfig, boolean];

  loadDataset(
    datasetType: string,
    funcHash: string,
    returnType: 'dataset' | 'length' | 'both'
  ): number | string | [number, string | null] | null;

  updateFunctionConfig(
    funcHash: string,
    configToBeSaved: Record<string, any>
  ): void;
}

// Export the DatasetWorker class
export { IDatasetWorker };
