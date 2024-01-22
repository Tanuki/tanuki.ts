import { patch, Tanuki } from "../../src/tanuki";

// This is an example enum type
export enum Sentiment {
  Good = "Good",
  Bad = "Bad",
}

class Classifier {
  classifySentimentEnum3 = patch<Sentiment, string>()`Classify input objects`;
}
describe('Sentiment Analysis Tests', () => {

  it('test_classify_sentiment_with_enum', async() => {
    const goodInput = "I really really like you";
    const result = await new Classifier().classifySentimentEnum3(goodInput);
    expect(result).toEqual(Sentiment.Good);
  });
});
