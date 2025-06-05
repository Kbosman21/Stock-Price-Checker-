'use strict';
const fetch = require('node-fetch');
const crypto = require('crypto');

const stockLikes = {};

module.exports = function (app) {
  app.route('/api/stock-prices').get(async function (req, res) {
    let stockQuery = req.query.stock;
    const like = req.query.like === 'true';

    // Use forwarded IP if available, else fallback to req.ip
    const ipRaw = req.headers['x-forwarded-for']?.split(',')[0] || req.ip;
    const ip = crypto.createHash('sha256').update(ipRaw).digest('hex'); // Anonymize IP

    // Normalize stockQuery to array if single string
    if (typeof stockQuery === 'string') {
      stockQuery = [stockQuery];
    }

    // Helper: fetch stock info and track likes
    const fetchStockData = async (ticker) => {
      try {
        const response = await fetch(`https://stock-price-checker-proxy.freecodecamp.rocks/v1/stock/${ticker}/quote`);
        const data = await response.json();

        if (!data.symbol || typeof data.latestPrice !== 'number') {
          throw new Error('Invalid stock data');
        }

        const symbol = data.symbol.toUpperCase();

        if (!stockLikes[symbol]) {
          stockLikes[symbol] = {
            likes: 0,
            ipList: []
          };
        }

        if (like && !stockLikes[symbol].ipList.includes(ip)) {
          stockLikes[symbol].likes++;
          stockLikes[symbol].ipList.push(ip);
        }

        return {
          stock: symbol,
          price: data.latestPrice,
          likes: stockLikes[symbol].likes
        };
      } catch (err) {
        console.error(`Error fetching stock data for ${ticker}:`, err.message);
        return null;
      }
    };

    if (stockQuery.length === 1) {
      const stockData = await fetchStockData(stockQuery[0].toUpperCase());

      if (!stockData) {
        return res.status(400).json({ error: 'Invalid stock symbol' });
      }

      // Correct: wrap single stock response inside stockData
      return res.json({ stockData });
    }

    if (stockQuery.length === 2) {
      const [stock1, stock2] = await Promise.all([
        fetchStockData(stockQuery[0].toUpperCase()),
        fetchStockData(stockQuery[1].toUpperCase())
      ]);

      if (!stock1 || !stock2) {
        return res.status(400).json({ error: 'One or more stock symbols are invalid' });
      }

      const relLikes1 = stock1.likes - stock2.likes;
      const relLikes2 = stock2.likes - stock1.likes;

      return res.json({
        stockData: [
          {
            stock: stock1.stock,
            price: stock1.price,
            rel_likes: relLikes1
          },
          {
            stock: stock2.stock,
            price: stock2.price,
            rel_likes: relLikes2
          }
        ]
      });
    }

    return res.status(400).json({ error: 'Invalid stock query' });
  });
};
