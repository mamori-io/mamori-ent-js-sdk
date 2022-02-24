import { MamoriService } from '../api';


describe("serialization", () => {

    test("example from jQuery documentation", () => {
        let myObject = {
            a: {
              one: 1,
              two: 2,
              three: 3
            },
            b: [ 1, 2, 3 ]
          };

          let encoded = MamoriService.serialize(myObject);

          expect(encoded).toBe("a%5Bone%5D=1&a%5Btwo%5D=2&a%5Bthree%5D=3&b%5B%5D=1&b%5B%5D=2&b%5B%5D=3");
    });
});