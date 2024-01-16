import { patch, Tanuki } from "../src/tanuki";
import { Register } from "../src/register";
import functionModeler from "../src/functionModeler";

class Functions {
  static doubleNumber = patch<number, number>(
    {
      ignoreFinetuneFetching: true,
      environmentId: 12,
      ignoreFinetuning: true,
      ignoreDataStorage: true,
    }
  )`Double the input number`;

  static tripleNumber = patch<number, number>()`Triple the input number`;
}

describe('Configurability Tests', () => {
  test('test_configurability', () => {
    // Set up basic configuration

    //const tanuki = new Tanuki()

    Tanuki.align((it) => {
      it("should evaluate clearly true statements as true", (expect) => {
        expect(Functions.doubleNumber(2)).toEqual(4);
        expect(Functions.doubleNumber(3)).toEqual(6);
        expect(Functions.tripleNumber(2)).toEqual(6);
      })
    })

    const doubleNumberDescription = Register.loadFunctionDescription('doubleNumber', 'Double the input number');
    const doubleNumberHash = doubleNumberDescription.hash();

    const tripleNumberDescription = Register.loadFunctionDescription('tripleNumber', 'Triple the input number');
    const tripleNumberHash = tripleNumberDescription.hash();

    expect(functionModeler.environmentId).toEqual(12);
    expect(functionModeler.checkFinetuneBlacklist).toContain(doubleNumberHash);
    expect(functionModeler.executeFinetuneBlacklist).toContain(doubleNumberHash);
    expect(functionModeler.storeDataBlacklist).toContain(doubleNumberHash);

    expect(functionModeler.checkFinetuneBlacklist).not.toContain(tripleNumberHash);
    expect(functionModeler.executeFinetuneBlacklist).not.toContain(tripleNumberHash);
    expect(functionModeler.storeDataBlacklist).not.toContain(tripleNumberHash);
  })
})