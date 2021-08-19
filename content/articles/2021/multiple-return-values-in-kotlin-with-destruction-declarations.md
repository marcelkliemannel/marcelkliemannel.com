---
title: "Multiple Return Values in Kotlin with Destruction Declarations"
date: 2021-07-15T18:43:34+02:00
draft: false
tags: ["Kotlin"]
metaDescription: "Simplifying code in Kotlin by returning multiple values from a method with destruction declarations."
---

Sometimes we find ourselves in a situation where we want to return multiple values as the result of a method call. Some programming languages have such functionality built-in and allow us to assign the returned values directly back into individual variables. [Like for example in Go](https://gobyexample.com/multiple-return-values):

```go
func values() (int, int, int) {
  return 4, 2, 4
}

first, second, third := values()
log.Printf("%d - %d - %d", first, second, third)
```

In Java, this is unfortunately not so easily possible. Because the Java virtual machine supports only one return value. To return more than one value, we would have to create a container object that holds the individual values. Unfortunately, this bloats the code enormously. The following code is the Java equivalent of the Go code above:

```java
class ValuesContainer {
  final int first;
  final int second;
  final int third;
  
  ValuesContainer(int first, second, third) {
    this.first = first;
    this.second = second;
    this.third = third;
  }
}

ValuesContainer values() {
  return new ValuesContainer(4, 2, 4);
}

ValuesContainer result = values();
System.out.println(result.first + " - " + result.second + " - " + result.third);
```

If we now migrate this Java code to Kotlin, we have already saved a massive amount of code due to the lightweight nature of Kotlin alone:

```kotlin
class ValuesContainer(val first: Int, val second: Int, val third: Int)

fun values() = ValuesContainer(4, 2, 4)

ValuesContainer result = values()
println("${result.first} - ${result.second} - ${result.third}");
```

But we still have the inconvenience of the intermediate step via the container object to access the individual values.

## Destruction Declaration

Kotlin has a solution for this: If we now migrate the `ValuesContainer` class into a [data class](https://kotlinlang.org/docs/data-classes.html), by simply putting the `data` keyword in front of  `class` we can take advantage of Kotlin's _destruction declarations_ functionality. This allows us to split the returned container object into its individual values and assign them directly to separated new variables:

```kotlin {hl_lines=[5]}
data class ValuesContainer(val first: Int, val second: Int, val third: Int)

fun values() = ValuesContainer(4, 2, 4)

val (first, second, third) = values()
println("${first} - ${second} - ${third}");
```

The types of each returned variable are automatically derived from their property types in the data class. However, we can also specify them explicitly:

```kotlin
val (first: Number, second: Int, first: Number) = values()
```

## Common Container Classes

Due to Kotlin's philosophy to simplifying constructs that frequently occur in the real world, the standard library offers container classes for up to 5 elements.

### Pair and Triple

We could use `kotlin.Pair` and `kotlin.Triple` for two or three elements. With this, we are now able to reduce the example code even further by replacing our container class with the built-in one:

```kotlin
fun values() = Triple(4, 2, 4)
val (first, second, third) = values()
```

### Arrays and Lists

Similarly, we can use destruction declarations also for Arrays and Lists (but not for Sets and Maps because they have no deterministic order):

```kotlin
fun values1() = Array(1, 2, 3, 4, 5)
val (first, second, third, fourth, five) = values()
```
However, this mechanism works out-of-the-box only for up to five variables:
```kotlin
fun values2() = Array(1, 2, 3, 4, 5, 6) 
val (first, second, third, fourth, five, six) = values() // Error
```
However, we should note that destruction declarations on Arrays and Lists open up a potential failure source: An `ArrayIndexOutOfBoundsException` is thrown at runtime if there are not enough elements in the array as variables are defined.

## Extending Destruction Declarations to all Java Classes

If we create new container classes ourselves or use the existing ones from the standard library, it is easy to use the multiple return value feature.

When we create new container classes or use the existing ones, it is easy to use the multiple return values feature. But since we don't want to reinvent the wheel, we often use existing, external Java classes, which do not fulfill the conditions for destruction declarations.

For example, let's take an instance of a `java.time.LocalDate`, which contains a day, month, and year value. It would be nice to split the object into its three values:
```kotlin
val (day, month, year) = LocalDate.now()
```

We can do this by taking a closer look at how the underlying mechanism of destruction declarations works: The mapping of each variable to the corresponding property in the instance is an operator with a function name `component*` where the postfix `*` is the number of the variable position, starting at `1`. With [extension functions](https://kotlinlang.org/docs/extensions.html), we can now define the operators for the destruction declaration variables for every Java class we want. For our `java.time.LocalDate` example, this would be:
```kotlin
operator fun LocalDate.component1() : Int = this.dayOfMonth
operator fun LocalDate.component2() : Int = this.monthValue
operator fun LocalDate.component3() : Int = this.year
```

## Handling Null Values

The individual values of a container object can have nullable types:

```kotlin
fun values() : Pair<Int, Int?> = Pair(4, null)
val (first, second) = values()
```

But the return type itself must not be nullable. Which would otherwise lead to a compile error:

```kotlin
fun values(): Pair<Int, Int>? = null
val (first, second, third) = values() // compile error
```

## Ignoring Values

If we are not interested in certain values, we can either omit them if they occur at the end:

```kotlin
fun values() = Triple(4, 2, 4)
val (first, second) = values() // The third value is ignored
```

Or we can use the Kotlin keyword `_` to ignore them:

```kotlin
fun values() = Triple(4, 2, 4)
val (first, _, third) = values() // The second value is ignored
```

## Under the Hood

As pointed out at the beginning, the Java virtual machine does not actually support multiple return values. And since Kotlin is also compiled to Java byte code and runs on the JVM, it should not support it either. So how did the Kotlin architects make this functionality possible nevertheless?

A look into the byte code tells us the secret. The line  `val (first, second) = values()`, where the method returns type is `Pair<Int, Int>`, is compiled to the following byte code:

```java
INVOKESTATIC KotlinFileKt.values ()Lkotlin/Pair;
ASTORE 0
ALOAD 0
      
INVOKEVIRTUAL kotlin/Pair.component1 ()Ljava/lang/Object;
CHECKCAST java/lang/Number
INVOKEVIRTUAL java/lang/Number.intValue ()I
ISTORE 1

ALOAD 0
INVOKEVIRTUAL kotlin/Pair.component2 ()Ljava/lang/Object;
CHECKCAST java/lang/Number
INVOKEVIRTUAL java/lang/Number.intValue ()I
ISTORE 2
```

If we decompile this byte code again, we would get the following Java code:

```java
kotlin.Pair result = KotlinFileKt.values();
int first = ((Number) result.component1).intValue();
int second = ((Number) result.component2).intValue();
```

So we see that the magic is nothing more than assigning the container object into a variable and then assigning its individual values into individual variables. Kotlin just encapsulates the boilerplate code for us here that we would have to write otherwise.
