import { patch, Tanuki } from "../../src/tanuki";

class ClassifierSentiment {
  static classifySentimentPair = patch<"Good" | "Bad", [string, string]>()
      `Classify a list of input objects into a single Good, Bad, or null sentiment`;

  static classifySentiment = patch< "Good" | "Bad", string>()
      `Classify input objects`;
}
describe('Sentiment Analysis Tests', () => {

  // Assuming tanuki.align functionality is handled within the test itself
  it('align_classify_sentiment', async () => {
    await Tanuki.align(async (it) => {
      it("Specify how our functions should behave.", async (expect) => {
        await expect(await ClassifierSentiment.classifySentimentPair(["I love you", "I love woo"])).toEqual('Good');
        expect(await ClassifierSentiment.classifySentimentPair(["I hate you", "You're disgusting"])).toEqual('Bad');
        expect(await ClassifierSentiment.classifySentimentPair(["Today is wednesday", "The dogs are running outside"])).toBeNull();

        expect(await ClassifierSentiment.classifySentiment("I love you")).toEqual('Good');
        expect(await ClassifierSentiment.classifySentiment("I hate you")).toEqual('Bad');
        expect(await ClassifierSentiment.classifySentiment("Wednesdays are in the middle of the week")).toBeNull();
      })
    })
  });

  it('test_classify_sentiment', async() => {
    const result = await ClassifierSentiment.classifySentiment("I like you");
    expect(result).toEqual("Good");
  });
});
