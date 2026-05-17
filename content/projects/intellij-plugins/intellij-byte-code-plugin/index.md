---
title: "Byte Code Analyzer"
gitHub: "https://github.com/marcelkliemannel/intellij-byte-code-plugin"
jetBrainsMarketplace: "https://plugins.jetbrains.com/plugin/16970-byte-code-analyzer"
---

An IntelliJ plugin with a modern tool window for analyzing byte code. It supports Java, Kotlin, Groovy, and other JVM class files:

{{< retina-image tool-window-structure-view2x.png "Byte Code Analyzer Tool Window" >}}

#### Key Features

- Structure tree view with readable insights into the individual elements of a class file.
- Method frame analysis that shows locals and stack values after each instruction.
- Complete listing of all entries in the class file's constant pool.
- An asmified view that generates Java source code for recreating the class file with the [ASM](https://asm.ow2.io) library.
- Utilities that make byte code work easier:
  - Access value converter for breaking compressed access flags into their original values.
  - Signature parser for splitting byte code signatures into readable parts.
  - Byte code verifier for checking the correctness of a class file.
