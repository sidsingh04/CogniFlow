// levenshtein based seaeching, current accepting threshold 80%
// For minor spelling mistakes and typos handling when extracting tags

const levenshtein = require("fast-levenshtein");

function isSimilar(str1, str2, threshold = 0.8) {
    const distance = levenshtein.get(str1, str2);
    const maxLength = Math.max(str1.length, str2.length);
    const similarity = 1 - distance / maxLength;
    return similarity >= threshold;
}

module.exports = {
    isSimilar
};