// levenshtein based seaeching, current accepting threshold 80%
// For minor spelling mistakes and typos handling when extracting tags

const levenshtein = require("fast-levenshtein");

function isSimilar(str1, str2, threshold = 0.8) {
    const distance = levenshtein.get(str1, str2);
    const maxLength = Math.max(str1.length, str2.length);
    const similarity = 1 - distance / maxLength;
    return similarity >= threshold;
}

// Jaccard similarity for tags-matching
function jaccardSimilarity(setA, setB) {
    if (!setA || !setB) return 0;
    const a = new Set(setA.map(t => t.toLowerCase()));
    const b = new Set(setB.map(t => t.toLowerCase()));
    if (a.size === 0 && b.size === 0) return 1; // both empty = perfect match
    if (a.size === 0 || b.size === 0) return 0;
    let intersection = 0;
    for (const item of a) {
        if (b.has(item)) intersection++;
    }
    const union = new Set([...a, ...b]).size;
    return intersection / union;
}


module.exports = {
    isSimilar,
    jaccardSimilarity
};