---
title: "Handling Multiple Thrown Exceptions With Suppressed Exceptions"
date: 2021-09-11T12:53:40+02:00
draft: false
tags: ["Java"]
summary: "We take a closer look at the suppressed exceptions concept, which is a detail of the Java Exception API with which we can add subordinate exceptions into a superordinate one."
---

In this article, we will look at a small detail of the Java exception API that helps us in a situation where we have to deal with multiple thrown exceptions: the concept of suppressed exceptions.

In general, suppressed exceptions are subordinate exceptions under a superordinated exception. Essentially, they help us bundle multiple thrown exceptions into one without losing information. We will look at two scenarios in the following chapters where this concept gives us a better error output.

## Bundling Multiple Thrown Exceptions Into One

Sometimes we have the situation when we are processing multiple tasks, but the failure of one task should not cause the other tasks to fail.

For example, let's take a system that reads many files from a disk and transfers them to a database. Since reading, parsing, and validating the files in this example is a time-consuming task, we do not want to get into the following situation: The system processes five files and then fails with an error because the 6th file is corrupt. After we fixed the file manually, the system got restarted. Now it processes another ten files, encounters another faulty one, and fails again. And this process continues for maybe hundreds of files.

A more appropriate implementation of this system would be that it treats individual errors more tolerantly: While processing the files, it should collect erroneous files in between but not fail, and after processing all files, it should fail with a single error containing all faulty files. 

A Java implementation of such a tolerantly system could look like this:

```java
void consumeFiles(File directory) throws IOException {
  List<Exception> errors = new ArrayList<>();
  
  for (File file : directory.listFiles()) {
    try {
      consumeFile(file);
    }
    catch (IOException | ParsingException | InvalidDataException e) {
      errors.add(e);
    }
  }

  throw new IOException(...); // How to handle all errors?
}
```

The question now is, how do we build an exception that reflects all the errors?

We could take the individual exception messages and combine them into a single error text:

```java
String errorsAsText = errors.stream().map(e -> "- " + e.getMessage()).collect(Collectors.joining("\n"));
throw new IOException("Failed to consume files:\n" + errorsAsText);
```

Printing the exception stack trace could lead to the following sample output:

```java
java.io.IOException: Failed to consume the followingfiles:
- File 'data_2017.csv' has an invalid format.
- File 'data_2019.csv' is missing column X.
  ...
	at org.example.Main.main(Main.java:24)
```

The problem with this output is that we lose a lot of information about the individual errors. In particular, we only have the stack trace of the superordinate `IOException`, but not those of the individual ones. This implementation can make it hard to reproduce the errors since we may not precisely see the origin of the exceptions.

The concept of suppressed exceptions provides a remedy for this problem.

For this, we create a superordinate exception add all further exceptions via `Exception#addSuppressed()`:

```java
var ioException = new IOException("Failed to consume files.");
errors.forEach(ioException::addSuppressed);
throw ioException;
```

The output we get now has all the information about the subordinated exception and looks like this:

```java
java.io.IOException: Failed to consume files.
	at org.example.Main.main(Main.java:20)
	Suppressed: ParsingException: File 'data_2017.csv' has an invalid format.
		at org.example.Main.main(Main.java:17)
	Suppressed: InvalidDataException: File 'data_2019.csv' is missing column X.
		at org.example.Main.main(Main.java:18)
```

## Handling Another Error if We Are Already in an Error State

Next, we want to look at the following situation where we are already in an error state and are facing another exception.

In the following example, we perform an action that can fail with an exception. This failure causes us to roll back the action. This rollback, in turn, can also fail with an exception. The problem now is that we are already in an error case. What must not happen now is that the rollback swallows the original exception.

Again, we can work with the suppressed exceptions concept and append the occurred one in the meantime exception to the original one:

```java {hl_lines=[10]}
void executeAction() throws IOException {    
  try {
      ...
  }
  catch (IOException e) {
    try {
      rollbackAction();
    }
    catch (IOException e) {
      e.addSuppressed(e);
    }
    
    throw e;
  }
}
```

In the output, we now find the superordinate exception, as well as the subordinate one:

```java
java.lang.Exception: Failed to execute action.
	at org.example.Main.main(Main.java:20)
	Suppressed: IOException: Unable to delete working directory.
		at org.example.Main.main(Main.java:47)
```