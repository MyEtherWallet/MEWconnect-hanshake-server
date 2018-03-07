module.exports = {
  bufferToConnId: function (buf) {
    return buf.toString("hex").slice(32);
  },

  keyToConnId: function (key) {
    return key.slice(32)
  },
  logger: function (tag, content) {
    if (!content) {
      console.log(tag);
    } else {
      console.log(tag, content)
    }

  }
};



