import com.javapoly.Eval;
import com.javapoly.reflect.*;

public class EvalTest {
  public static boolean test() {
    // First define a function
    final JSObject squareFunc = (JSObject) Eval.eval("(function(x){return x*x;})");

    // Invoke it with 7 as argument
    final JSPrimitive square7 = (JSPrimitive) squareFunc.invoke(7);
    final boolean test1Pass = square7.asInteger() == 49;

    // Invoke it with 13 as argument
    final JSPrimitive square13 = (JSPrimitive) squareFunc.invoke(13);
    final boolean test2Pass = square13.asDouble() == 169.0;

    final JSPrimitive square169 = (JSPrimitive) squareFunc.invoke(square13);
    final boolean test3Pass = square169.asLong() == 28561;

    // define a string manipulation function
    final JSObject firstPartFunc = (JSObject) Eval.eval("(function(str, delim, n){return str.split(delim)[n];})");

    // Invoke it with two string arguments and an integer
    final JSPrimitive firstString = (JSPrimitive) firstPartFunc.invoke("a,b,c,d", ",", 0);
    final boolean test4Pass = firstString.asString().equals("a");

    final JSPrimitive secondString = (JSPrimitive) firstPartFunc.invoke("a,b,c,d", ",", 1);
    final boolean test5Pass = secondString.asString().equals("b");

    return test1Pass && test2Pass && test3Pass && test4Pass && test5Pass;
  }

  public static JSValue getProperty(final JSObject jsObj, final String name) {
    return jsObj.getProperty(name);
  }

}
