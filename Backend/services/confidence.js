/* 
Would write the functions for calculating confidence score,
normalization and other ML related stuff here 
*/

// Calculate confidence score for each document
function calculateConfidence(relevanceScore, kbDoc) {
    let successRate = 0;

    if (kbDoc.usageCount > 0) {
        successRate = kbDoc.successCount / kbDoc.usageCount;
    }

    const now = new Date();
    const updatedAt = new Date(kbDoc.updatedAt);

    //recencyScore using time-decay function e^(-l*days_passed),l=0.02
    const daysPassed = Math.floor((now - updatedAt) / (1000 * 60 * 60 * 24));
    const recencyScore = Math.exp(-0.02 * daysPassed);

    const RELEVANCE_WEIGHT = 0.6;
    const SUCCESS_WEIGHT = 0.25;
    const RECENCY_WEIGHT = 0.15;

    const confidenceScore =
        (RELEVANCE_WEIGHT * relevanceScore) +
        (SUCCESS_WEIGHT * successRate) +
        (RECENCY_WEIGHT * recencyScore);

    return Number(confidenceScore.toFixed(3));
}

module.exports = {
    calculateConfidence
};