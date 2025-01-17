const helpers = require('../_helpers')
const { User, Tweet, Reply, Like, sequelize } = require('../models')
const { Op } = require('sequelize')

const tweetController = {
  getTweets: async (req, res, next) => {
    try {
      const currentUserId = helpers.getUser(req).id

      const tweets = await Tweet.findAll({
        attributes: ['id', 'description', 'createdAt'],
        include: [
          {
            model: User,
            attributes: ['id', 'name', 'account', 'avatar']
          },
          { model: Reply },
          { model: Like }
        ],
        order: [['createdAt', 'DESC']]
      })
      // 無推文資料
      if (!tweets) {
        return res
          .status(200)
          .json({ status: 'success', message: '無推文資料' })
      }

      // get tweet ID
      const tweetIds = tweets.map(tweet => tweet.id)
      // get likes for tweets liked by the current user
      const likes = await Like.findAll({
        where: {
          TweetId: {
            [Op.in]: tweetIds
          },
          UserId: currentUserId
        },
        raw: true
      })

      // get tweetId(array) liked by the current user
      const currentUserLikes = likes.map(l => l.TweetId)

      const data = tweets.map(tweet => {
        return {
          TweetId: tweet.id,
          description: tweet.description,
          tweetOwnerId: tweet.User.id,
          tweetOwnerName: tweet.User.name,
          tweetOwnerAccount: tweet.User.account,
          tweetOwnerAvatar: tweet.User.avatar,
          createdAt: tweet.createdAt,
          replyCount: tweet.dataValues.Replies.length,
          likeCount: tweet.dataValues.Likes.length,
          isLiked: currentUserLikes.includes(tweet.dataValues.id)
        }
      })

      return res.status(200).json(data)
    } catch (err) {
      next(err)
    }
  },
  postTweet: async (req, res, next) => {
    try {
      const user = helpers.getUser(req)
      const { description } = req.body
      const UserId = user.id

      // check if description is more than 140 characters
      if (description.trim().length > 140) {
        return res.status(404).json({
          status: 'error',
          message: '字數超過限制, 請輸入少於140個字'
        })
      }
      // check if description is whitespace
      if (!description.trim().length) {
        return res.status(404).json({
          status: 'error',
          message: '內容不可為空白'
        })
      }

      // create a new tweet
      const newTweet = await Tweet.create({
        UserId,
        description
      })

      const replyCount = await Reply.count({ where: { TweetId: newTweet.id } })
      const likeCount = await Like.count({ where: { TweetId: newTweet.id } })

      const data = {
        TweetId: newTweet.id,
        description: newTweet.description,
        tweetOwnerId: user.id,
        tweetOwnerName: user.name,
        tweetOwnerAccount: user.account,
        tweetOwnerAvatar: user.avatar,
        createdAt: newTweet.createdAt,
        replyCount,
        likeCount,
        isLiked: false
      }
      return res.status(200).json(data)
    } catch (err) {
      next(err)
    }
  },
  getTweet: async (req, res, next) => {
    try {
      const currentUserId = helpers.getUser(req).id
      const tweetId = req.params.tweet_id

      const [tweet, likes] = await Promise.all([
        Tweet.findByPk(tweetId, {
          attributes: ['id', 'description', 'createdAt'],
          include: [
            {
              model: User,
              attributes: ['id', 'name', 'account', 'avatar']
            },
            { model: Reply },
            { model: Like }
          ],
          order: [['createdAt', 'DESC']]
        }),
        Like.findAll({ where: { UserId: currentUserId }, raw: true })
      ])
      if (!tweet) {
        return res
          .status(404)
          .json({ status: 'error', message: '推文不存在' })
      }

      const currentUserLikes = likes.map(l => l.TweetId)
      const data = {
        TweetId: tweet.id,
        description: tweet.description,
        tweetOwnerId: tweet.User.id,
        tweetOwnerName: tweet.User.name,
        tweetOwnerAccount: tweet.User.account,
        tweetOwnerAvatar: tweet.User.avatar,
        createdAt: tweet.createdAt,
        replyCount: tweet.Replies.length,
        likeCount: tweet.Likes.length,
        isLiked: currentUserLikes.includes(tweet.id)
      }

      return res.status(200).json(data)
    } catch (err) {
      next(err)
    }
  },
  getReplies: async (req, res, next) => {
    try {
      const { tweet_id: tweetId } = req.params
      const tweet = await Tweet.findByPk(tweetId, {
        attributes: ['id', 'description', 'createdAt'],
        include: [
          {
            model: User,
            attributes: ['id', 'name', 'account']
          }
        ],
        raw: true,
        nest: true
      })

      if (!tweet) {
        return res.status(404).json({ status: 'error', message: '推文不存在' })
      }

      const replies = await Reply.findAll({
        where: { TweetId: tweetId },
        order: [['createdAt', 'DESC']],
        attributes: [
          'id',
          'comment',
          'createdAt',
          [sequelize.col('User.id'), 'userId'],
          [sequelize.col('User.name'), 'name'],
          [sequelize.col('User.account'), 'account'],
          [sequelize.col('User.avatar'), 'avatar']
        ],
        include: [
          {
            model: User,
            attributes: []
          }
        ],
        raw: true,
        nest: true
      })
      if (!replies) {
        return res
          .status(200)
          .json({ status: 'success', message: '無回覆資料' })
      }

      const data = replies.map(reply => ({
        replyId: reply.id,
        comment: reply.comment,
        replyOwnerId: reply.userId,
        replyOwnerName: reply.name,
        replyOwnerAccount: reply.account,
        replyOwnerAvatar: reply.avatar,
        createdAt: reply.createdAt,
        tweetOwnerId: tweet.User.id,
        tweetOwnerName: tweet.User.name,
        tweetOwnerAccount: tweet.User.account
      }))

      return res.status(200).json(data)
    } catch (err) {
      next(err)
    }
  },
  postReply: async (req, res, next) => {
    try {
      const { tweet_id: tweetId } = req.params
      const tweet = await Tweet.findByPk(tweetId)
      if (!tweet) {
        return res.status(404).json({ error: '推文不存在' })
      }

      // check if comment is whitespace
      const { comment } = req.body
      if (comment.trim().length === 0) {
        return res.status(404).json({ error: '內容不可為空白' })
      }

      // get user information
      const user = helpers.getUser(req)
      const UserId = user.id
      const tweetOwner = await User.findByPk(tweet.UserId)

      // create new reply
      const newReply = await Reply.create({
        comment,
        UserId,
        TweetId: tweetId
      })

      return res.status(200).json({
        TweetId: tweet.id,
        tweetOwnerId: tweetOwner.id,
        tweetOwnerName: tweetOwner.name,
        tweetOwnerAccount: tweetOwner.account,
        replyOwnerId: user.id,
        replyOwnerName: user.name,
        replyOwnerAvatar: user.avatar,
        comment: newReply.comment,
        createdAt: newReply.createdAt
      })
    } catch (err) {
      next(err)
    }
  },
  addLike: async (req, res, next) => {
    try {
      const { tweet_id: tweetId } = req.params
      const tweet = await Tweet.findByPk(tweetId)

      if (!tweet) {
        return res.status(404).json({ status: 'error', message: '推文不存在' })
      }

      // get user id
      const user = helpers.getUser(req)
      const UserId = user.id

      const like = await Like.findOne({
        where: {
          UserId: UserId,
          TweetId: tweetId
        }
      })

      if (like) {
        return res
          .status(404)
          .json({ status: 'error', message: '你已經喜歡過這則推文' })
      }

      await Like.create({
        UserId: UserId,
        TweetId: tweetId,
        isLiked: true
      })
      return res
        .status(200)
        .json({ status: 'success', message: '你已成功喜歡這則貼文' })
    } catch (err) {
      next(err)
    }
  },
  removeLike: async (req, res, next) => {
    try {
      const { tweet_id: tweetId } = req.params
      const tweet = await Tweet.findByPk(tweetId)

      if (!tweet) {
        return res.status(404).json({ status: 'error', message: '推文不存在' })
      }
      // get user id
      const user = helpers.getUser(req)
      const UserId = user.id

      const like = await Like.findOne({
        where: {
          UserId: UserId,
          TweetId: tweetId
        }
      })

      // if the user hasn't liked the tweet
      if (!like) {
        return res
          .status(404)
          .json({ status: 'error', message: '你尚未喜歡這則貼文' })
      }

      await like.destroy()

      return res
        .status(200)
        .json({ status: 'success', message: '你已成功移除喜歡' })
    } catch (err) {
      next(err)
    }
  }
}

module.exports = tweetController
