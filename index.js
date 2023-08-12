const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");
const cheerio = require("cheerio");

const app = express();

app.use(cors());
