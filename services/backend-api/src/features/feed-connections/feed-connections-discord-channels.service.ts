import { HttpStatus, Injectable } from "@nestjs/common";
import { InjectModel } from "@nestjs/mongoose";
import { Types } from "mongoose";
import { DiscordAPIError } from "../../common/errors/DiscordAPIError";
import { DiscordChannelNotOwnedException } from "../../common/exceptions";
import { FeedConnectionType } from "../feeds/constants";
import { DiscordChannelConnection } from "../feeds/entities/feed-connections";
import { FeedsService } from "../feeds/feeds.service";
import { UserFeed, UserFeedModel } from "../user-feeds/entities";
import {
  DiscordChannelPermissionsException,
  MissingDiscordChannelException,
} from "./exceptions";

export interface UpdateDiscordChannelConnectionInput {
  accessToken: string;
  updates: {
    filters?: DiscordChannelConnection["filters"];
    name?: string;
    details?: {
      embeds?: DiscordChannelConnection["details"]["embeds"];
      channel?: {
        id: string;
      };
      content?: string;
    };
  };
  guildId: string;
}

@Injectable()
export class FeedConnectionsDiscordChannelsService {
  constructor(
    private readonly feedsService: FeedsService,
    @InjectModel(UserFeed.name) private readonly userFeedModel: UserFeedModel
  ) {}

  async createDiscordChannelConnection({
    feedId,
    name,
    channelId,
    userAccessToken,
    guildId,
  }: {
    feedId: string;
    name: string;
    channelId: string;
    userAccessToken: string;
    guildId: string;
  }): Promise<DiscordChannelConnection> {
    await this.assertDiscordChannelCanBeUsed(
      userAccessToken,
      channelId,
      guildId
    );

    const connectionId = new Types.ObjectId();

    const updated = await this.userFeedModel.findOneAndUpdate(
      {
        _id: feedId,
      },
      {
        $push: {
          "connections.discordChannels": {
            id: connectionId,
            name,
            details: {
              type: FeedConnectionType.DiscordChannel,
              channel: {
                id: channelId,
                guildId,
              },
              embeds: [],
            },
          },
        },
      },
      {
        new: true,
      }
    );

    const createdConnection = updated?.connections.discordChannels.find(
      (connection) => connection.id.equals(connectionId)
    );

    if (!createdConnection) {
      throw new Error(
        "Connection was not successfuly created. Check insertion statement and schemas are correct."
      );
    }

    return createdConnection;
  }

  async updateDiscordChannelConnection(
    feedId: string,
    connectionId: string,
    { accessToken, updates, guildId }: UpdateDiscordChannelConnectionInput
  ): Promise<DiscordChannelConnection> {
    const setRecordDetails: Partial<DiscordChannelConnection["details"]> =
      Object.entries(updates.details || {}).reduce(
        (acc, [key, value]) => ({
          ...acc,
          [`connections.discordChannels.$.details.${key}`]: value,
        }),
        {}
      );

    if (updates.details?.channel?.id) {
      await this.assertDiscordChannelCanBeUsed(
        accessToken,
        updates.details.channel.id,
        guildId
      );

      // @ts-ignore
      setRecordDetails["connections.discordChannels.$.details.channel"] = {
        id: updates.details.channel.id,
        guildId,
      };
    }

    const findQuery = {
      _id: feedId,
      "connections.discordChannels.id": connectionId,
    };

    const updateQuery = {
      $set: {
        ...setRecordDetails,
        ...(updates.filters && {
          [`connections.discordChannels.$.filters`]: updates.filters,
        }),
        ...(updates.name && {
          [`connections.discordChannels.$.name`]: updates.name,
        }),
      },
    };

    const updated = await this.userFeedModel.findOneAndUpdate(
      findQuery,
      updateQuery,
      {
        new: true,
      }
    );

    const updatedConnection = updated?.connections.discordChannels.find(
      (connection) => connection.id.equals(connectionId)
    );

    if (!updatedConnection) {
      throw new Error(
        "Connection was not successfuly updated. Check insertion statement and schemas are correct."
      );
    }

    return updatedConnection;
  }

  async deleteConnection(feedId: string, connectionId: string) {
    await this.userFeedModel.updateOne(
      {
        _id: feedId,
      },
      {
        $pull: {
          "connections.discordChannels": {
            id: connectionId,
          },
        },
      }
    );
  }

  private async assertDiscordChannelCanBeUsed(
    accessToken: string,
    channelId: string,
    guildId: string
  ) {
    try {
      const channel = await this.feedsService.canUseChannel({
        channelId,
        userAccessToken: accessToken,
      });

      if (channel.guild_id !== guildId) {
        throw new DiscordChannelNotOwnedException(
          `Discord channel ${channelId} is not owned by guild ${guildId}`
        );
      }

      return channel;
    } catch (err) {
      if (err instanceof DiscordAPIError) {
        if (err.statusCode === HttpStatus.NOT_FOUND) {
          throw new MissingDiscordChannelException();
        }

        if (err.statusCode === HttpStatus.FORBIDDEN) {
          throw new DiscordChannelPermissionsException();
        }
      }

      throw err;
    }
  }
}