import { getModelToken } from "@nestjs/mongoose";
import { NestFastifyApplication } from "@nestjs/platform-fastify";
import { createTestFeed } from "../../test/data/feeds.test-data";
import {
  setupEndpointTests,
  teardownEndpointTests,
} from "../../utils/endpoint-tests";
import { MongooseTestModule } from "../../utils/mongoose-test.module";
import { Feed, FeedModel } from "../feeds/entities/feed.entity";
import { DiscordServersModule } from "./discord-servers.module";
import { CACHE_MANAGER, HttpStatus } from "@nestjs/common";
import { DISCORD_API_BASE_URL } from "../../constants/discord";
import {
  DiscordGuild,
  DiscordGuildRole,
  DiscordGuildChannel,
  Session,
  DiscordChannelType,
} from "../../common";
import { PartialUserGuild } from "../discord-users/types/PartialUserGuild.type";
import { Cache } from "cache-manager";
import { createTestDiscordGuildRole } from "../../test/data/discord-guild-role.test-data";
import { MockAgent, setGlobalDispatcher } from "undici";

const mockAgent = new MockAgent();
mockAgent.disableNetConnect();
setGlobalDispatcher(mockAgent);

const mockPool = mockAgent.get(DISCORD_API_BASE_URL.replace("/api/v9", ""));

jest.mock("../../utils/logger");

