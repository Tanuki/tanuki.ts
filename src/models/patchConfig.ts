export interface PatchConfig {
  environmentId?: number;
  ignoreFinetuneFetching?: boolean;
  ignoreFinetuning?: boolean;
  ignoreDataStorage?: boolean;
  teacherModels?: string[];
  generationParams?: Record<string, any>;
}
