'use strict';

const fetch = require('node-fetch');

const stockLikes = {};

module.exports = function (app) {

  app.route('/api/stock-prices')
    .get(async function (req, res) {
      const stockQuery = req.query.stock;
      const like = req.query.like === 'true';
      const ip = req.ip;

      const fetchStockData = async (ticker) => {
        try {
          const response = await fetch(`https://stock-price-checker-proxy.freecodecamp.rocks/v1/stock/${ticker}/quote`);
          const data = await response.json();

          if (!data.symbol || !data.latestPrice) {
            throw new Error('Invalid stock data');
          }

          // Initialize if not present
          if (!stockLikes[data.symbol]) {
            stockLikes[data.symbol] = {
              likes: 0,
              ipList: []
            };
          }

          // Handle like logic
          if (like && !stockLikes[data.symbol].ipList.includes(ip)) {
            stockLikes[data.symbol].likes++;
            stockLikes[data.symbol].ipList.push(ip);
          }

          return {
            stock: data.symbol,
            price: data.latestPrice,
            likes: stockLikes[data.symbol].likes
          };

        } catch (err) {
          console.error(`Error fetching stock data for ${ticker}:`, err.message);
          return null;
        }
      };

      if (typeof stockQuery === 'string') {
        const stockData = await fetchStockData(stockQuery.toUpperCase());
        if (!stockData) {
          return res.status(400).json({ error: 'Invalid stock symbol' });
        }
        return res.json({ stockData });
      }

      if (Array.isArray(stockQuery)) {
        const [stock1, stock2] = await Promise.all([
          fetchStockData(stockQuery[0].toUpperCase()),
          fetchStockData(stockQuery[1].toUpperCase())
        ]);

        if (!stock1 || !stock2) {
          return res.status(400).json({ error: 'One or more stock symbols are invalid' });
        }

        stock1.rel_likes = stock1.likes - stock2.likes;
        stock2.rel_likes = stock2.likes - stock1.likes;

        delete stock1.likes;
        delete stock2.likes;

        return res.json({ stockData: [stock1, stock2] });
      }

      return res.status(400).json({ error: 'Invalid stock query' });
    });
};
