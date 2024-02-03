import { patch, Tanuki } from "../../src/tanuki";
import { Embedding } from "../../src/models/embedding";

class PatchEmbedder {
  static embedSentiment = patch<Embedding<number>, string>()`Movie sentiment`;
  static embedSentiment2 = patch<Embedding<number>, string>()`Other movie sentiment`;
  static isPositiveSentiment = patch<boolean, string>()`Classify sentiment`;
}
describe('TestEmbedding', () => {
  it('align_embed_sentiment', async () => {
    // Assuming embedSentiment returns an Embedding instance
    await Tanuki.align((it) => {
      it("Specify how our functions should behave.", async (expect) => {
        const i_love_embedding = await PatchEmbedder.embedSentiment("I love this movie");
        const i_hate_embedding = await PatchEmbedder.embedSentiment("I hate this movie");
        const i_love_embedding2 = await PatchEmbedder.embedSentiment("I love this film");
        const i_love_watching_embedding = await PatchEmbedder.embedSentiment("I loved watching the movie");

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
          const embedding = await PatchEmbedder.embedSentiment("I love this movie");
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
          const embedding = await PatchEmbedder.embedSentiment("I love this movie");
          const isPositive = await PatchEmbedder.isPositiveSentiment("I hate this movie");
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
          const embedding1 = await PatchEmbedder.embedSentiment("I love this movie");
          const embedding2 = await PatchEmbedder.embedSentiment2("I hate this movie");
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
            const embedding1 = await PatchEmbedder.embedSentiment("I love this movie");
            const embedding2 = await PatchEmbedder.embedSentiment2("I hate this movie");
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

