import { patch, align } from '../src';
import { Tanuki } from '../src/tanuki';
import {Embedding} from "../src/models/embedding";

new Tanuki()

type StringAlias = string;

// Enum
enum Status {
  Active,
  Inactive,
  Unknown
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
  static getSentiment = patch<UserResponse, Input>({ ignoreFinetuneFetching: true })`
    Evaluate the sentiment of a statement provided
  `;
  /*static getEmbedding = patch<Embedding<number>, Input>()`
    Get the embedding of a statement provided
  `;*/
}

const result: UserResponse = SentimentAnalyzer.getSentiment({msg: 'This is good'});
//const resultEmbedding: Embedding<number> = SentimentAnalyzer.getEmbedding({msg: 'This is good'});
console.log(result);
