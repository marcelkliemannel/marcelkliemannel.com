---
title: "Byte Code Analyzer"
gitHub: "https://github.com/marcelkliemannel/intellij-byte-code-plugin"
jetBrainsMarketplace: "https://plugins.jetbrains.com/plugin/16970-byte-code-analyzer"
---

IntelliJ plugin that provides a modern and powerful byte code analyzer tool window that supports Java, Kotlin, Groovy and other JVM class files:

{{< retina-image tool-window-structure-view2x.png "Byte Code Analyzer Tool Window" >}}

#### Key features
A structure tree view gives depth and human-readable insights into the individual elements of a given class file.
- Method frames analysis, giving an overview about the locals and the stack after executing an instruction.
- Listing of all entries in the constant pool of the class file.
- An asmified view generated Java source code to easily recreate the class file with the [ASM](https://asm.ow2.io) library.
- Various tools, which make working with the byte code easier:
  - An access values converter, which breaks down the compressed access single value into its original values.
  - A Signature parser, which splits a byte code signature string into its comprehensible parts.
  - A Byte code verifier, which verifies the correctness of a class file.