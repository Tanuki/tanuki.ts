export interface FunctionConfig {
  distilledModel: string;
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
  teacherModels: string[];
  nrOfTrainingRuns: number;
  currentModel?: string;
}