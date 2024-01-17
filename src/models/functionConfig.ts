import { BaseModelConfig } from "../languageModels/llmConfigs/baseModelConfig";

export interface FunctionConfig {
  distilledModel: BaseModelConfig;
  currentModelStats: {
    trainedOnDatapoints: number;
    runningFaults: number[];
  };
  lastTrainingRun: {
    jobId?: string;
    trainedOnDatapoints: number;
    lastChecked?: string;
  };
  currentTrainingRun: {
    jobId?: string;
    trainedOnDatapoints?: number;
    lastChecked?: string;
  };
  teacherModels: BaseModelConfig[];
  nrOfTrainingRuns: number;
  currentModel?: string;
}