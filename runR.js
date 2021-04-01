
import 
function executeR(rCode) {
  let evalResult = undefined;
  JavaPoly.type('com.shuvamnandi.RenjinExample').then(function(Renjin) {
    Renjin.evalR("3.0 + 20.6").then(function(result) {
          console.log("Result of R code eval: " + result);
          evalResult = result;
      });
    }
  );
}

module.exports = executeR;