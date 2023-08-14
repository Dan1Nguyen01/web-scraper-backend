const mongoose = require("mongoose");

const SearchSchema = mongoose.Schema(
  {
    name: {
      type: String,
    },

    tracked: {
      type: Boolean,
      default: true,
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model("Search", SearchSchema);
