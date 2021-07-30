---
title: "Multiple Return Values in Kotlin with Destruction Declarations"
date: 2021-07-15T18:43:34+02:00
draft: false
tags: ["Kotlin"]
---

Sometimes we find ourselves in the situation where we want to return multiple values as the result of a method call. Some programming languages have such functionality built in and allow us to assign the returned values directly back into individual variables. [Like for example in Go](https://gobyexample.com/multiple-return-values):

```go
func values() (int, int, int) {
  return 4, 2, 4
}

first, second, third := values()
log.Printf("%d - %d - %d", first, second, third)
```

In Java this is unfortunately not so easily possible, because the Java virtual machine supports only one return value. To return more values, we would have to create a container object that holds the individual values for us. Unfortunately, this bloats the code enormously. The following code is the Java equivalent of the Go code above:

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

If we now migrate this Java code to Kolin, we have already saved a massive amount of code due to the lightweight nature of Kolin alone:

```kotlin
class ValuesContainer(val first: Int, val second: Int, val third: Int)

fun values() = ValuesContainer(4, 2, 4)

ValuesContainer result = values()
println("${result.first} - ${result.second} - ${result.third}");
```

But we still have the inconvenience of having to go the intermediate step via the container object to access the individual values.

## Destruction Declaration

Kotlin has a solution for this for us: If we now migrate the `ValuesContainer` class into a [data class](https://kotlinlang.org/docs/data-classes.html), by simply putting the `data` keyword in front of  `class`, we can take advantage of Kotlin's _destruction declarations_ functionality. This allows us to split the returned container object into its individual values and assign them directly to separated new variables:

```kotlin
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

The cases where we want to return two or three values probably occur more frequently, than three or the more values. Since the development of Kotlin is oriented towards simplifying constructs that frequently occur in the real world, the Kotlin standard library offers us helper classes for the first two cases. These would be `kotlin.Pair` for two values and `kotlin.Triple` for three values. With this we are now able to reduce the code even further by replacing our own container class with the built-in one:

```kotlin
fun values() = Triple(4, 2, 4)
val (first, second, third) = values()
```

## Handling Null Values

The individual values of a container object can have nullable types:

```kotlin
fun values() : Pair<Int, Int?> = Pair(4, null)
val (first, second) = values()
```

But the return type itself must not be nullable. Which would otherwise lead to a compile error::

```kotlin
fun values(): Pair<Int, Int>? = null
val (first, second, third) = values() // compile error
```

## Ignoring Values

If we are not interested in certain values, we can either omit them when they occur at the end:

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

So we see that the magic is nothing more than assigning the container object into a variable and then assigning its individual values into individual variables. Kotlin just encapsulates the boilercode for us here that we would normally have to write.
