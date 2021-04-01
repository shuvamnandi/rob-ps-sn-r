function testRExecution() {
    describe('Test R Execution', function() {
      it('com.shuvamnandi.RenjinExample', function() {
        return JavaPoly.type('com.shuvamnandi.RenjinExample').then(function(Renjin) {
          Renjin.evalR("3.0 + 20.6").then(function(result) {
                console.log("Result of R code eval: " + result);
                expect(result).toEqual("23.6");
          });
        });
      });
    });
  }
  