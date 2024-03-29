import { Validator } from '../src/validator';

describe('validator', () => {
  describe('checkType', () => {
    it('should parse the typeDefinition correctly', () => {
      const validator = new Validator();
      const result = validator.checkType(
        5,
        {
          type: 'number'
        }
        //'{ data: { id: number; name: string; status: enum { Active, Inactive, Unknown }; contact: { email: string; phone: string }; roles: string[]; settings: Record; lastLogin: Date | null; extraInfo: any }; error: string | null } | { data: null; error: string }'
      );

      expect(result).toBeTruthy();
    });
  });
});
