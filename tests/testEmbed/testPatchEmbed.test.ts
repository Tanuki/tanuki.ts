import { patch, Tanuki } from "../../src/tanuki";
import { Embedding } from "../../lib/models/embedding";

class Embedder {
  static embedSentiment = patch<Embedding<number>, string>()`Classify input objects`;
  static embedSentiment2 = patch<Embedding<number>, string>()`Classify input objects`;
  static isPositiveSentiment = patch<boolean, string>()`Classify sentiment`;
}
describe('TestEmbedding', () => {
  it('align_embed_sentiment', () => {
    // Assuming embedSentiment returns an Embedding instance
    Tanuki.align((it) => {
      it("Specify how our functions should behave.", (expect) => {
        expect(Embedder.embedSentiment("I love this movie")).not.toEqual(Embedder.embedSentiment("I hate this movie"));
        expect(Embedder.embedSentiment("I love this movie")).toEqual(Embedder.embedSentiment("I love this film"));
        expect(Embedder.embedSentiment("I love this movie")).toEqual(Embedder.embedSentiment("I loved watching the movie"));
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

  it('broken_align_embed_sentiment', () => {
    const embedding = Embedder.embedSentiment("I love this movie");
    expect(embedding).not.toEqual("I hate this movie");
  });

  it('broken_align_symbolic_with_embeddable', () => {
    const embedding = Embedder.embedSentiment("I love this movie");
    const isPositive = Embedder.isPositiveSentiment("I hate this movie");
    expect(embedding).not.toEqual(isPositive);
  });

  it('broken_heterogenous_align', () => {
    const embedding1 = Embedder.embedSentiment("I love this movie");
    const embedding2 = Embedder.embedSentiment2("I hate this movie");
    expect(embedding1).not.toEqual(embedding2);
  });


  it('test_cannot_align_heterogenous', () => {
    expect(() => {
      const embedding1 = Embedder.embedSentiment("I love this movie");
      const embedding2 = Embedder.embedSentiment2("I hate this movie");
      if (embedding1 === embedding2) {
        throw new Error('Invalid comparison between different types of embeddings');
      }
    }).toThrowError();
  });
});

