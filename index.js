const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");
const cheerio = require("cheerio");
const axios = require("axios");

require("dotenv").config();
const app = express();

app.use(cors());
app.use(express.json());
mongoose
  .connect(process.env.MONGO_URL)
  .then(() => {
    console.log("Data based connected! ");
  })
  .catch((error) => console.log(error));

const AMAZON = "https://www.amazon.ca/";
const previousProducts = [];
app.post("/api/scrape", async (req, res) => {
  const { searchItem } = req.body;
  try {
    const response = await axios.get(
      `${AMAZON}s?k=${encodeURIComponent(searchItem)}`
    );
    const $ = cheerio.load(response.data);

    const products = [];
    $(`.s-card-container`).each(async function () {
      const name = $(this).find("h2 a span").text();
      const img = $(this).find("img.s-image").attr("src");
      const url = $(this).find(`h2 a`).attr("href");
      const priceText = $(this).find(".a-price .a-offscreen").text();

      // Extract numeric portion from priceText
      const numericPriceText = priceText.replace(/[^0-9.]+/g, "");

      // Ensure numericPriceText is not empty
      if (numericPriceText) {
        const price = parseFloat(numericPriceText);
        console.log(price);
        // Check if price is a valid number
        if (!isNaN(price)) {
          const existingProduct = previousProducts.find(
            (product) => product.name === name
          );
          if (!existingProduct) {
            const newProduct = await Product.create({
              name,
              img,
              url: AMAZON + url,
              price,
            });

            products.push(newProduct);
            previousProducts.push(newProduct);
          }
        } else {
          console.log("it stopped");
        }
      }
    });

    res.json(products);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

const cron = require("node-cron");
const Product = require("./models/Product");

async function scheduleComparison() {
  cron.schedule("0 * * * *", async () => {
    console.log("Running hourly comparison...");

    for (const product of previousProducts) {
      const response = await axios.get(product.url);
      const $ = cheerio.load(response.data);
      const currentPrice = parseFloat(
        $(".a-price .a-offscreen")
          .text()
          .replace(/[^0-9.-]+/g, "")
      );

      if (currentPrice !== product.price) {
        const priceChange = currentPrice - product.price;
        const priceChangePercentage = (priceChange / product.price) * 100;
        console.log(
          `Price change for ${product.name}: ${product.price} -> ${currentPrice}`
        );
        // Update the product's data
        product.price = currentPrice;
        product.priceChange = priceChange;
        product.priceChangePercentage = priceChangePercentage;

        // MongoDB's _id field has a built-in timestamp
        product.save(); // This will update the existing document with new data
      }
    }
  });
}
app.listen(process.env.PORT || 6991, () => {
  console.log("Runing on port: " + process.env.PORT);
  scheduleComparison();
});
