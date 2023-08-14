const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");
const cheerio = require("cheerio");
const axios = require("axios");
const puppeteer = require("puppeteer");
const cron = require("node-cron");
const Product = require("./models/Product");
const Search = require("./models/Search");

require("dotenv").config();
const app = express();

app.use(cors());
app.use(express.json());

app.use(express.static("./build file/build"));

mongoose
  .connect(process.env.MONGO_URL)
  .then(() => {
    console.log("Data based connected! ");
  })
  .catch((error) => console.log(error));

const AMAZON = "https://www.amazon.ca/";
// const WALMART = "https://www.walmart.ca/";
const previousProducts = [];
app.post("/api/scrape", async (req, res) => {
  const { searchItem } = req.body;
  try {
    const browser = await puppeteer.launch();
    const page = await browser.newPage();
    const amazonUrl = `${AMAZON}s?k=${encodeURIComponent(searchItem)}`;
    await page.goto(amazonUrl);
    await page.waitForSelector(`.s-card-container`);

    const products = [];
    const productElements = await page.$$(`.s-card-container`);

    const newSearch = await Search.create({ name: searchItem });

    for (const element of productElements) {
      const nameElement = await element.$(
        ".a-size-base-plus.a-color-base.a-text-normal"
      );
      if (!nameElement) {
        console.log("Name element not found. Skipping...");
        continue;
      }

      const name = await nameElement.evaluate((el) => el.textContent.trim());

      const img = await element.$eval("img.s-image", (img) => img.src);
      const urlHandle = await element.$(`h2 a`);
      const url = await (await urlHandle.getProperty("href")).jsonValue();
      const priceElement = await element.$(".a-price .a-offscreen");
      if (!priceElement) {
        console.log("Price element not found. Skipping...");
        continue;
      }

      const priceText = await priceElement.evaluate((span) => span.textContent);
      const numericPriceText = priceText.replace(/[^0-9.]+/g, "");
      const price = parseFloat(numericPriceText);

      const ratingElement = await element.$(".a-icon-star-small .a-icon-alt");

      if (!ratingElement) {
        console.log("Rating element not found. Skipping...");
        continue;
      }
      const ratingText = await ratingElement.evaluate((el) => el.textContent);
      console.log("Rating:", ratingText);
      const rating = parseFloat(ratingText.split(" ")[0]);

      if (isNaN(price)) {
        console.log("Invalid price. Skipping...");
        continue;
      }

      const newProduct = await Product.create({
        name,
        img,
        url,
        price,
        search: newSearch._id,
        rating,
      });

      console.log("New Product:", newProduct);
      products.push(newProduct);
      previousProducts.push(newProduct);
    }
    await browser.close();
    res.json(products);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

//get all searches
app.get("/api/productText", async (req, res) => {
  try {
    const searches = await Search.find({});
    res.status(200).json(searches);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

//get products relate to a search
app.get("/api/products", async (req, res) => {
  const { id } = req.query; // Use req.query to access query parameters
  try {
    const findSearches = await Search.findById(id);

    if (!findSearches) {
      return res.status(404).json({ error: "Search not found" });
    }

    const products = await Product.find({ search: findSearches._id }).populate(
      "search"
    );

    res.status(200).json(products);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// schedule update
async function scheduleComparison() {
  cron.schedule("* * * * *", async () => {
    console.log("Minutely comparison...");

    for (const product of previousProducts) {
      const response = await axios.get(product.url);
      const $ = cheerio.load(response.data);

      const currentPrice = parseFloat(
        $(".a-price .a-offscreen")
          .text()
          .replace(/[^0-9.-]+/g, "")
      );

      const ratingText = $(".a-icon-star-small .a-icon-alt").text();
      const currentRating = parseFloat(ratingText.split(" ")[0]);

      if (currentPrice !== product.price || currentRating !== product.rating) {
        const priceChange = currentPrice - product.price;
        const priceChangePercentage = (priceChange / product.price) * 100;

        const ratingChange = currentRating - product.rating;

        console.log(
          `Product: ${product.name}`,
          `Price change: ${product.price} -> ${currentPrice}`,
          `Rating change: ${product.rating} -> ${currentRating}`
        );

        product.price = currentPrice;
        product.priceChange = priceChange;
        product.priceChangePercentage = priceChangePercentage;

        product.rating = currentRating;
        product.ratingChange = ratingChange;

        await product.save();
      }
    }
  });
}

app.listen(process.env.PORT || 6991, () => {
  console.log("Runing on port: " + process.env.PORT);
  scheduleComparison();
});
