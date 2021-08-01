---
title: "Don't Confuse Integer Division with Floor Division"
date: 2021-07-15T18:45:15+02:00
draft: false
tags: ["Best Practice"]
---

When mathematical formulas are transferred into code, a common programming error occurs: The floor division operator is implemented by a simple division of two integer types.

To better understand the issues behind this, we will look at the concrete example of implementing the [modulo operation](https://en.wikipedia.org/wiki/Modulo_operation).

## Definition of the Modulo Operation

The modulo operation returns the signed remainder of a division, e.g., `7` modulo `5` would be `2` because `5` fits one time into `7` remaining `2`. 

Let us take a slightly modified equation from [Donald E. Knuth](https://proofwiki.org/wiki/Definition:Modulo_Operation/Modulo_One) that defines the modulo operation for integer numbers. (The original one is defined for all real numbers, this restriction to integer makes it a bit easier for us.) Let `x` and `y` be two integer numbers, the modulo operation `mod` would be defined as:

{{< retina-image knuth-modulo-equation2x.png "Knuth's Modulo Equation" >}}

In a more programmer-friendly language, this equation would read as follows: Given are `x` and `y` of an integer data type as input variables. If `y` is not `0`, divide `x` by `y` using floor division (which is expressed by the `⌊⌋` symbol), multiply the result by `y`, and subtract this from `x`. On the other hand, if `x` is `0`, return `x`.

Floor division simplified means that the real number result of the division is always rounded down. For example, `7` divided by `3` would give `1.75`. And using floor division, the result would be `1` because no matter what comes after the decimal point, we would always round down.

## Modulo Implementation with Floor and Integer Division

As a programmer, we could get the idea that the floor division corresponds to a normal division of two numerical variables and then simply put the result into an integer data type. This assumption may come from the fact that when converting a real number data type to an integer in most programming languages, the decimal place is simply truncated. A naive Java implementation of the modulo equation could therefore look like this:

```java
int moduloWithIntegerDivision(int x, int y) {
  if (x != 0) {
    return x - y * ( x / y );
  }
  else {
    return x;
  }
}
```

As I already spoiled in the headline, there is something wrong with the assumption we have chosen for this implementation. A clue to this could be given by the fact that most of the programming languages are offering an extra function in their standard libraries to perform the floor division. In Java, we could thus replace `x / y` with `Math.floorDiv(x, y)` and obtain be a second implementation of the module definition:

```java
int moduloWithFloorDivision(x, y) {
  if (x != 0) {
    return x - y * Math.floorDiv(x, y);
  }
  else {
    return x;
  }
}
```

If we test the two implementations against random positive numbers, we reliably get the same results every time:

```
moduloWithIntegerDivision(7, 5) // 2
moduloWithFloorDivision(7, 5)   // 2

moduloWithIntegerDivision(9, 2) // 1
moduloWithFloorDivision(9, 2)   // 1

moduloWithIntegerDivision(5, 3) // 2
moduloWithFloorDivision(5, 3)   // 2
```

So what is the problem now? Well, let's look at the results when one of the two input parameters is negative:

```
moduloWithIntegerDivision(-7, 5) // -2
moduloWithFloorDivision(-7, 5)   // 3

moduloWithIntegerDivision(-9, 2) // -1
moduloWithFloorDivision(-9, 2)   // 1

moduloWithIntegerDivision(-5, 3) // -2
moduloWithFloorDivision(-5, 3)   // 1
```

Oops.

## The Culprit: the Rounding Direction

What is the reason for this different behavior? The answer lies in the direction in which the result of an integer respectively floor division is rounded.

**Integer division rounds towards zero.** This means, for example, that the result of the integer division `7 / 5` would have the real number `1.4` as an intermediate result and rounded in the direction of `0` would result in `1`. On the other hand, the equation with a negative dividend `-7 / 5` would initially give `-1.4` and rounded towards `0` would also give `1`. 

**Floor division rounds towards negative infinitive.** In the same numerical example, we would also get for `floor(7, 5)` initially `1.4`, and this rounded to minus infinity also gives `1`. Now it gets interesting. For `floor(-7, 5)`, we also get `-1.4` at first, but we now round away from `0` to negative infinity and therefore get `2`.


## Remark

One could now say: Wait a minute, my favorite $programmingLanguage has a modulo operator that returns the same result as the `moduloWithIntegerDivision(int, int)` implementation for negative inputs. But this should actually be wrong after these explanations. The reason for this is that the supposed "module operator" in most programming languages (e.g., `%` in Java) is actually just a simple "division remain value operator" and must not be confused with the modulo operation. Colloquially, these are often unfortunately thrown together.