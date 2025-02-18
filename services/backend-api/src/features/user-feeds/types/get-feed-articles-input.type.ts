import { CustomPlaceholderDto } from "../../../common";
import { GetFeedArticlesFilterReturnType } from "../constants";

export interface GetFeedArticlesInput {
  limit: number;
  url: string;
  random?: boolean;
  selectProperties?: string[];
  skip?: number;
  filters?: {
    returnType: GetFeedArticlesFilterReturnType.IncludeEvaluationResults;
    expression?: Record<string, unknown>;
    search?: string;
  };
  formatter: {
    customPlaceholders?: Array<CustomPlaceholderDto> | null;
    options: {
      stripImages: boolean;
      formatTables: boolean;
      dateFormat: string | undefined;
      dateTimezone: string | undefined;
      disableImageLinkPreviews: boolean;
    };
  };
}
