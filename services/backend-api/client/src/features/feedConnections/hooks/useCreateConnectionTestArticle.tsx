import { useMutation } from "@tanstack/react-query";
import { FeedConnectionType, SendTestArticleDeliveryStatus } from "../../../types";
import ApiAdapterError from "../../../utils/ApiAdapterError";
import {
  createDiscordChannelConnectionTestArticle,
  createDiscordWebhookConnectionTestArticle,
} from "../api";

interface CreateConnectionTestArticleInput {
  feedId: string;
  connectionId: string;
  data: {
    article?: {
      id?: string;
    };
  };
}

interface CreateConnectionTestArticleOutput {
  result: {
    status: SendTestArticleDeliveryStatus;
    apiResponse?: Record<string, unknown>;
    apiPayload?: Record<string, unknown>;
  };
}

const methodsByType: Record<
  FeedConnectionType,
  (input: CreateConnectionTestArticleInput) => Promise<CreateConnectionTestArticleOutput>
> = {
  [FeedConnectionType.DiscordChannel]: createDiscordChannelConnectionTestArticle,
  [FeedConnectionType.DiscordWebhook]: createDiscordWebhookConnectionTestArticle,
};

export const useCreateConnectionTestArticle = (type: FeedConnectionType) => {
  const { mutateAsync, status } = useMutation<
    CreateConnectionTestArticleOutput,
    ApiAdapterError,
    CreateConnectionTestArticleInput
  >((details) => {
    const method = methodsByType[type];

    return method(details);
  });

  return {
    mutateAsync,
    status,
  };
};
