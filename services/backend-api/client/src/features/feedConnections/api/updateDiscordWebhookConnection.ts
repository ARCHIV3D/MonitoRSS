import { InferType, object } from "yup";
import fetchRest from "../../../utils/fetchRest";
import { FeedConnectionDisabledCode, FeedConnectionSchema } from "@/types";

export interface UpdateDiscordWebhookConnectionInput {
  feedId: string;
  connectionId: string;
  details: {
    name?: string;
    webhook?: {
      id?: string;
      name?: string;
      iconUrl?: string;
    };
    content?: string | null;
    disabledCode?: FeedConnectionDisabledCode.Manual | null;
    passingComparisons?: string[];
    blockingComparisons?: string[];
    filters?: {
      expression: Record<string, any>;
    } | null;
    embeds?: Array<{
      color?: string | null;
      author?: {
        name?: string | null;
        url?: string | null;
        iconUrl?: string | null;
      } | null;
      thumbnail?: {
        url?: string | null;
      } | null;
      image?: {
        url?: string | null;
      } | null;
      footer?: {
        text?: string | null;
        iconUrl?: string | null;
      } | null;
      title?: string | null;
      url?: string | null;
      description?: string | null;
    }>;
    splitOptions?: {
      splitChar?: string | null;
      appendChar?: string | null;
      prependChar?: string | null;
    } | null;
    formatter?: {
      formatTables?: boolean | null;
      stripImages?: boolean | null;
    } | null;
  };
}

const UpdateDiscordWebhookConnectionOutputSchema = object({
  result: FeedConnectionSchema,
}).required();

export type UpdateDiscordWebhookConnectionOutput = InferType<
  typeof UpdateDiscordWebhookConnectionOutputSchema
>;

export const updateDiscordWebhookConnection = async (
  options: UpdateDiscordWebhookConnectionInput
): Promise<UpdateDiscordWebhookConnectionOutput> => {
  const res = await fetchRest(
    `/api/v1/user-feeds/${options.feedId}/connections/discord-webhooks/${options.connectionId}`,
    {
      validateSchema: UpdateDiscordWebhookConnectionOutputSchema,
      requestOptions: {
        method: "PATCH",
        body: JSON.stringify(options.details),
      },
    }
  );

  return res as UpdateDiscordWebhookConnectionOutput;
};
