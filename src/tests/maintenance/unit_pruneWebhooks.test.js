process.env.TEST_ENV = true
const Feed = require('../../structs/db/Feed.js')
const pruneWebhooks = require('../../maintenance/pruneWebhooks')

jest.mock('../../structs/db/Feed.js')

describe('maintenance/pruneWebhooks', function () {
  const bot = {
    shard: {
      ids: []
    },
    channels: {
      cache: {
        get: jest.fn()
      }
    }
  }
  beforeEach(function () {
    jest.restoreAllMocks()
    Feed.mockReset()
  })
  it('deletes feeds with missing webhooks', async function () {
    const feeds = [{
      webhook: {
        id: '1'
      },
      save: jest.fn()
    }, {
      webhook: {
        id: '2'
      },
      save: jest.fn()
    }, {
      webhook: {
        id: '3'
      },
      save: jest.fn()
    }, {}]
    const channelOne = {
      fetchWebhooks: async () => new Map([['1', {}]])
    }
    const channelThree = {
      fetchWebhooks: async () => new Map([['3', {}]])
    }
    bot.channels.cache.get
      .mockReturnValueOnce(channelOne)
      .mockReturnValueOnce(channelOne)
      .mockReturnValueOnce(channelThree)
    Feed.getAll.mockResolvedValue(feeds)
    await pruneWebhooks(bot)
    expect(feeds[0].webhook).toBeDefined()
    expect(feeds[0].save).not.toHaveBeenCalled()
    expect(feeds[1].webhook).toBeUndefined()
    expect(feeds[1].save).toHaveBeenCalledTimes(1)
    expect(feeds[2].webhook).toBeDefined()
    expect(feeds[2].save).not.toHaveBeenCalled()
  })
  it('ignores feeds with missing channels', async function () {
    const feeds = [{
      webhook: {
        id: '1'
      },
      save: jest.fn()
    }, {
      webhook: {
        id: '2'
      },
      save: jest.fn()
    }]
    bot.channels.cache.get
      .mockReturnValueOnce(null)
      .mockReturnValueOnce(null)
      .mockReturnValueOnce(null)
    Feed.getAll.mockResolvedValue(feeds)
    await pruneWebhooks(bot)
    expect(feeds[0].webhook).toBeDefined()
    expect(feeds[0].save).not.toHaveBeenCalled()
    expect(feeds[1].webhook).toBeDefined()
    expect(feeds[1].save).not.toHaveBeenCalled()
  })
})
