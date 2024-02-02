# Tanuki <span style="font-family:Papyrus; font-size:2em;">🦝</span> ![Discord](https://img.shields.io/discord/1168948553222197248) [![codecov](https://codecov.io/gh/Tanuki/tanuki.ts/branch/main/graph/badge.svg?token=b169ecba-fa1c-43ee-a9e0-18597d2aaffa)](https://codecov.io/gh/Tanuki/tanuki.ts)

Build LLM-powered apps that get cheaper and faster over time.

---

## Release
[25/1] Initial Typescript Release in line with the [Python release](https://github.com/Tanuki/tanuki.py).

[27/11] Renamed MonkeyPatch to Tanuki, support for [embeddings](https://github.com/monkeypatch/tanuki.py/blob/update_docs/docs/embeddings_support.md) and [function configurability](https://github.com/monkeypatch/tanuki.py/blob/update_docs/docs/function_configurability.md) is released!
* Use embeddings to integrate Tanuki with downstream RAG implementations using OpenAI Ada-2 model.
*  Function configurability allows to configure Tanuki function executions to ignore certain implemented aspects (finetuning, data-storage communications) for improved latency and serverless integrations.

Join us on [Discord](https://discord.gg/uUzX5DYctk)

## Contents

<!-- TOC start (generated with https://github.com/derlin/bitdowntoc) -->
* [Introduction](#introduction)
* [Features](#features)
* [Installation and Getting Started](#installation-and-getting-started)
* [How It Works](#how-it-works)
* [Typed Outputs](#typed-outputs)
* [Test-Driven Alignment](#test-driven-alignment)
* [Scaling and Finetuning](#scaling-and-finetuning)
* [Frequently Asked Questions](#frequently-asked-questions)
* [Simple ToDo List App](#simple-todo-list-app)

<!-- TOC end -->
<!-- TOC --><a name="introduction"></a>
## Introduction

Tanuki.ts is a way to easily call an LLM in place of the function body in Typescript, with the same parameters and output that you would expect from a function implemented by hand.

These LLM-powered functions are well-typed, reliable, stateless, and production-ready to be dropped into your app seamlessly. Rather than endless prompt-wrangling and nasty surprises, these LLM-powered functions and applications behave like traditional functions with proper error handling.

Lastly, the more you use Tanuki functions, the cheaper and faster they gets (up to 9-10x!) through automatic model distillation.

```typescript
/**
 * Declare the function that you want Tanuki to provide.
 */
class Functions {
  static someFunction = patch<TypedOutput, TypedInput>()
      `{The instruction that your function will execute}`;
}

/**
 * Align your function to the expected behaviour using Jest-like assertions
 */
Tanuki.align(async (it) => {
  it("should correctly classify positive affirmation", async (expect) => {
    const exampleTypedInput: TypedInput = "I love you";
    const exampleTypedOutput: TypedOutput = "Good";
    const result = await Functions.someFunction(exampleTypedInput);
    expect(result).toEqual(exampleTypedOutput);
  });
});
```

<!-- TOC --><a name="features"></a>
## Features

- **Easy and seamless integration** - Add LLM augmented functions to any workflow within seconds. Create a function with inline `patch` syntax, with types and docstrings to guide the execution. That’s it.
- **Type aware** - Ensure that the outputs of the LLM adhere to the type constraints of the function (arbitrary Types, Literals, Generics etc) to guard against bugs or unexpected side-effects of using LLMs.
- **RAG support** - Get embedding outputs for downstream RAG (Retrieval Augmented Generation) implementations. Output embeddings can then be easily stored and used for relevant document retrieval to reduce cost & latency and improve performance on long-form content.
- **Aligned outputs** - LLMs are unreliable, which makes them difficult to use in place of classically programmed functions. Using simple jest-like `expect` syntax in a `Tanuki.align` block, you can align the behaviour of your patched function to what you need.
- **Lower cost and latency** - Achieve up to 90% lower cost and 80% lower latency with increased usage. The package will take care of model training, MLOps and DataOps efforts to improve LLM capabilities through distillation.
- **Batteries included** - No remote dependencies other than your model provider (OpenAI / AWS Bedrock).

<!-- TOC --><a name="installation-and-getting-started"></a>
## Installation and Getting Started
<!-- TOC --><a name="installation"></a>

### Installation
```bash
npm install tanuki.ts
```

Set your OpenAI / AWS key in your `.env` file or export your key as an environment variable:

```
// for OpenAI
export OPENAI_API_KEY=sk-...

// for AWS Bedrock
export AWS_SECRET_ACCESS_KEY=...
export AWS_ACCESS_KEY_ID=...
```

#### Default Setup
Next, we need to install the Tanuki type transformer. This will allow Tanuki to be aware of your patched functions and types at runtime, as these types are erased when transpiling into Javascript.
```typescript
npm install ts-patch --save-dev
npx ts-patch install
```

Next, you need to add the Tanuki transformer to your `tsconfig.json` file:

```json
{
  "compilerOptions": {
    "plugins": [
      {
        "transform": "tanuki.ts/tanukiTransformer"
      }
    ]
  }
}
```

#### Next.js Setup
As Next.js has it's own build system, you must explicitly add the Tanuki transformer to your `package.json` file instead by adding the following scripts.

```json
{
  "scripts": {
    "predev": "tanuki-type-compiler",
    "prebuild": "tanuki-type-compiler",
    "prestart": "tanuki-type-compiler"
  }
}
```

This will ensure that Tanuki can extract your patched functions before the Next.js build process.


<!-- TOC --><a name="getting-started"></a>
### Getting Started

To get started:
1. Create a `patch` function stub as a static member of a class, including your input and output types, and an instruction.
2. (Optional) Create jest-like equivalent assertions in a `Tanuki.align` block, declaring the expected behaviour of your patched function with different inputs.

Once you have built your code (to make Tanuki aware of your types), the `patch` function will be registered and can be invoked as normal.

Your `align` block must also be called if:
- It is the first time calling the patched function (including any updates to the function signature, i.e docstring, input arguments, input type hints, naming or the output type hint)
- You have made changes to your desired behaviour.

Here is what it could look like for a simple classification function:

```typescript
// Assuming TypedOutput is a union type of 'Good', 'Bad', or null
type Sentiment = 'Good' | 'Bad' | null;

// TypedInput is assumed to be a string
type Message = string;

/**
 * Declare the function that you want Tanuki to provide.
 */
class Functions {
  static classifySentiment = patch<Sentiment, Message>()
      `Classifies message from the user based on sentiment`;
}

/**
 * Align your function to the expected behavior using Jest-like assertions.
 */
Tanuki.align(async (it) => {
  it("alignClassifySentiment", async (expect) => {
    expect(await Functions.classifySentiment("I love you")).toEqual('Good');
    expect(await Functions.classifySentiment("I hate you")).toEqual('Bad');
    expect(await Functions.classifySentiment("People from Phoenix are called Phoenicians")).toBeNull();
  });
});

// Example usage of the patched function somewhere else in your code
const runExamples = async () => {
  console.log(await Functions.classifySentiment("I like you")); // Expect 'Good' or null
  console.log(await Functions.classifySentiment("Apples might be red")); // Expect null
};

runExamples();
```

<!-- TOC --><a name="how-it-works"></a>

See [here](https://github.com/monkeypatch/tanuki.py/blob/update_docs/docs/function_configurability.md) for configuration options for patched Tanuki functions

## How It Works

When you call a Tanuki-patched function during development, an LLM in a n-shot configuration is invoked to generate the typed response.

The number of examples used is dependent on the number of align statements supplied in functions annotated with the align decorator.

The response will be post-processed and the supplied output type will be programmatically instantiated ensuring that the correct type is returned.

This response can be passed through to the rest of your app / stored in the DB / displayed to the user.

Make sure to execute all align functions at least once before running your patched functions to ensure that the expected behaviour is registered. These are cached onto the disk for future reference.

The inputs and outputs of the function will be stored during execution as future training data.
As your data volume increases, smaller and smaller models will be distilled using the outputs of larger models.

The smaller models will capture the desired behaviour and performance at a lower computational cost, lower latency and without any MLOps effort.

<!-- TOC --><a name="typed-outputs"></a>
## Typed Outputs

LLM API outputs are typically in natural language. In many instances, it’s preferable to have constraints on the format of the output to integrate them better into workflows.

A core concept of Tanuki is the support for typed parameters and outputs. Supporting typed outputs of patched functions allows you to declare *rules about what kind of data the patched function is allowed to pass back* for use in the rest of your program. This will guard against the verbose or inconsistent outputs of the LLMs that are trained to be as “helpful as possible”.

The types you provide the patched functions act as guard-rails for the model preventing a patched function breaking the code or downstream workflows, and means you can avoid having to write custom validation logic in your application.

```typescript
// Define the ActionItem class
class ActionItem {
  goal: string;
  deadline: Date;

  constructor(goal: string, deadline: Date) {
    this.goal = goal;
    this.deadline = deadline;
  }
}

// Assuming we have a similar setup for the patch and align methods
class Functions {
  actionItems = patch<ActionItem[], string>()`Generate a list of Action Items`;
}

// Define the alignment for the actionItems method
Tanuki.align(async (it) => {
  it("alignActionItems", async (expect) => {
    const goal = "Can you please get the presentation to me by Tuesday?";
    const nextTuesday = new Date();
    nextTuesday.setDate(nextTuesday.getDate() + ((1 - nextTuesday.getDay() + 7) % 7));
    nextTuesday.setHours(0, 0, 0, 0);

    const expectedActionItem = new ActionItem("Prepare the presentation", nextTuesday);
    const result = await new Functions().actionItems(goal);
    
    // Assuming the result is an array of ActionItems
    expect(result[0]).toEqual(expectedActionItem);
  });
});
```

By constraining the types of data that can pass through your patched function, you are declaring the potential outputs that the model can return and specifying the world where the program exists in.

You can add integer constraints using union types.

```typescript
type ZeroToNine = 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9;

class Functions {
  scoreSentiment = patch<ZeroToNine, string>()`Scores the input between 0-9`;
}

// Define the alignment for the scoreSentiment method
Tanuki.align(async (it) => {
  it("alignScoreSentiment", async (expect) => {
    expect(await new Functions().scoreSentiment("I love you")).toBe(9);
    expect(await new Functions().scoreSentiment("I hate you")).toBe(0);
    expect(await new Functions().scoreSentiment("You're okay I guess")).toBe(5);
  });
});

// Example test using Jest
describe('testScoreSentiment', () => {
  it('should return a score >= 7 for positive sentiment', async () => {
    const score = await new Functions().scoreSentiment("I like you");
    expect(score).toBeGreaterThanOrEqual(7);
  });
});
```

<!--To see more examples using Tanuki for different use cases (including how to integrate with FastAPI), have a look at [examples](https://github.com/monkeypatch/tanuki.py/tree/master/examples).-->

For embedding outputs for RAG support, see [here](https://github.com/monkeypatch/tanuki.py/blob/update_docs/docs/embeddings_support.md)

<!-- TOC --><a name="test-driven-alignment"></a>
## Test-Driven Alignment

In classic [test-driven development (TDD)](https://en.wikipedia.org/wiki/Test-driven_development), the standard practice is to write a failing test before writing the code that makes it pass.

Test-Driven Alignment (TDA) adapts this concept to align the behavior of a patched function with an expectation defined by a test.

To align the behaviour of your patched function to your needs, decorate a function with `@align` and assert the outputs of the function with the ‘assert’ statement as is done with standard tests.

```typescript
import { Finance } from './finance';
import { Tanuki } from 'tanuki.ts';

Tanuki.align((it) => {
    it("should extract company names whose stock is increasing", async (expect) => {
        const input1 = "Consumer spending makes up a huge fraction of the overall economy. Investors are therefore always looking at consumers to try to gauge whether their financial condition remains healthy. That's a big part of why the stock market saw a bear market in 2022, as some feared that a consumer-led recession would result in much weaker business performance across the sector.\nHowever, that much-anticipated recession hasn't happened yet, and there's still plenty of uncertainty about the future direction of consumer-facing stocks. A pair of earnings reports early Wednesday didn't do much to resolve the debate, as household products giant Procter & Gamble (PG 0.13%) saw its stock rise even as recreational vehicle manufacturer Winnebago Industries (WGO 0.58%) declined.";
        expect(await Finance.extractStockWinnersVol6(input1)).toEqual(["Procter & Gamble"]);
    })
})
```

By writing a test that encapsulates the expected behaviour of the tanuki-patched function, you declare the contract that the function must fulfill. This enables you to:

1. **Verify Expectations:** Confirm that the function adheres to the desired output.
2. **Capture Behavioural Nuances:** Make sure that the LLM respects the edge cases and nuances stipulated by your test.
3. **Develop Iteratively:** Refine and update the behavior of the tanuki-patched function by declaring the desired behaviour as tests.

Unlike traditional TDD, where the objective is to write code that passes the test, TDA flips the script: **tests do not fail**. Their existence and the form they take are sufficient for LLMs to align themselves with the expected behavior.

TDA offers a lean yet robust methodology for grafting machine learning onto existing or new Typescript codebases.

<!-- TOC --><a name="scaling-and-finetuning"></a>
## Scaling and Finetuning

An advantage of using Tanuki in your workflow is the cost and latency benefits that will be provided as the number of datapoints increases.

Successful executions of your patched function suitable for finetuning will be persisted to a training dataset, which will be used to distil smaller models for each patched function. Model distillation and pseudo-labelling is a verified way how to cut down on model sizes and gain improvements in latency and memory footprints while incurring insignificant and minor cost to performance (https://arxiv.org/pdf/2305.02301.pdf, https://arxiv.org/pdf/2306.13649.pdf, https://arxiv.org/pdf/2311.00430.pdf, etc).

Training smaller function-specific models and deploying them is handled by the Tanuki library, so the user will get the benefits without any additional MLOps or DataOps effort. Currently only OpenAI GPT style models are supported (Teacher - GPT4, Student GPT-3.5)

We tested out model distillation using Tanuki using OpenAI models on Squad2, Spider and IMDB Movie Reviews datasets. We finetuned the gpt-3.5-turbo model (student) using few-shot responses of gpt-4 (teacher) and our preliminary tests show that using less than 600 datapoints in the training data we were able to get gpt 3.5 turbo to perform essentialy equivalent (less than 1.5% of performance difference on held-out dev sets) to gpt4 while achieving up to 12 times lower cost and over 6 times lower latency (cost and latency reduction are very dependent on task specific characteristics like input-output token sizes and align statement token sizes). These tests show the potential in model-distillation in this form for intelligently cutting costs and lowering latency without sacrificing performance.<br><br>

![Example distillation results](https://github.com/monkeypatch/tanuki.py/assets/113173969/2ac4c2fd-7ba6-4598-891d-6aa2c85827c9)


<!-- TOC --><a name="frequently-asked-questions"></a>
## Frequently Asked Questions


<!-- TOC --><a name="intro"></a>
### Intro
<!-- TOC --><a name="what-is-tanuki-in-plain-words"></a>
#### What is Tanuki in plain words?
Tanuki is a simple and seamless way to create LLM augmented functions in Typescript and Python, which ensure the outputs of the LLMs follow a specific structure. Moreover, the more you call a patched function, the cheaper and faster the execution gets.

<!-- TOC --><a name="how-does-this-compare-to-other-frameworks-like-langchain"></a>
#### How does this compare to other frameworks like LangChain?
- **Langchain**: Tanuki has a narrower scope than Langchain. Our mission is to ensure predictable and consistent LLM execution, with automatic reductions in cost and latency through finetuning.
- **Magentic** / **Marvin**: Tanuki offers two main benefits compared to Magentic/Marvin, namely; lower cost and latency through automatic distillation, and more predictable behaviour through test-driven alignment. Currently, there are two cases where you should use Magentic, namely: where you need support for tools (functions) - a feature that is on our roadmap, and where you need support for asynchronous functions.


<!-- TOC --><a name="what-are-some-sample-use-cases"></a>
#### What are some sample use-cases?
We've created a few examples to show how to use Tanuki for different problems. You can find them [here](https://github.com/monkeypatch/tanuki.py/tree/master/examples).
A few ideas are as follows:
- Adding an importance classifier to customer requests
- Creating a offensive-language classification feature
- Creating a food-review app
- Generating data that conforms to your DB schema that can immediately

<!-- TOC --><a name="why-would-i-need-typed-responses"></a>
#### Why would I need typed responses?
When invoking LLMs, the outputs are free-form. This means that they are less predictable when used in software products. Using types ensures that the outputs adhere to specific constraints or rules which the rest of your program can work with.

<!-- TOC --><a name="do-you-offer-this-for-other-languages-eg-typescript"></a>
#### Do you offer this for other languages (eg Typescript)?
Not right now but reach out on [our Discord server](https://discord.gg/kEGS5sQU) or make a Github issue if there’s another language you would like to see supported.

<!-- TOC --><a name="getting-started-1"></a>
### Getting Started
<!-- TOC --><a name="how-do-i-get-started"></a>
#### How do I get started?
Follow the instructions in the [Installation and getting started]() and [How it works]() sections

<!-- TOC --><a name="how-do-i-align-my-functions"></a>
#### How do I align my functions?
See [How it works]() and [Test-Driven Alignment]() sections or the examples shown [here](https://github.com/monkeypatch/tanuki.py/tree/master/examples).


<!-- TOC --><a name="do-i-need-my-own-openai-key"></a>
#### Do I need my own OpenAI key?
Yes

<!-- TOC --><a name="does-it-only-work-with-openai"></a>
#### Does it only work with OpenAI?
Bedrock is also supported to give access Anthropic and popular open-source models like Llama2. If you have a specific request, either join [our Discord server](https://discord.gg/kEGS5sQU), or create a Github issue.

<!-- TOC --><a name="how-it-works-1"></a>
### How It Works
<!-- TOC --><a name="how-does-the-llm-get-cheaper-and-faster-over-time-and-by-how-much"></a>
#### How does the LLM get cheaper and faster over time? And by how much?
In short, we distill LLM models.

Using the outputs of the larger (teacher) model, a smaller (student) model will be trained to emulate the teacher model behaviour while being faster and cheaper to run due to smaller size. In some cases it is possible to achieve up to 90% lower cost and 80% lower latency with a small number of executions of your patched functions.
<!-- TOC --><a name="how-many-calls-does-it-require-to-get-the-improvement"></a>
#### How many calls does it require to get the improvement?
The default minimum is 200 calls, although this can be changed by adding flags to the patch decorator.
<!-- TOC --><a name="can-i-link-functions-together"></a>
#### Can I link functions together?
Yes! It is possible to use the output of one patched function as the input to another patched function. Simply carry this out as you would do with normal python functions.
<!-- TOC --><a name="does-fine-tuning-reduce-the-performance-of-the-llm"></a>
#### Does fine-tuning reduce the performance of the LLM?
Not necessarily. Currently the only way to improve the LLM performance is to have better align statements. As the student model is trained on both align statements and input-output calls, it is possible for the fine tuned student model to exceed the performance of the N-shot teacher model during inference.


<!-- TOC --><a name="accuracy-reliability"></a>
### Accuracy & Reliability
<!-- TOC --><a name="how-do-you-guarantee-consistency-in-the-output-of-patched-functions"></a>
#### How do you guarantee consistency in the output of patched functions?
Each output of the LLM will be programmatically instantiated into the output class or type. If the output is incorrect and instantiating the correct output object fails, an automatic feedback repair loop kicks in to correct the mistake.
<!-- TOC --><a name="how-reliable-are-the-typed-outputs"></a>
#### How reliable are the typed outputs?
For simpler-medium complexity classes GPT4 with align statements has been shown to be very reliable in outputting the correct type. Additionally we have implemented a repair loop with error feedback to “fix” incorrect outputs and add the correct output to the training dataset.
<!-- TOC --><a name="how-do-you-deal-with-hallucinations"></a>
#### How do you deal with hallucinations?
Hallucinations can’t be 100% removed from LLMs at the moment, if ever. However, by creating `expect` declarations (like in Jest) inside `Tanuki.align` blocks, you can align the model to behave in the way that you expect to minimize hallucations.
<!-- TOC --><a name="how-do-you-deal-with-bias"></a>
#### How do you deal with bias?
By adding more align statements that cover a wider range of inputs, you can ensure that the model is less biased.
<!-- TOC --><a name="will-distillation-impact-performance"></a>
#### Will distillation impact performance?
It depends. For tasks that are challenging for even the best models (e.g GPT4), distillation will reduce performance.
However, distillation can be manually turned off in these cases. Additionally, if the distilled model frequently fails to generate correct outputs, the distilled model will be automatically turned off.

<!-- TOC --><a name="what-is-this-not-suitable-for"></a>
#### What is this not suitable for?
- Time-series data
- Tasks that requires a lot of context to completed correctly
- For tasks that directly output complex natural language, you will get less value from Tanuki and may want to consider the OpenAI API directly.

---

<!-- TOC --><a name="simple-todo-list-app"></a>
## [Simple ToDo List App](https://github.com/monkeypatch/tanuki.py/tree/master/examples/todolist)
