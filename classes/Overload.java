import java.lang.reflect.Constructor;

public class Overload {

  private String text;

  public Overload() {
    this.text = "empty";
  }

  public Overload(Character c) {
    this.text = "Character:" + c;
  }

  public Overload(long l) {
    this.text = "long:" + l;
  }

  public Overload(Float f) {
    this.text = "Float:" + f;
  }

  public static String staticMethod(char ch) {
    return "char:" + ch;
  }

  public static String staticMethod(byte b) {
    return "byte:" + b;
  }

  public static String staticMethod(Float f) {
    return "Float:" + f;
  }

  public String method(String name) {
    return "String:" + name;
  }

  public String method(Byte b) {
    return "Byte:" + b;
  }

  public String method(Short b) {
    return "Short:" + b;
  }

  public String getText() {
    return text;
  }

  public static Object identityFunction(Object arg) {
    return arg;
  }
}