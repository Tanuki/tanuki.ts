import { patch, Tanuki } from "../../src/tanuki";

class Classifier {
  classifySentimentLlama3 = patch<"Good" | "Bad" | null, [string, string]>({
    teacherModels: ["llama_70b_chat_aws"],
    generationParams: {
      "max_new_tokens": 10,
    }
  })`Classify input objects`;

  classifySentimentLlama = patch< "Good" | "Bad" | null, string>({
    teacherModels: ["llama_70b_chat_aws"],
    generationParams: {
      "max_new_tokens": 10,
    }
  })`Classify input objects`;
}
const classier = new Classifier();
describe('Sentiment Analysis Tests Llama', () => {

  it('align_classify_sentiment', async () => {
    Tanuki.align(async (it) => {
      it("Specify how our functions should behave.", async (expect) => {
        const iLoveYou = "I love you";
        expect(await classier.classifySentimentLlama3([iLoveYou, "I love woo"])).toEqual('Good');
        expect(await classier.classifySentimentLlama3(["I hate you", "You're disgusting"])).toEqual('Bad');
        expect(await classier.classifySentimentLlama3(["Today is wednesday", "The dogs are running outside"])).toBeNull();

        expect(await classier.classifySentimentLlama("I love you")).toEqual('Good');
        expect(await classier.classifySentimentLlama("I hate you")).toEqual('Bad');
        expect(await classier.classifySentimentLlama("Wednesdays are in the middle of the week")).toBeNull();
      })
    })
  });

  it('test_classify_sentiment_with_llama', async () => {
    const badInput = "I find you awful";
    const goodInput = "I really really like you";
    const goodInput2 = "I adore you";

    expect(await classier.classifySentimentLlama("I am neutral")).toBeNull();

    expect(await classier.classifySentimentLlama("I like you")).toEqual('Good');
    expect(await classier.classifySentimentLlama(badInput)).toEqual('Bad');

    expect(await classier.classifySentimentLlama3([goodInput, goodInput2])).toEqual('Good');
    expect(await classier.classifySentimentLlama3(["I do not like you you", badInput])).toEqual('Bad');
    expect(await classier.classifySentimentLlama3(["I am neutral", "I am neutral too"])).toBeNull();
  }, 240000);
});