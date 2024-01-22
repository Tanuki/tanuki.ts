import { patch, Tanuki } from "../../src/tanuki";

class Classifier {
  classifySentiment2 = patch<"Good" | "Bad", [string, string]>({
    teacherModels: ["llama_70b_chat_aws"],
    generationParams: {
      "max_tokens": 10,
    }
  })`Classify input objects`;

  classifySentiment = patch< "Good" | "Bad", string>({
    teacherModels: ["llama_70b_chat_aws"],
  })`Classify input objects`;
}
const classier = new Classifier();
describe('Sentiment Analysis Tests', () => {

  it('align_classify_sentiment', () => {
    Tanuki.align((it) => {
      it("Specify how our functions should behave.", (expect) => {
        const iLoveYou = "I love you";
        expect(classier.classifySentiment2([iLoveYou, "I love woo"])).toEqual('Good');
        expect(classier.classifySentiment2(["I hate you", "You're disgusting"])).toEqual('Bad');
        expect(classier.classifySentiment2(["Today is wednesday", "The dogs are running outside"])).toBeNull();

        expect(classier.classifySentiment("I love you")).toEqual('Good');
        expect(classier.classifySentiment("I hate you")).toEqual('Bad');
        expect(classier.classifySentiment("Wednesdays are in the middle of the week")).toBeNull();
      })
    })
  });

  it('test_classify_sentiment', () => {
    const badInput = "I find you awful";
    const goodInput = "I really really like you";
    const goodInput2 = "I adore you";

    expect(classier.classifySentiment("I like you")).toEqual('Good');
    expect(classier.classifySentiment(badInput)).toEqual('Bad');
    expect(classier.classifySentiment("I am neutral")).toBeNull();

    expect(classier.classifySentiment2([goodInput, goodInput2])).toEqual('Good');
    expect(classier.classifySentiment2(["I do not like you you", badInput])).toEqual('Bad');
    expect(classier.classifySentiment2(["I am neutral", "I am neutral too"])).toBeNull();
  });
});
