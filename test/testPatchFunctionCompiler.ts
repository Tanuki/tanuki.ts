import { Tanuki, patch } from '../src/tanuki';
import {Embedding} from "../src/models/embedding";

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
type UserResponse = Response<User> | { data: null; error: string };

type StringType = string;
type Input = { msg: StringType };

class SentimentAnalyzer {
  static doubleNumber = patch<number, number>()`Double the input number`;

  static getSentiment = patch<Sentiment, Input>({ ignoreFinetuneFetching: true })
    `Evaluate the sentiment of a statement provided`;

  static getEmbedding = patch<Embedding<number>, Input>()
    `Get the embedding of a statement provided`;
}

const doubledNumber: number = SentimentAnalyzer.doubleNumber(2);

console.log(doubledNumber);

const result: Sentiment = SentimentAnalyzer.getSentiment({msg: 'This is good'});
//const resultEmbedding: Embedding<number> = SentimentAnalyzer.getEmbedding({msg: 'This is good'});
console.log(result);

Tanuki.align((it) => {
  it("should evaluate clearly true statements as true", (expect) => {
    expect(SentimentAnalyzer.getSentiment({ msg: 'This is good' })).toMatchObject({
      data: {
        name: 'This is good',
      }
    })

    expect(
      SentimentAnalyzer.getEmbedding({ msg: 'This is good' })
    ).toEqual(
      SentimentAnalyzer.getEmbedding({ msg: 'This is great' })
    )

    expect(SentimentAnalyzer.getSentiment({ msg: 'This is good' })).toEqual({
      data: {
        name: 'This is good',
      }
    })
  })
})