describe("DiscordServersModule", () => {
  let app: NestFastifyApplication;
  let feedModel: FeedModel;
  let setAccessToken: (accessToken: Session["accessToken"]) => Promise<string>;
  const standardRequestOptions = {
    headers: {
      cookie: "",
    },
  };
  const serverId = "633432788015644722";

  beforeAll(async () => {
    const { init } = setupEndpointTests({
      imports: [DiscordServersModule, MongooseTestModule.forRoot()],
    });

    ({ app, setAccessToken } = await init());

    standardRequestOptions.headers.cookie = await setAccessToken({
      access_token: "accessToken",
    } as Session["accessToken"]);

    feedModel = app.get<FeedModel>(getModelToken(Feed.name));
  });

  afterEach(async () => {
    await feedModel.deleteMany({});

    const cacheManager = app.get<Cache>(CACHE_MANAGER);
    cacheManager.reset();
  });

  afterAll(async () => {
    await teardownEndpointTests();
  });

  const mockGetServer = () => {
    mockPool
      .intercept({
        path: `/api/v9/guilds/${serverId}`,
        method: "GET",
      })
      .reply(200, {
        id: serverId,
        name: "Test Guild",
        icon: "",
        roles: [],
        owner_id: "123456789",
      } as DiscordGuild);
  };

  const mockGetUserGuilds = (partialGuild?: Partial<PartialUserGuild>) => {
    mockPool
      .intercept({
        path: `/api/v9/users/@me/guilds`,
        method: "GET",
      })
      .reply(200, [
        {
          id: serverId,
          owner: true,
          permissions: 16,
          ...partialGuild,
        },
      ]);
  };

  const mockGetServerChannels = (channels: DiscordGuildChannel[]) => {
    mockPool
      .intercept({
        path: `/api/v9/guilds/${serverId}/channels`,
        method: "GET",
      })
      .reply(200, channels);
  };

  const mockGetServerRoles = (roles: DiscordGuildRole[]) => {
    mockPool
      .intercept({
        path: `/api/v9/guilds/${serverId}/roles`,
        method: "GET",
      })
      .reply(200, roles);
  };

  const mockGetServerActiveThreads = (threads: DiscordGuildChannel[]) => {
    mockPool
      .intercept({
        path: `/api/v9/guilds/${serverId}/threads/active`,
        method: "GET",
      })
      .reply(200, { threads });
  };

  const mockAllDiscordEndpoints = (data?: {
    channels?: DiscordGuildChannel[];
    roles?: DiscordGuildRole[];
    threads?: DiscordGuildChannel[];
  }) => {
    mockGetServer();
    mockGetUserGuilds();

    if (data?.channels) {
      mockGetServerChannels(data?.channels || []);
    }

    if (data?.roles) {
      mockGetServerRoles(data?.roles || []);
    }

    if (data?.threads) {
      mockGetServerActiveThreads(data?.threads || []);
    }
  };

  describe("GET /discord-servers/:serverId", () => {
    it("returns 401 if user is not authorized", async () => {
      const { statusCode } = await app.inject({
        method: "GET",
        url: `/discord-servers/${serverId}`,
      });

      expect(statusCode).toBe(HttpStatus.UNAUTHORIZED);
    });
    it("returns 400 if bot has no access to discord server", async () => {
      mockPool
        .intercept({
          path: `/api/v9/guilds/${serverId}`,
          method: "GET",
        })
        .reply(404, {});
      mockGetUserGuilds();

      const { statusCode } = await app.inject({
        method: "GET",
        url: `/discord-servers/${serverId}`,
        ...standardRequestOptions,
      });

      expect(statusCode).toBe(HttpStatus.NOT_FOUND);
    });

    it("returns forbidden if user does not own server", async () => {
      mockGetServer();
      mockPool
        .intercept({
          path: `/api/v9/users/@me/guilds`,
          method: "GET",
        })
        .reply(200, []);

      const { statusCode } = await app.inject({
        method: "GET",
        url: `/discord-servers/${serverId}`,
        ...standardRequestOptions,
      });

      expect(statusCode).toBe(HttpStatus.FORBIDDEN);
    });

    it("returns forbidden if user does not manage server", async () => {
      mockGetServer();
      mockGetUserGuilds({
        permissions: "0",
        owner: false,
      });
      mockPool
        .intercept({
          path: `/api/v9/users/@me/guilds`,
          method: "GET",
        })
        .reply(200, []);

      const { statusCode } = await app.inject({
        method: "GET",
        url: `/discord-servers/${serverId}`,
        ...standardRequestOptions,
      });

      expect(statusCode).toBe(HttpStatus.FORBIDDEN);
    });

    it("returns the correct payload", async () => {
      mockAllDiscordEndpoints();

      const { statusCode, body } = await app.inject({
        method: "GET",
        url: `/discord-servers/${serverId}`,
        ...standardRequestOptions,
      });

      expect(statusCode).toBe(HttpStatus.OK);
      const parsedBody = JSON.parse(body);
      expect(parsedBody).toEqual({
        result: {
          profile: {
            dateFormat: expect.any(String),
            dateLanguage: expect.any(String),
            timezone: expect.any(String),
          },
        },
      });
    });
  });

  describe("PATCH /discord-servers/:serverId", () => {
    const validPayload = {
      dateFormat: "date-format",
      dateLanguage: "en",
      timezone: "UTC",
    };

    it("returns 401 if user is not authorized", async () => {
      const { statusCode } = await app.inject({
        method: "PATCH",
        url: `/discord-servers/${serverId}`,
        payload: validPayload,
      });

      expect(statusCode).toBe(HttpStatus.UNAUTHORIZED);
    });
    it("returns 400 if bot has no access to discord server", async () => {
      mockPool
        .intercept({
          path: `/api/v9/guilds/${serverId}`,
          method: "GET",
        })
        .reply(404, {});
      mockGetUserGuilds();

      const { statusCode } = await app.inject({
        method: "PATCH",
        url: `/discord-servers/${serverId}`,
        payload: validPayload,
        ...standardRequestOptions,
      });

      expect(statusCode).toBe(HttpStatus.NOT_FOUND);
    });

    it("returns forbidden if user does not own server", async () => {
      mockGetServer();
      mockPool
        .intercept({
          path: `/api/v9/users/@me/guilds`,
          method: "GET",
        })
        .reply(200, []);

      const { statusCode } = await app.inject({
        method: "PATCH",
        url: `/discord-servers/${serverId}`,
        payload: validPayload,
        ...standardRequestOptions,
      });

      expect(statusCode).toBe(HttpStatus.FORBIDDEN);
    });

    it("returns forbidden if user does not manage server", async () => {
      mockGetServer();
      mockGetUserGuilds({
        permissions: "0",
        owner: false,
      });
      mockPool
        .intercept({
          path: `/api/v9/users/@me/guilds`,
          method: "GET",
        })
        .reply(200, []);

      const { statusCode } = await app.inject({
        method: "PATCH",
        url: `/discord-servers/${serverId}`,
        payload: validPayload,
        ...standardRequestOptions,
      });

      expect(statusCode).toBe(HttpStatus.FORBIDDEN);
    });

    it("returns 400 on a bad payload", async () => {
      mockAllDiscordEndpoints();

      const { statusCode } = await app.inject({
        method: "PATCH",
        url: `/discord-servers/${serverId}`,
        payload: {
          dateFormat: "",
        },
        ...standardRequestOptions,
      });

      expect(statusCode).toBe(HttpStatus.BAD_REQUEST);
    });

    it("returns 400 on bad timezone", async () => {
      mockAllDiscordEndpoints();

      const { statusCode } = await app.inject({
        method: "PATCH",
        url: `/discord-servers/${serverId}`,
        payload: {
          ...validPayload,
          timezone: "fake timezone",
        },
        ...standardRequestOptions,
      });

      expect(statusCode).toBe(HttpStatus.BAD_REQUEST);
    });

    it("returns the correct payload", async () => {
      mockAllDiscordEndpoints();

      const { statusCode, body } = await app.inject({
        method: "PATCH",
        url: `/discord-servers/${serverId}`,
        payload: validPayload,
        ...standardRequestOptions,
      });

      expect(statusCode).toBe(HttpStatus.OK);
      const parsedBody = JSON.parse(body);
      expect(parsedBody).toEqual({
        result: {
          profile: {
            dateFormat: validPayload.dateFormat,
            dateLanguage: validPayload.dateLanguage,
            timezone: validPayload.timezone,
          },
        },
      });
    });
  });

  describe("GET /discord-servers/:serverId/status", () => {
    it("returns 401 if user is not authorized", async () => {
      const { statusCode } = await app.inject({
        method: "GET",
        url: `/discord-servers/${serverId}/status`,
      });

      expect(statusCode).toBe(HttpStatus.UNAUTHORIZED);
    });

    it("returns the correct response bot is forbidden from accessing discord server", async () => {
      mockGetUserGuilds();
      mockPool
        .intercept({
          path: `/api/v9/guilds/${serverId}`,
          method: "GET",
        })
        .reply(403, {
          message: "Forbidden",
        });

      const { statusCode, body } = await app.inject({
        method: "GET",
        url: `/discord-servers/${serverId}/status`,
        ...standardRequestOptions,
      });

      expect(statusCode).toBe(HttpStatus.OK);
      const parsedBody = JSON.parse(body);
      expect(parsedBody).toEqual({
        result: {
          authorized: false,
        },
      });
    });

    it("returns the correct response if discord server does not exist", async () => {
      mockGetUserGuilds();
      mockPool
        .intercept({
          path: `/api/v9/guilds/${serverId}`,
          method: "GET",
        })
        .reply(404, {
          message: "Not found",
        });

      const { statusCode, body } = await app.inject({
        method: "GET",
        url: `/discord-servers/${serverId}/status`,
        ...standardRequestOptions,
      });

      expect(statusCode).toBe(HttpStatus.OK);
      const parsedBody = JSON.parse(body);
      expect(parsedBody).toEqual({
        result: {
          authorized: false,
        },
      });
    });

    it("returns the correct response if bot has access to server", async () => {
      mockGetUserGuilds();
      mockGetServer();

      const { statusCode, body } = await app.inject({
        method: "GET",
        url: `/discord-servers/${serverId}/status`,
        ...standardRequestOptions,
      });

      expect(statusCode).toBe(HttpStatus.OK);
      const parsedBody = JSON.parse(body);
      expect(parsedBody).toEqual({
        result: {
          authorized: true,
        },
      });
    });
  });

  describe("GET /discord-servers/:serverId/channels", () => {
    it("returns 401 if user is not authorized", async () => {
      const { statusCode } = await app.inject({
        method: "GET",
        url: `/discord-servers/${serverId}/channels`,
      });

      expect(statusCode).toBe(HttpStatus.UNAUTHORIZED);
    });
    it("returns 400 if bot has no access to discord server", async () => {
      mockPool
        .intercept({
          path: `/api/v9/guilds/${serverId}`,
          method: "GET",
        })
        .reply(404, {});
      mockGetUserGuilds();

      const { statusCode } = await app.inject({
        method: "GET",
        url: `/discord-servers/${serverId}/channels`,
        ...standardRequestOptions,
      });

      expect(statusCode).toBe(HttpStatus.NOT_FOUND);
    });

    it("returns forbidden if user does not own server", async () => {
      mockGetServer();
      mockPool
        .intercept({
          path: `/api/v9/users/@me/guilds`,
          method: "GET",
        })
        .reply(200, []);

      const { statusCode } = await app.inject({
        method: "GET",
        url: `/discord-servers/${serverId}/channels`,
        ...standardRequestOptions,
      });

      expect(statusCode).toBe(HttpStatus.FORBIDDEN);
    });

    it("returns forbidden if user does not manage server", async () => {
      mockGetServer();
      mockGetUserGuilds({
        permissions: "0",
        owner: false,
      });
      mockPool
        .intercept({
          path: `/api/v9/users/@me/guilds`,
          method: "GET",
        })
        .reply(200, []);

      const { statusCode } = await app.inject({
        method: "GET",
        url: `/discord-servers/${serverId}/channels`,
        ...standardRequestOptions,
      });

      expect(statusCode).toBe(HttpStatus.FORBIDDEN);
    });

    it("returns the discord server channels", async () => {
      const serverChannels: DiscordGuildChannel[] = [
        {
          id: "id1",
          name: "name1",
          guild_id: "guildId1",
          permission_overwrites: [],
          parent_id: null,
          type: DiscordChannelType.GUILD_TEXT,
        },
        {
          id: "id2",
          name: "name2",
          guild_id: "guildId1",
          permission_overwrites: [],
          parent_id: null,
          type: DiscordChannelType.GUILD_TEXT,
        },
      ];
      mockAllDiscordEndpoints({
        channels: serverChannels,
      });

      const { statusCode, body } = await app.inject({
        method: "GET",
        url: `/discord-servers/${serverId}/channels`,
        ...standardRequestOptions,
      });

      const parsedBody = JSON.parse(body);
      expect(statusCode).toBe(HttpStatus.OK);
      expect(parsedBody).toEqual({
        results: serverChannels.map((channel) => ({
          id: channel.id,
          name: channel.name,
        })),
        total: serverChannels.length,
      });
    });
  });

  describe("GET /discord-servers/:serverId/active-threads", () => {
    it("returns 401 if user is not authorized", async () => {
      const { statusCode } = await app.inject({
        method: "GET",
        url: `/discord-servers/${serverId}/active-threads`,
      });

      expect(statusCode).toBe(HttpStatus.UNAUTHORIZED);
    });
    it("returns 400 if bot has no access to discord server", async () => {
      mockPool
        .intercept({
          path: `/api/v9/guilds/${serverId}`,
          method: "GET",
        })
        .reply(404, {});
      mockGetUserGuilds();

      const { statusCode } = await app.inject({
        method: "GET",
        url: `/discord-servers/${serverId}/active-threads`,
        ...standardRequestOptions,
      });

      expect(statusCode).toBe(HttpStatus.NOT_FOUND);
    });

    it("returns forbidden if user does not own server", async () => {
      mockGetServer();
      mockPool
        .intercept({
          path: `/api/v9/users/@me/guilds`,
          method: "GET",
        })
        .reply(200, []);

      const { statusCode } = await app.inject({
        method: "GET",
        url: `/discord-servers/${serverId}/active-threads`,
        ...standardRequestOptions,
      });

      expect(statusCode).toBe(HttpStatus.FORBIDDEN);
    });

    // Next test will fail because intercept within this test is interfering with the next test
    it.skip("returns forbidden if user does not manage server", async () => {
      mockGetServer();
      mockGetUserGuilds({
        permissions: "0",
        owner: false,
      });
      mockPool
        .intercept({
          path: `/api/v9/users/@me/guilds`,
          method: "GET",
        })
        .reply(200, []);

      const { statusCode } = await app.inject({
        method: "GET",
        url: `/discord-servers/${serverId}/active-threads`,
        ...standardRequestOptions,
      });

      expect(statusCode).toBe(HttpStatus.FORBIDDEN);
    });

    it("returns the active threads", async () => {
      const serverChannels: DiscordGuildChannel[] = [
        {
          id: "id1",
          name: "name1",
          guild_id: "guildId1",
          permission_overwrites: [],
          parent_id: null,
          type: DiscordChannelType.PUBLIC_THREAD,
        },
        {
          id: "id2",
          name: "name2",
          guild_id: "guildId1",
          permission_overwrites: [],
          parent_id: null,
          type: DiscordChannelType.PUBLIC_THREAD,
        },
      ];
      mockAllDiscordEndpoints({
        threads: serverChannels,
      });

      const { statusCode, body } = await app.inject({
        method: "GET",
        url: `/discord-servers/${serverId}/active-threads`,
        ...standardRequestOptions,
      });

      const parsedBody = JSON.parse(body);
      expect(parsedBody).toEqual(
        expect.objectContaining({
          results: serverChannels.map((channel) =>
            expect.objectContaining({
              id: channel.id,
              name: channel.name,
            })
          ),
          total: serverChannels.length,
        })
      );
      expect(statusCode).toBe(HttpStatus.OK);
    });
  });

  describe("GET /discord-servers/:serverId/roles", () => {
    it("returns 401 if user is not authorized", async () => {
      const { statusCode } = await app.inject({
        method: "GET",
        url: `/discord-servers/${serverId}/roles`,
      });

      expect(statusCode).toBe(HttpStatus.UNAUTHORIZED);
    });
    it("returns 400 if bot has no access to discord server", async () => {
      mockPool
        .intercept({
          path: `/api/v9/guilds/${serverId}`,
          method: "GET",
        })
        .reply(404, {});
      mockGetUserGuilds();

      const { statusCode } = await app.inject({
        method: "GET",
        url: `/discord-servers/${serverId}/roles`,
        ...standardRequestOptions,
      });

      expect(statusCode).toBe(HttpStatus.NOT_FOUND);
    });

    it("returns forbidden if user does not own server", async () => {
      mockGetServer();
      mockPool
        .intercept({
          path: `/api/v9/users/@me/guilds`,
          method: "GET",
        })
        .reply(200, []);

      const { statusCode } = await app.inject({
        method: "GET",
        url: `/discord-servers/${serverId}/roles`,
        ...standardRequestOptions,
      });

      expect(statusCode).toBe(HttpStatus.FORBIDDEN);
    });

    it("returns forbidden if user does not manage server", async () => {
      mockGetServer();
      mockGetUserGuilds({
        permissions: "0",
        owner: false,
      });
      mockPool
        .intercept({
          path: `/api/v9/users/@me/guilds`,
          method: "GET",
        })
        .reply(200, []);

      const { statusCode } = await app.inject({
        method: "GET",
        url: `/discord-servers/${serverId}/roles`,
        ...standardRequestOptions,
      });

      expect(statusCode).toBe(HttpStatus.FORBIDDEN);
    });

    it("returns the discord server roles", async () => {
      const serverRoles: DiscordGuildRole[] = [
        createTestDiscordGuildRole({
          id: "id1",
          name: "name1",
          color: 123,
        }),
        createTestDiscordGuildRole({
          id: "id2",
          name: "name2",
          color: 456,
        }),
      ];
      mockAllDiscordEndpoints({
        roles: serverRoles,
      });

      const { statusCode, body } = await app.inject({
        method: "GET",
        url: `/discord-servers/${serverId}/roles`,
        ...standardRequestOptions,
      });

      const parsedBody = JSON.parse(body);
      expect(statusCode).toBe(HttpStatus.OK);
      expect(parsedBody).toEqual(
        expect.objectContaining({
          results: expect.arrayContaining(
            serverRoles.map((channel) =>
              expect.objectContaining({
                id: channel.id,
                name: channel.name,
                color: expect.any(String),
              })
            )
          ),
          total: serverRoles.length,
        })
      );
    });
  });

  describe("GET /discord-servers/:serverId/feeds", () => {
    it("returns 401 if user is not authenticated", async () => {
      mockPool
        .intercept({
          path: `/api/v9/guilds/${serverId}`,
          method: "GET",
        })
        .reply(404, {});
      mockGetUserGuilds();

      const { statusCode } = await app.inject({
        method: "GET",
        url: `/discord-servers/${serverId}/feeds?offset=0&limit=10`,
      });

      expect(statusCode).toBe(HttpStatus.UNAUTHORIZED);
    });

    it("returns 400 if bot has no access to discord server", async () => {
      mockPool
        .intercept({
          path: `/api/v9/guilds/${serverId}`,
          method: "GET",
        })
        .reply(404, {});
      mockGetUserGuilds();

      const { statusCode } = await app.inject({
        method: "GET",
        url: `/discord-servers/${serverId}/feeds?offset=0&limit=10`,
        ...standardRequestOptions,
      });

      expect(statusCode).toBe(HttpStatus.NOT_FOUND);
    });

    it("returns forbidden if user does own server", async () => {
      mockGetServer();
      mockPool
        .intercept({
          path: `/api/v9/users/@me/guilds`,
          method: "GET",
        })
        .reply(200, []);

      const { statusCode } = await app.inject({
        method: "GET",
        url: `/discord-servers/${serverId}/feeds?offset=0&limit=10`,
        ...standardRequestOptions,
      });

      expect(statusCode).toBe(HttpStatus.FORBIDDEN);
    });

    it("returns forbidden if user does not manage server", async () => {
      mockGetServer();
      mockGetUserGuilds({
        permissions: "0",
        owner: false,
      });
      mockPool
        .intercept({
          path: `/api/v9/users/@me/guilds`,
          method: "GET",
        })
        .reply(200, []);

      const { statusCode } = await app.inject({
        method: "GET",
        url: `/discord-servers/${serverId}/feeds?offset=0&limit=10`,
        ...standardRequestOptions,
      });

      expect(statusCode).toBe(HttpStatus.FORBIDDEN);
    });

    it("returns 400 if limit is missing", async () => {
      mockGetServer();
      mockGetUserGuilds();
      const { statusCode } = await app.inject({
        method: "GET",
        url: `/discord-servers/${serverId}/feeds?offset=0`,
        ...standardRequestOptions,
      });

      expect(statusCode).toBe(400);
    });
    it("returns 400 if offset is missing", async () => {
      mockAllDiscordEndpoints();
      const { statusCode } = await app.inject({
        method: "GET",
        url: `/discord-servers/${serverId}/feeds?limit=10`,
        ...standardRequestOptions,
      });

      expect(statusCode).toBe(400);
    });
    it("returns 400 if offset is not a number", async () => {
      mockAllDiscordEndpoints();
      const { statusCode } = await app.inject({
        method: "GET",
        url: `/discord-servers/${serverId}/feeds?limit=10&offset=foo`,
        ...standardRequestOptions,
      });

      expect(statusCode).toBe(400);
    });

    it("returns 401 if no access token set via header cookie", async () => {
      mockAllDiscordEndpoints();
      const { statusCode } = await app.inject({
        method: "GET",
        url: `/discord-servers/${serverId}/feeds?offset=0&limit=10`,
      });

      expect(statusCode).toBe(HttpStatus.UNAUTHORIZED);
    });

    it("returns the correct response", async () => {
      mockAllDiscordEndpoints();
      await feedModel.insertMany([
        createTestFeed({
          guild: serverId,
        }),
        createTestFeed({
          guild: serverId,
        }),
      ]);

      const { statusCode, body } = await app.inject({
        method: "GET",
        url: `/discord-servers/${serverId}/feeds?limit=10&offset=0`,
        ...standardRequestOptions,
      });

      const parsedBody = JSON.parse(body);
      expect(statusCode).toEqual(200);
      expect(parsedBody.results).toHaveLength(2);
      expect(parsedBody.total).toEqual(2);
    });

    it("works with search", async () => {
      mockAllDiscordEndpoints();
      await feedModel.insertMany([
        createTestFeed({
          guild: serverId,
          title: "goo",
        }),
        createTestFeed({
          guild: serverId,
          title: "foo",
        }),
      ]);

      const { statusCode, body } = await app.inject({
        method: "GET",
        url: `/discord-servers/${serverId}/feeds?limit=10&offset=0&search=foo`,
        ...standardRequestOptions,
      });

      const parsedBody = JSON.parse(body);
      expect(statusCode).toEqual(200);
      expect(parsedBody.results).toHaveLength(1);
      expect(parsedBody.total).toEqual(1);
    });
  });
});
