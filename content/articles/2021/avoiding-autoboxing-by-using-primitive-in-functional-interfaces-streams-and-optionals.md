---
title: Avoiding Autoboxing by Using Primitives in Functional Interfaces, Streams, and Optionals
date: 2021-10-20T10:48:42+02:00
draft: false
tags: ["Java", "Best Practice"]
summary: "In this article we look at the primitive equivalents to object-based functional interfaces, streams and optionals, which are available in the Java standard library."

---

[Autoboxing](https://docs.oracle.com/javase/1.5.0/docs/guide/language/autoboxing.html) is a built-in mechanism in Java for automatically converting primitive types to and from their wrapper class instances:

```java
Integer myMethod(Integer factor) {
  int result = 5 * input; // 'factor' gets unboxed to 'int'
  return result; // 'result' gets boxed to 'Integer'
}
```

Even though this mechanism is powerful and ubiquitous in daily work with Java, it can have a negative performance impact if used excessively. The performance problem arises when we uselessly convert many values back and forth between primitive and its wrapper classes. This overuse can often appear when working with generics, as they do not support primitive types yet (which will change with [project Valhalla](https://wiki.openjdk.java.net/display/valhalla/Main)).

The collection API is a classic example of this. Performance problems can quickly arise from unnecessary autoboxing while working with the values of a collection, e.g., calculating the sum of a `List<Integer>`. To work around this, some excellent libraries [provide](http://commons.apache.org/dormant/commons-primitives/apidocs/org/apache/commons/collections/primitives/package-summary.html) [primitive](https://bitbucket.org/trove4j/trove/src/master/) [collection](https://github.com/vigna/fastutil) [alternatives](https://www.eclipse.org/collections/).

Since Java 8, the `Stream<T>` API, functional interfaces, and `Optional<T>`s are integral parts of many libraries and code bases. However, almost all of these functions are working on object values and generics, which brings us back to the same autoboxing performance problem.

Fortunately for us, the authors of these features have built alternative primitive solutions into the Java standard library. However, these are often not used in practice, so that we will take a closer look at them in this article.

## Primitive Functional Interfaces

Every interface which has one single abstract (and therefore unimplemented) method is called a functional interface. This interface is the foundation for lambda expression, as they are the implementation of the abstract method. For example, the functional interface `Function<String, Integer>` can be implemented via the lambda expression `input -> input.length()`. 

When we define functional interfaces ourselves, there is no restriction on using primitive parameters and a primitive return value for the abstract method.

However, since specific functional interface patterns occur over and over again, we don't always want to reinvent the wheel. For that, the Java standard library contains a series of commonly used [functional interfaces](https://docs.oracle.com/javase/8/docs/api/java/util/function/package-summary.html) (e.g., `Supplier<T>` or `Function<T, R>`).

To avoid always having to work with the wrapper classes of primitive data types, the standard library has primitive interface alternatives for the data types `int`, `long` and `double`:

| With Wrapper Class           | Primitive Alternative                                        |
| ---------------------------- | ------------------------------------------------------------ |
| `BinaryOperator<Integer>`    | [IntBinaryOperator](https://docs.oracle.com/en/java/javase/17/docs/api/java.base/java/util/function/IntBinaryOperator.html) |
| `BinaryOperator<Long>`       | [LongBinaryOperator](https://docs.oracle.com/en/java/javase/17/docs/api/java.base/java/util/function/LongBinaryOperator.html) |
| `BinaryOperator<Double>`     | [DoubleBinaryOperator](https://docs.oracle.com/en/java/javase/17/docs/api/java.base/java/util/function/DoubleBinaryOperator.html) |
| `Consumer<Integer>`          | [IntConsumer]([IntConsumer](https://docs.oracle.com/en/java/javase/17/docs/api/java.base/java/util/function/IntConsumer.html)) |
| `Consumer<Long>`             | [LongConsumer](https://docs.oracle.com/en/java/javase/17/docs/api/java.base/java/util/function/LongConsumer.html) |
| `Consumer<Double>`           | [DoubleConsumer](https://docs.oracle.com/en/java/javase/17/docs/api/java.base/java/util/function/DoubleConsumer.html) |
| `BiConsumer<T, Integer>`     | [ObjIntConsumer<T>](https://docs.oracle.com/en/java/javase/17/docs/api/java.base/java/util/function/ObjIntConsumer.html) |
| `BiConsumer<T, Long>`        | [ObjLongConsumer<T>](https://docs.oracle.com/en/java/javase/17/docs/api/java.base/java/util/function/ObjLongConsumer.html) |
| `BiConsumer<T, Double>`      | [ObjDoubleConsumer<T>](https://docs.oracle.com/en/java/javase/17/docs/api/java.base/java/util/function/ObjDoubleConsumer.html) |
| `Function<Integer, R>`       | [IntFunction<R>](https://docs.oracle.com/en/java/javase/17/docs/api/java.base/java/util/function/IntFunction.html) |
| `Function<Long, R>`          | [LongFunction<R>](https://docs.oracle.com/en/java/javase/17/docs/api/java.base/java/util/function/LongFunction.html) |
| `Function<Double, R>`        | [DoubleFunction<R>](https://docs.oracle.com/en/java/javase/17/docs/api/java.base/java/util/function/DoubleFunction.html) |
| `Function<Integer, Integer>` | [IntUnaryOperator](https://docs.oracle.com/en/java/javase/17/docs/api/java.base/java/util/function/IntUnaryOperator.html) |
| `Function<Long, Long>`       | [LongUnaryOperator](https://docs.oracle.com/en/java/javase/17/docs/api/java.base/java/util/function/LongUnaryOperator.html) |
| `Function<Double, Double>`   | [DoubleUnaryOperator](https://docs.oracle.com/en/java/javase/17/docs/api/java.base/java/util/function/DoubleUnaryOperator.html) |
| `Function<Integer, Double>`  | [IntToDoubleFunction](https://docs.oracle.com/en/java/javase/17/docs/api/java.base/java/util/function/IntToDoubleFunction.html) |
| `Function<Integer, Long>`    | [IntToLongFunction](https://docs.oracle.com/en/java/javase/17/docs/api/java.base/java/util/function/IntToLongFunction.html) |
| `Function<Long, Integer>`    | [LongToIntFunction](https://docs.oracle.com/en/java/javase/17/docs/api/java.base/java/util/function/LongToIntFunction.html) |
| `Function<Long, Double>`     | [LongToDoubleFunction](https://docs.oracle.com/en/java/javase/17/docs/api/java.base/java/util/function/LongToDoubleFunction.html) |
| `Function<Double, Integer>`  | [DoubleToIntFunction](https://docs.oracle.com/en/java/javase/17/docs/api/java.base/java/util/function/DoubleToIntFunction.html) |
| `Function<Double, Long>`     | [DoubleToLongFunction](https://docs.oracle.com/en/java/javase/17/docs/api/java.base/java/util/function/DoubleToLongFunction.html) |
| `Function<T, Integer>`       | [ToIntFunction<T>](https://docs.oracle.com/en/java/javase/17/docs/api/java.base/java/util/function/ToIntFunction.html) |
| `Function<T, Long>`          | [ToLongFunction<T>](https://docs.oracle.com/en/java/javase/17/docs/api/java.base/java/util/function/ToLongFunction.html) |
| `Function<T, Double>`        | [ToDoubleFunction<T>](https://docs.oracle.com/en/java/javase/17/docs/api/java.base/java/util/function/ToDoubleFunction.html) |
| `BiFunction<T, U, Integer>`  | [ToIntBiFunction<T, U>](https://docs.oracle.com/en/java/javase/17/docs/api/java.base/java/util/function/ToIntBiFunction.html) |
| `BiFunction<T, U, Long>`     | [ToLongBiFunction<T, U>](https://docs.oracle.com/en/java/javase/17/docs/api/java.base/java/util/function/ToLongBiFunction.html) |
| `BiFunction<T, U, Double>`   | [ToDoubleBiFunction<T, U>](https://docs.oracle.com/en/java/javase/17/docs/api/java.base/java/util/function/ToDoubleBiFunction.html) |
| `Predicate<Integer>`         | [IntPredicate](https://docs.oracle.com/en/java/javase/17/docs/api/java.base/java/util/function/IntPredicate.html) |
| `Predicate<Long>`            | [LongPredicate](https://docs.oracle.com/en/java/javase/17/docs/api/java.base/java/util/function/LongPredicate.html) |
| `Predicate<Double>`          | [DoublePredicate](https://docs.oracle.com/en/java/javase/17/docs/api/java.base/java/util/function/DoublePredicate.html) |
| `Supplier<Integer>`          | [IntSupplier](https://docs.oracle.com/en/java/javase/17/docs/api/java.base/java/util/function/IntSupplier.html) |
| `Supplier<Long>`             | [LongSupplier](https://docs.oracle.com/en/java/javase/17/docs/api/java.base/java/util/function/LongSupplier.html) |
| `Supplier<Double>`           | [DoubleSupplier](https://docs.oracle.com/en/java/javase/17/docs/api/java.base/java/util/function/DoubleSupplier.html) |

## Primitive Stream API

The functional interfaces from the previous chapter are often used in the [stream API](https://docs.oracle.com/en/java/javase/17/docs/api/java.base/java/util/stream/package-summary.html) because their lambda implementation allows programming a simple, modular, and well-readable processing chain of values. 

In practice, we can observe an increase in the autoboxing overhead in the stream API. This increase is mainly a result of using small processing steps that do not reuse intermediate values.

Let's illustrate this problem with the following example. Instead of unboxing the value once to a primitive, it gets unboxed, processed, and boxed again in each lambda step:

```java
Stream.of(1, 2, 3, 4, 5) // Values are getting boxed to 'Integer'
  // 'i' is an 'Integer' and gets unboxed to 'int'
  .filter(i -> i % 2 == 0)
  // 'i' is an 'Integer' and gets unboxed to 'int'
  // and the return value gets boxed back to 'Integer'
  .map(i -> i * 2)
  ...
```

To get around the unnecessary autoboxing problem, the stream API has three primitive alternatives besides the very familiar `Stream` interface: [IntStream](https://docs.oracle.com/en/java/javase/17/docs/api/java.base/java/util/stream/IntStream.html), [LongStream](https://docs.oracle.com/en/java/javase/17/docs/api/java.base/java/util/stream/LongStream.html), and [DoubleStream](https://docs.oracle.com/en/java/javase/17/docs/api/java.base/java/util/stream/DoubleStream.html).

The primitive stream interfaces provide the same functionality as the object stream interface but use the primitive functional interfaces shown in the previous chapter, which have primitive parameters and return values.

Using a primitive stream, we can convert the example shown above so that it works without any autoboxing overhead:

```java
IntStream.of(1, 2, 3, 4, 5) // Vales are directly used as 'int's
  // 'i' is an 'int'
  .filter(i -> i % 2 == 0)
  // 'i' is an 'int' and return value is also an 'int'
  .map(i -> i * 2)
  ...
```

### Converting Between Primitive and Object Stream

Sometimes, it is inevitable that we start with an object-based stream but still want to take advantage of a primitive stream. For this, there are six conversion methods in the `Stream` interface:

```java
IntStream mapToInt(ToIntFunction<? super T>)
IntStream flatMapToInt(Function<? super T, ? extends IntStream>)
  
LongStream mapToLong(ToLongFunction<T>)
LongStream flatMapToLong(Function<? super T, ? extends LongStream>)
  
DoubleStream mapToDouble(ToDoubleFunction<? super T>)
DoubleStream mapToDouble(Function<? super T, ? extends DoubleStream>)
```

Conversely, if we have a primitive stream, we can use the `mapToObj()` method to convert to an object stream.

### Summary Statistics

Sometimes we want to determine specific characteristics of a number set, e.g., the minimum, maximum, and sum. If we're going to do this from an object stream, we would have to keep track of these characteristics in variables outside the stream. However, this approach breaks the nice continuous processing line of chained stream methods.

With the "summary statistics" feature, the three primitive streams offer an elegant solution for this:

```java
IntSummaryStatistics summaryStatistics = IntStream.of(1, 2, 3, 4, 5).summaryStatistics();
summaryStatistics.getCount(); // 5
summaryStatistics.getMax(); // 5
summaryStatistics.getMin(); // 1
summaryStatistics.getAverage(); // 3.0
summaryStatistics.getSum(); // 15
```

## Primitive Optionals

An [Optional](https://docs.oracle.com/en/java/javase/17/docs/api/java.base/java/util/Optional.html) is a container object that gets used to express a value's (non-)presence. We should use this object primarily as the return value of methods since it has the advantage of forcing the caller to deal with the potential non-existence of a value (a potentially `null` value gets often overlooked because no one read the JavaDoc).

Similar to the object stream, we can quickly fall into the same unnecessary autoboxing trap here if we use the object-based `Optional<T>`:

```java
Optional.of(2) // Value is boxed to 'Integer'
  // 'i' is an 'Integer' and gets unboxed to 'int'
  .filter(i -> i % 2 == 0)
  // 'i' is an 'Integer' and gets unboxed to 'int'
  .ifPresent(i -> ...);
```

Analogous to primitive streams, there are primitive alternatives to the object-based one: `OptionalInt`, `OptionalLong`, and `OptionalDouble`.

Likewise, these offer the same functionalities as the object-based optional only with the difference that primitive functional interfaces and primitive parameters and return values are used:

```java
OptionalInt OptionalInt#of(int)

int OptionalInt#getAsLong()
int OptionalInt#orElse(int)
int OptionalInt#orElseGet(IntSupplier)
void OptionalInt#ifPresent(IntConsumer)
void OptionalInt#ifPresentOrElse(IntConsumer, Runnable)
```