import { Embedding } from '../src/models/embedding';
import { patch, Tanuki } from "../src/tanuki";

describe('TestPatchFunctionCompiler', () => {

  it('test_patch_compiler', () => {
    const tanuki = new Tanuki()

    type StringAlias = string;

// Enum
    enum Status {
      Active,
      Inactive,
      Unknown
    }

    enum Sentiment {
      Positive,
      Negative,
      Neutral
    }

// Interface with various property types
    interface User {
      id: number;
      name: StringAlias; // Using type alias
      status: Status; // Using enum
      contact: {
        email: string;
        phone?: string; // Optional property
      };
      roles: string[]; // Array type
      settings: Record<string, any>; // Record type
      lastLogin: Date | null; // Union type
      extraInfo: any; // Any type
    }

// Generic type
    type Response<T> = {
      data: T;
      error: string | null;
    };

// Type alias using generics and union
    type UserResponse = Response<User> | {
      data: null;
      error: string
    };

    type StringType = string;
    type Input = {
      msg: StringType
    };

    class SentimentAnalyzer2 {
      static getSentiment = patch<Sentiment, Input>({ignoreFinetuneFetching: true})
          `Evaluate the sentiment of a statement provided`;

      static doubleNumber = patch<number, number>()`Double the input number`;

      static isActive = patch<Status, string>()`Check if the string is active`;

      static getEmbedding = patch<Embedding<number>, Input>()
          `Get the embedding of a statement provided`;
    }


    (async () => {
      const active = await SentimentAnalyzer2.isActive('active');
      console.log(active)
      const doubled = await SentimentAnalyzer2.doubleNumber(2);
      console.log(doubled);
      const sentiment: Sentiment = await SentimentAnalyzer2.getSentiment({msg: 'This is good'});
      console.log(sentiment);
      // Rest of your async code
    })().catch(err => console.error(err));


    const result: Promise<Sentiment> = SentimentAnalyzer2.getSentiment({msg: 'This is good'});
//const resultEmbedding: Embedding<number> = SentimentAnalyzer.getEmbedding({msg: 'This is good'});
    console.log(result);

    void SentimentAnalyzer2.getSentiment({msg: 'This is good'}).then((result) => {
      console.log(result);
      return result;
    });
    Tanuki.align((it) => {
      it("should evaluate clearly true statements as true", (expect) => {
        expect(SentimentAnalyzer2.getSentiment({msg: 'This is good'})).toMatchObject({
          data: {
            name: 'This is good',
          }
        })
        expect(
            SentimentAnalyzer2.getEmbedding({msg: 'This is good'})
        ).toEqual(
            SentimentAnalyzer2.getEmbedding({msg: 'This is great'})
        )
        expect(SentimentAnalyzer2.getSentiment({msg: 'This is good'})).toEqual({
          data: {
            name: 'This is good',
          }
        })
      })
    })
  });
});
