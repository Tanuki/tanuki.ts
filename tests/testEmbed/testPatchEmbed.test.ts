import { patch, Tanuki } from "../../src/tanuki";
import { Embedding } from "../../src/models/embedding";

class Embedder {
  static embedSentiment = patch<Embedding<number>, string>()`Classify input objects`;
  static embedSentiment2 = patch<Embedding<number>, string>()`Classify input objects`;
  static isPositiveSentiment = patch<boolean, string>()`Classify sentiment`;
}
describe('TestEmbedding', () => {
  it('align_embed_sentiment', async () => {
    // Assuming embedSentiment returns an Embedding instance
    await Tanuki.align((it) => {
      it("Specify how our functions should behave.", async (expect) => {
        const i_love_embedding = await Embedder.embedSentiment("I love this movie");
        const i_hate_embedding = await Embedder.embedSentiment("I hate this movie");
        const i_love_embedding2 = await Embedder.embedSentiment("I love this film");
        const i_love_watching_embedding = await Embedder.embedSentiment("I loved watching the movie");

        await expect(i_love_embedding).not.toEqual(i_hate_embedding);
        await expect(i_love_embedding).toEqual(i_love_embedding2);
        await expect(i_love_embedding).toEqual(i_love_watching_embedding);
      });
    })
  })

  it('test_data_type', () => {
    const embeddingArray = new Embedding([0, 2, 4]);
    expect(embeddingArray.getData()).toBeInstanceOf(Array);
    const embeddingList = new Embedding([0.0, 2.0, 4.0]);
    expect(embeddingList.getData()).toBeInstanceOf(Array);
    expect(embeddingList.getData().every(item => typeof item === 'number')).toBeTruthy();
  });

  test('broken_align_embed_sentiment', async () => {
    const testFunction = async () => {
      await Tanuki.align((it) => {
        it("broken_align_embed_sentiment", async (expect) => {
          const embedding = await Embedder.embedSentiment("I love this movie");
          await expect(embedding).not.toEqual("I hate this movie");
        });
      });
    };
    await expect(testFunction).rejects.toThrow();
  });

  test('broken_align_symbolic_with_embeddable', async () => {
    const testFunction = async () => {
      await Tanuki.align((it) => {
        it("broken_align_symbolic_with_embeddable", async (expect) => {
          const embedding = await Embedder.embedSentiment("I love this movie");
          const isPositive = await Embedder.isPositiveSentiment("I hate this movie");
          await expect(embedding).not.toEqual(isPositive);
        });
      });
    };
    await expect(testFunction).rejects.toThrow();
  });

  test('test_cannot_align_heterogenous', async () => {
    const testFunction = async () => {
      await Tanuki.align((it) => {
        it("align_heterogenous", async (expect) => {
          const embedding1 = await Embedder.embedSentiment("I love this movie");
          const embedding2 = await Embedder.embedSentiment2("I hate this movie");
          try {
            await expect(embedding1).toEqual(embedding2);
          } catch (error) {
            console.error("Error in it callback:", error);
            throw error;
          }
        });
      });
    };
    await expect(testFunction).rejects.toThrow();
  });

  test('broken_heterogenous_align', async () => {

    const testFunction = async () => {
      await Tanuki.align((it) => {
        it("Specify how our functions should behave.", async (expect) => {
          try {
            const embedding1 = await Embedder.embedSentiment("I love this movie");
            const embedding2 = await Embedder.embedSentiment2("I hate this movie");
            await expect(embedding1).toEqual(embedding2);
          } catch (error) {
            console.error("Error in it callback:", error);
            throw error; // Ensure the error is thrown to the outer scope
          }
        })
      })
    }
    // Use Jest's .toThrow() matcher to expect an error
    await expect(testFunction).rejects.toThrow();
  });
});

