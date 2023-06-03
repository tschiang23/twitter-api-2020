const { User, Tweet, Reply, Like } = require('../models')

const tweetController = {
  getTweets: async (req, res, next) => {
    // name, accout, tweet, count(reply), count(like)
    Tweet.findAll({
        include:[]
    })
  }
}

module.exports = tweetController
