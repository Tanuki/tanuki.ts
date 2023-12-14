import { patch, align } from '../src';
import assert from "assert";
import AssertionCompiler from "../src/assertionCompiler";

const assertionCompiler = new AssertionCompiler("/Users/jackhopkins/WebstormProjects/tanuki.ts/test");
assertionCompiler.compile();


class SentimentAnalyzer {
  @patch classifySentiment!: (msg: string) => 'Good' | 'Bad' | null;

  @align
  alignClassifySentiment(): void {
    assert(this.classifySentiment("I love you") === 'Good');
    assert(this.classifySentiment("I hate you") === 'Bad');
    assert(this.classifySentiment("People from Phoenix are called Phoenicians") === null);
  }
}

const analyzer = new SentimentAnalyzer();
console.log(analyzer.classifySentiment("I love you")); // Expected output: 'Good'
console.log(analyzer.classifySentiment("I like you")); // Expected output: 'Good'
console.log(analyzer.classifySentiment("Apples might be red")); // Expected output: null

analyzer.alignClassifySentiment();


