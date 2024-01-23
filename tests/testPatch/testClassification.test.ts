import { patch, Tanuki } from "../../src/tanuki";
import { LiteralType } from "typescript";
import { Sentiment } from "../testTypes/testTypes.test";

class Classifier {
  static classifySentiment2 = patch<"Good" | "Bad", [string, string]>()`The sentiment of the input objects`;
  static classifySentiment = patch< "Good" | "Bad", string>()`Classify input objects`;
}
describe('Sentiment Analysis Tests', () => {

  // Assuming tanuki.align functionality is handled within the test itself
  it('align_classify_sentiment', async () => {
    Tanuki.align(async (it) => {
      it("Specify how our functions should behave.", async (expect) => {
        expect(await Classifier.classifySentiment2(["I love you", "I love woo"])).toEqual('Good');
        expect(await Classifier.classifySentiment2(["I hate you", "You're disgusting"])).toEqual('Bad');
        expect(await Classifier.classifySentiment2(["Today is wednesday", "The dogs are running outside"])).toBeNull();

        expect(await Classifier.classifySentiment("I love you")).toEqual('Good');
        expect(await Classifier.classifySentiment("I hate you")).toEqual('Bad');
        expect(await Classifier.classifySentiment("Wednesdays are in the middle of the week")).toBeNull();
      })
    })
  });

  it('test_classify_sentiment', async() => {
    const result = await Classifier.classifySentiment("I like you");
    expect(result).toEqual("Good");
  });
});
