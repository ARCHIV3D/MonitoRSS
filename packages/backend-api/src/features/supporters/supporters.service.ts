import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Supporter, SupporterModel } from './entities/supporter.entity';
import dayjs from 'dayjs';
import { Patron } from './entities/patron.entity';
import { ConfigService } from '@nestjs/config';
import { PipelineStage } from 'mongoose';
import { PatronsService } from './patrons.service';

interface SupporterBenefits {
  isSupporter: boolean;
  maxFeeds: number;
  guilds: string[];
  maxGuilds: number;
  expireAt?: Date;
}

interface ServerBenefits {
  hasSupporter: boolean;
  maxFeeds: number;
  serverId: string;
  webhooks: boolean;
}

@Injectable()
export class SupportersService {
  defaultMaxFeeds: number;

  constructor(
    @InjectModel(Supporter.name)
    private readonly supporterModel: SupporterModel,
    private readonly configService: ConfigService,
    private readonly patronsService: PatronsService,
  ) {
    this.defaultMaxFeeds = this.configService.get<number>(
      'defaultMaxFeeds',
    ) as number;
  }

  static SUPPORTER_PATRON_PIPELINE: PipelineStage[] = [
    {
      $lookup: {
        from: 'patrons',
        localField: '_id',
        foreignField: 'discord',
        as: 'patrons',
      },
    },
  ];

  async getBenefitsOfDiscordUser(
    discordId: string,
  ): Promise<SupporterBenefits> {
    const aggregate: Array<
      Supporter & {
        patrons: Patron[];
      }
    > = await this.supporterModel.aggregate([
      {
        $match: {
          _id: discordId,
        },
      },
      ...SupportersService.SUPPORTER_PATRON_PIPELINE,
    ]);

    if (!aggregate.length) {
      return {
        isSupporter: false,
        maxFeeds: this.defaultMaxFeeds,
        guilds: [],
        maxGuilds: 0,
      };
    }

    const benefits = await this.getBenefitsFromSupporter(aggregate[0]);

    return {
      isSupporter: benefits.isSupporter,
      maxFeeds: benefits.maxFeeds,
      guilds: aggregate[0].guilds,
      maxGuilds: benefits.maxGuilds,
      expireAt: aggregate[0].expireAt,
    };
  }

  async getBenefitsOfServers(serverIds: string[]): Promise<ServerBenefits[]> {
    const allSupportersWithGuild: Array<
      Omit<Supporter, 'guilds'> & {
        patrons: Patron[];
        guilds: string; // Unwinded to actually be guild IDs
        guildId: string; // An alias to unwinded "guilds" for readability
      }
    > = await this.supporterModel.aggregate([
      {
        $match: {
          guilds: {
            $in: serverIds,
          },
        },
      },
      ...SupportersService.SUPPORTER_PATRON_PIPELINE,
      {
        $unwind: '$guilds',
      },
      {
        $match: {
          guilds: {
            $in: serverIds,
          },
        },
      },
      {
        $addFields: {
          guildId: '$guilds',
        },
      },
    ]);

    const benefitsMappedBySeverIds = new Map<
      string,
      ReturnType<typeof this.getBenefitsFromSupporter>[]
    >();

    for (const supporter of allSupportersWithGuild) {
      const { guildId } = supporter;
      const benefits = this.getBenefitsFromSupporter(supporter);
      const benefitsSoFar = benefitsMappedBySeverIds.get(guildId);

      if (!benefitsSoFar) {
        benefitsMappedBySeverIds.set(guildId, [benefits]);
      } else {
        benefitsSoFar.push(benefits);
      }
    }

    return serverIds.map((serverId) => {
      const serverBenefits = benefitsMappedBySeverIds.get(serverId);

      if (!serverBenefits?.length) {
        return {
          hasSupporter: false,
          maxFeeds: this.defaultMaxFeeds,
          serverId,
          webhooks: false,
        };
      }

      return {
        hasSupporter: serverBenefits.some((b) => b.isSupporter),
        maxFeeds: Math.max(...serverBenefits.map((b) => b.maxFeeds)),
        serverId,
        webhooks: serverBenefits.some((b) => b.webhooks),
      };
    });
  }

  async serverCanUseWebhooks(serverId: string) {
    const benefits = await this.getBenefitsOfServers([serverId]);

    return benefits[0]?.webhooks || false;
  }

  async setGuilds(userId: string, guildIds: string[]) {
    const updatedSupporter = await this.supporterModel
      .findOneAndUpdate(
        {
          _id: userId,
        },
        {
          $set: {
            guilds: guildIds,
          },
        },
        {
          new: true,
        },
      )
      .lean();

    if (!updatedSupporter) {
      throw new Error(
        `User ${userId} was not found while updating supporter guild ids`,
      );
    }

    return updatedSupporter;
  }

  getBenefitsFromSupporter(supporter: {
    maxFeeds?: number;
    maxGuilds?: number;
    patrons: Array<{
      status: Patron['status'];
      pledge: number;
      pledgeLifetime: number;
    }>;
  }) {
    if (!this.isValidSupporter(supporter)) {
      return {
        isSupporter: false,
        maxFeeds: this.defaultMaxFeeds,
        maxGuilds: 0,
        webhooks: false,
      };
    }

    const { maxFeeds: patronMaxFeeds, maxGuilds: patronMaxGuilds } =
      this.patronsService.getMaxBenefitsFromPatrons(supporter.patrons);

    return {
      isSupporter: true,
      maxFeeds: Math.max(
        supporter.maxFeeds ?? this.defaultMaxFeeds,
        patronMaxFeeds,
      ),
      maxGuilds: Math.max(supporter.maxGuilds ?? 1, patronMaxGuilds),
      webhooks: true,
    };
  }

  isValidSupporter(
    supporter?: {
      expireAt?: Date;
    } & {
      patrons: {
        status: Patron['status'];
        pledge: number;
      }[];
    },
  ) {
    if (!supporter) {
      return false;
    }

    const { expireAt, patrons } = supporter;

    if (!expireAt) {
      if (!patrons.length) {
        return true;
      }

      return patrons.some((patron) =>
        this.patronsService.isValidPatron(patron),
      );
    }

    return dayjs(expireAt).isAfter(dayjs());
  }
}
