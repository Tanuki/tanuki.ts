import { patch, Tanuki } from "../../src/tanuki";

class TogetherSentimentClassifier {
    static classifySentiment2 = patch<"Good" | "Bad" | null, [string, string]>({
        teacherModels: ["openchat-3.5"],
        generationParams: {
            "max_new_tokens": 10,
        }
    })`Determine if the inputs are positive or negative sentiment, or None`;

    static classifySentiment = patch<"Good" | "Bad" | null, string>({
        teacherModels: ["openchat-3.5"],
        generationParams: {
            "max_new_tokens": 10,
        }
    })`Determine if the input is positive or negative sentiment`;
}

describe('Sentiment Analysis Tests for OpenChat', () => {

    it('align_classify_sentiment', async () => {
        Tanuki.align(async (it) => {
            it("Specify how our functions should behave.", async (expect) => {
                const iLoveYou = "I love you";
                expect(await TogetherSentimentClassifier.classifySentiment2([iLoveYou, "I love woo"])).toEqual('Good');
                expect(await TogetherSentimentClassifier.classifySentiment2(["I hate you", "You're disgusting"])).toEqual('Bad');
                expect(await TogetherSentimentClassifier.classifySentiment2(["Today is Wednesday", "The dogs are running outside"])).toBeNull();

                expect(await TogetherSentimentClassifier.classifySentiment("I love you")).toEqual('Good');
                expect(await TogetherSentimentClassifier.classifySentiment("I hate you")).toEqual('Bad');
                expect(await TogetherSentimentClassifier.classifySentiment("Wednesdays are in the middle of the week")).toBeNull();
            });
        });
    });

    it('test_classify_sentiment_with_openchat', async () => {
        const badInput = "I find you awful";
        const goodInput = "I really really like you";
        const goodInput2 = "I adore you";

        expect(await TogetherSentimentClassifier.classifySentiment("I am neutral")).toBeNull();

        expect(await TogetherSentimentClassifier.classifySentiment("I like you")).toEqual('Good');
        expect(await TogetherSentimentClassifier.classifySentiment(badInput)).toEqual('Bad');

        expect(await TogetherSentimentClassifier.classifySentiment2([goodInput, goodInput2])).toEqual('Good');
        expect(await TogetherSentimentClassifier.classifySentiment2(["I do not like you", badInput])).toEqual('Bad');
        expect(await TogetherSentimentClassifier.classifySentiment2(["I am neutral", "I am neutral too"])).toBeNull();
    }, 240000); // Increase timeout if necessary
});
