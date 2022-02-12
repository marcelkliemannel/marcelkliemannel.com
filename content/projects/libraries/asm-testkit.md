---
title: "ASM Test Kit"
gitHub: "https://github.com/marcelkliemannel/asm-testkit"
mavenCentral: "https://mvnrepository.com/artifact/dev.turingcomplete/asm-testkit"
---

A test kit to create fluent assertions for the [ASM](https://asm.ow2.io/) Java byte code modification framework, built on top of [AssertJ](https://assertj.github.io/doc/).

ASM is a great framework to create and modify Java byte code. However, we face the challenge that errors in the byte code generation only become visible at runtime in the JVM. Therefore, good test coverage of the generated code is essential.

This library supports us in writing unit tests to prove that our modified byte code equals the one the Java compiler would generate from the source code.
