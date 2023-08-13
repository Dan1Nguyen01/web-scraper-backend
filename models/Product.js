const mongoose = require("mongoose");

const ProductSchema = mongoose.Schema(
  {
    name: {
      type: String,
    },
    img: {
      type: [String],
    },
    url: {
      type: String,
    },
    price: {
      type: Number,
    },
    search: {
      type: Number,
      default: 0,
    },
    priceChange: {
      type: Number,
      default: 0,
    },
    priceChangePercentage: {
      type: Number,
      default: 0,
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model("Product", ProductSchema);
